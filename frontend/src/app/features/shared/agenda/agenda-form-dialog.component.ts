import { DatePipe } from '@angular/common';
import { Component, DestroyRef, EventEmitter, inject, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ErrorStateMatcher, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { catchError, EMPTY, finalize, forkJoin, map, startWith, Subject, switchMap } from 'rxjs';

import { Agenda, AgendaListado, AgendaPayload } from '../../../core/models/agenda.model';
import { Especialidad } from '../../../core/models/especialidad.model';
import { Medico } from '../../../core/models/medico.model';
import { Sede } from '../../../core/models/sede.model';
import { AgendaService } from '../../../core/services/agenda.service';
import { MedicoService } from '../../../core/services/medico.service';
import { SedeService } from '../../../core/services/sede.service';
import { SessionService } from '../../../core/services/session.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import {
  fechaAgendaValida, fechaCalendario, FORMATOS_FECHA_AGENDA,
  horaAgendaValida, leerFechaCalendario, opcionDisponible, ordenHorasAgenda
} from './agenda-form.utils';
import { EliminarAgendaDialogComponent } from './eliminar-agenda-dialog.component';

export interface AgendaFormularioData {
  modo: 'medico' | 'operador';
  idMedico: number | null;
  fecha: string;
  idSedeInicial: number | null;
  agenda: Agenda | null;
  gestionarRangos?: boolean;
}

export interface AgendaFormularioResultado {
  fecha: string;
}

@Component({
  selector: 'app-agenda-form-dialog',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, MatButtonModule, MatDatepickerModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
    provideNativeDateAdapter(FORMATOS_FECHA_AGENDA)
  ],
  templateUrl: './agenda-form-dialog.component.html',
  styleUrl: './agenda-form-dialog.component.css'
})
export class AgendaFormDialogComponent implements OnInit, OnDestroy {
  readonly data = inject<AgendaFormularioData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AgendaFormDialogComponent, AgendaFormularioResultado>>(MatDialogRef);
  private readonly agendasApi = inject(AgendaService);
  private readonly medicosApi = inject(MedicoService);
  private readonly sedesApi = inject(SedeService);
  private readonly session = inject(SessionService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargaRangos = new Subject<void>();
  private confirmacion?: MatDialogRef<EliminarAgendaDialogComponent, boolean>;

  @Output() readonly cambiosGuardados = new EventEmitter<void>();
  readonly esOperador = this.data.modo === 'operador';
  readonly gestion = this.esOperador && this.data.gestionarRangos === true;
  readonly medicoFijo = !this.esOperador || this.gestion;
  readonly fechaContexto = leerFechaCalendario(this.data.fecha);
  readonly medicos = signal<Medico[]>([]);
  readonly especialidades = signal<Especialidad[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly cargandoDatos = signal(true);
  readonly guardando = signal(false);
  readonly errorDatos = signal('');
  readonly errorGuardado = signal('');
  readonly exito = signal('');
  readonly rangos = signal<AgendaListado[]>([]);
  readonly seleccionada = signal<Agenda | null>(this.data.agenda);
  readonly cargandoRangos = signal(false);
  readonly errorRangos = signal('');
  readonly confirmacionAbierta = signal(false);
  readonly fechaMinima = new Date(1000, 0, 1);
  readonly fechaMaxima = new Date(9999, 11, 31);
  readonly formulario = new FormGroup({
    id_medico: new FormControl<number | null>(this.data.idMedico, [
      Validators.required, opcionDisponible(() => this.medicos())
    ]),
    fecha: new FormControl<Date | null>(leerFechaCalendario(this.data.agenda?.fecha ?? this.data.fecha), [
      Validators.required, fechaAgendaValida
    ]),
    hora_entrada: new FormControl(this.data.agenda?.hora_entrada ?? '', {
      nonNullable: true, validators: [Validators.required, horaAgendaValida]
    }),
    hora_salida: new FormControl(this.data.agenda?.hora_salida ?? '', {
      nonNullable: true, validators: [Validators.required, horaAgendaValida]
    }),
    id_especialidad: new FormControl<number | null>(this.data.agenda?.id_especialidad ?? null, [
      Validators.required, opcionDisponible(() => this.especialidades())
    ]),
    id_sede: new FormControl<number | null>(this.data.agenda?.id_sede ?? null, [
      Validators.required, opcionDisponible(() => this.sedes())
    ])
  }, { validators: ordenHorasAgenda });

  readonly errorSalida: ErrorStateMatcher = {
    isErrorState: (control, formulario) => Boolean(
      control && (control.invalid || control.parent?.hasError('ordenHoras')) &&
      (control.touched || formulario?.submitted)
    )
  };

  ngOnInit(): void {
    this.formulario.controls.id_medico.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.especialidades.set(this.medicos().find((medico) => medico.id === id)?.especialidades ?? []);
      const especialidad = this.formulario.controls.id_especialidad;
      especialidad.reset(null, { emitEvent: false });
      if (this.especialidades().length === 0) especialidad.disable({ emitEvent: false });
      else especialidad.enable({ emitEvent: false });
    });

    if (this.gestion) {
      this.recargaRangos.pipe(
        startWith(undefined),
        switchMap(() => {
          this.errorRangos.set('');
          if (!this.permisoOperadorValido() || !this.fechaContexto || !this.data.idMedico ||
              !Number.isSafeInteger(this.data.idMedico) || this.data.idMedico <= 0) {
            this.errorRangos.set('No se pudo identificar el médico, la fecha o tu sede para gestionar la agenda.');
            return EMPTY;
          }
          this.cargandoRangos.set(true);
          return this.agendasApi.listar(this.data.fecha, {
            id_sede: this.data.idSedeInicial!, id_medico: this.data.idMedico
          }).pipe(
            map((respuesta) => {
              if (!Array.isArray(respuesta.datos)) throw new Error('Respuesta de agendas inválida');
              return [...respuesta.datos].sort((a, b) => a.hora_entrada.localeCompare(b.hora_entrada) || a.id - b.id);
            }),
            catchError((error: unknown) => {
              this.errorRangos.set(mensajeErrorApi(error, 'No se pudieron cargar los rangos. Reintentá la consulta.'));
              return EMPTY;
            }),
            finalize(() => this.cargandoRangos.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe((rangos) => this.rangos.set(rangos));
    }
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.confirmacion?.close();
  }

  cargarDatos(): void {
    if (this.guardando() || this.confirmacionAbierta()) return;
    this.formulario.disable({ emitEvent: false });
    this.cargandoDatos.set(true);
    this.errorDatos.set('');

    if (this.medicoFijo && (!Number.isSafeInteger(this.data.idMedico) || !this.data.idMedico || this.data.idMedico <= 0)) {
      this.errorDatos.set('No se pudo identificar al médico de este horario.');
      this.cargandoDatos.set(false);
      return;
    }
    if (!this.permisoOperadorValido()) {
      this.errorDatos.set('No se pudo identificar una sede válida del operador. Volvé a iniciar sesión.');
      this.cargandoDatos.set(false);
      return;
    }

    // Sin filtro de sede: también deben aparecer los médicos que todavía no tienen agenda.
    forkJoin({ medicos: this.medicosApi.listar(), sedes: this.sedesApi.listar() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ medicos, sedes }) => {
          this.cargandoDatos.set(false);
          if (!Array.isArray(medicos.datos) || !Array.isArray(sedes.datos)) {
            this.errorDatos.set('La respuesta del servidor no contiene las especialidades o las sedes.');
            return;
          }
          this.medicos.set(medicos.datos);
          const medico = medicos.datos.find((item) => item.id === this.formulario.controls.id_medico.value);
          if (this.medicoFijo && !medico) {
            this.errorDatos.set('No se encontró al médico en el listado disponible. Reintentá la carga.');
            return;
          }
          if (medico && !Array.isArray(medico.especialidades)) {
            this.errorDatos.set('La respuesta del servidor no contiene las especialidades del médico.');
            return;
          }
          this.especialidades.set(medico?.especialidades ?? []);
          this.sedes.set(sedes.datos);
          if (!this.esOperador && this.especialidades().length === 0) {
            this.errorDatos.set('El médico no tiene especialidades asignadas. Solicitá su asignación antes de guardar.');
            return;
          }
          if (this.esOperador && !sedes.datos.some((sede) => sede.id === this.data.idSedeInicial)) {
            this.errorDatos.set('Tu sede asignada no está disponible. Volvé a iniciar sesión o consultá al administrador.');
            return;
          }
          if (this.esOperador) {
            this.formulario.controls.id_sede.setValue(this.data.idSedeInicial, { emitEvent: false });
          }
          if (sedes.datos.length === 0) {
            this.errorDatos.set('No hay sedes disponibles. Es necesario contar con una sede para guardar.');
            return;
          }
          if (!this.data.agenda && this.formulario.controls.id_sede.value === null &&
              sedes.datos.some((sede) => sede.id === this.data.idSedeInicial)) {
            this.formulario.controls.id_sede.setValue(this.data.idSedeInicial);
          }
          this.habilitarFormulario();
        },
        error: (error: unknown) => {
          this.cargandoDatos.set(false);
          this.errorDatos.set(mensajeErrorApi(error, 'No se pudieron cargar las especialidades y sedes. Revisá la conexión y reintentá.'));
        }
      });
  }

  guardar(): void {
    this.formulario.markAllAsTouched();
    if (this.guardando() || this.confirmacionAbierta() || this.cargandoDatos() || this.cargandoRangos() ||
        this.errorDatos() || this.errorRangos() || this.especialidades().length === 0 || this.formulario.invalid) return;
    if (!this.permisoOperadorValido()) {
      this.errorGuardado.set('Tu sede no permite esta operación. Volvé a iniciar sesión.');
      return;
    }

    const valores = this.formulario.getRawValue();
    const fecha = fechaCalendario(this.gestion ? this.fechaContexto : valores.fecha);
    const idMedico = this.medicoFijo ? this.data.idMedico : valores.id_medico;
    const idSede = this.esOperador ? this.data.idSedeInicial : valores.id_sede;
    if (!fecha || !idMedico || valores.id_especialidad === null || idSede === null) return;
    const payload: AgendaPayload = {
      fecha,
      hora_entrada: valores.hora_entrada,
      hora_salida: valores.hora_salida,
      id_medico: idMedico,
      id_especialidad: valores.id_especialidad,
      id_sede: idSede
    };

    this.guardando.set(true);
    this.errorGuardado.set('');
    this.exito.set('');
    this.dialogRef.disableClose = true;
    this.formulario.disable({ emitEvent: false });
    const agenda = this.seleccionada();
    const solicitud = agenda
      ? this.agendasApi.actualizar(agenda.id, payload)
      : this.agendasApi.crear(payload);
    solicitud.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        if (!this.gestion) {
          this.dialogRef.close({ fecha: respuesta.datos?.fecha ?? fecha });
          return;
        }
        this.guardando.set(false);
        this.dialogRef.disableClose = false;
        this.seleccionarRango(null);
        this.exito.set('Rango guardado correctamente.');
        this.cambiosGuardados.emit();
        this.cargarRangos();
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.dialogRef.disableClose = false;
        this.habilitarFormulario();
        this.errorGuardado.set(mensajeErrorApi(error, 'No se pudo guardar el horario. Revisá la conexión y reintentá.'));
      }
    });
  }

  cargarRangos(): void {
    this.recargaRangos.next();
  }

  seleccionarRango(id: number | null): void {
    if (this.guardando() || this.confirmacionAbierta() || this.cargandoRangos()) return;
    const agenda = this.rangos().find((rango) => rango.id === id) ?? null;
    if (id !== null && !agenda) return;
    this.seleccionada.set(agenda);
    this.errorGuardado.set('');
    this.exito.set('');
    this.formulario.reset({
      id_medico: this.data.idMedico,
      id_sede: this.data.idSedeInicial,
      fecha: leerFechaCalendario(this.data.fecha),
      id_especialidad: agenda?.id_especialidad ?? null,
      hora_entrada: agenda?.hora_entrada.slice(0, 5) ?? '',
      hora_salida: agenda?.hora_salida.slice(0, 5) ?? ''
    }, { emitEvent: false });
    this.habilitarFormulario();
  }

  eliminarRango(): void {
    const agenda = this.rangos().find((rango) => rango.id === this.seleccionada()?.id);
    if (!this.gestion || !agenda || this.guardando() || this.confirmacionAbierta() ||
        this.cargandoDatos() || this.cargandoRangos() || this.errorDatos() || this.errorRangos()) return;
    if (!this.permisoOperadorValido()) {
      this.errorGuardado.set('Tu sede no permite esta operación. Volvé a iniciar sesión.');
      return;
    }
    this.confirmacionAbierta.set(true);
    this.errorGuardado.set('');
    this.exito.set('');
    this.dialogRef.disableClose = true;
    this.formulario.disable({ emitEvent: false });
    const referencia = this.dialog.open<EliminarAgendaDialogComponent, AgendaListado, boolean>(
      EliminarAgendaDialogComponent,
      { width: '480px', maxWidth: 'calc(100vw - 24px)', data: agenda }
    );
    this.confirmacion = referencia;
    referencia.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((eliminada) => {
      this.confirmacionAbierta.set(false);
      this.confirmacion = undefined;
      this.dialogRef.disableClose = false;
      if (!eliminada) {
        this.habilitarFormulario();
        return;
      }
      this.seleccionarRango(null);
      this.exito.set('Rango eliminado correctamente.');
      this.cambiosGuardados.emit();
      this.cargarRangos();
    });
  }

  etiquetaMedico(): string {
    const medico = this.medicos().find((item) => item.id === this.data.idMedico);
    return medico ? `${medico.id}. ${medico.apellido}, ${medico.nombre}` : 'Médico no disponible';
  }

  etiquetaSede(): string {
    const sede = this.sedes().find((item) => item.id === this.data.idSedeInicial);
    return sede ? `${sede.id}. ${sede.nombre}` : 'Sede no disponible';
  }

  private habilitarFormulario(): void {
    if (this.cargandoDatos() || this.errorDatos()) return;
    this.formulario.enable({ emitEvent: false });
    if (this.medicoFijo) this.formulario.controls.id_medico.disable({ emitEvent: false });
    if (this.esOperador) this.formulario.controls.id_sede.disable({ emitEvent: false });
    if (this.gestion) this.formulario.controls.fecha.disable({ emitEvent: false });
    if (this.especialidades().length === 0) this.formulario.controls.id_especialidad.disable({ emitEvent: false });
  }

  private permisoOperadorValido(): boolean {
    if (!this.esOperador) return true;
    const usuario = this.session.obtenerUsuario();
    const idSede = usuario?.id_sede;
    return usuario?.rol === 'operador' && typeof idSede === 'number' && Number.isSafeInteger(idSede) &&
      idSede > 0 && idSede === this.data.idSedeInicial;
  }
}
