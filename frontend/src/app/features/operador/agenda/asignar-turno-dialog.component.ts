import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { catchError, EMPTY, finalize, map, of, startWith, Subject, switchMap } from 'rxjs';

import { AgendaListado } from '../../../core/models/agenda.model';
import { FiltrosPacientes, PacienteListado } from '../../../core/models/paciente.model';
import { SolicitudTurnoOperador } from '../../../core/models/turno.model';
import { MedicoService } from '../../../core/services/medico.service';
import { PacienteService } from '../../../core/services/paciente.service';
import { SessionService } from '../../../core/services/session.service';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { fechaCalendario, horaAgendaValida, leerFechaCalendario, opcionDisponible } from '../../shared/agenda/agenda-form.utils';

const idPositivo = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0;

@Component({
  selector: 'app-asignar-turno-dialog',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatProgressSpinnerModule, MatSelectModule
  ],
  templateUrl: './asignar-turno-dialog.component.html',
  styleUrl: './asignar-turno-dialog.component.css'
})
export class AsignarTurnoDialogComponent implements OnInit {
  readonly agenda = inject<AgendaListado>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AsignarTurnoDialogComponent, boolean>>(MatDialogRef);
  private readonly pacientesApi = inject(PacienteService);
  private readonly medicosApi = inject(MedicoService);
  private readonly turnosApi = inject(TurnoService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly consultas = new Subject<{ criterio: string; pagina: number } | null>();
  private readonly recargaHorarios = new Subject<void>();

  readonly fecha = typeof this.agenda.fecha === 'string' ? leerFechaCalendario(this.agenda.fecha) : null;
  readonly entrada = typeof this.agenda.hora_entrada === 'string' ? this.agenda.hora_entrada.slice(0, 5) : '';
  readonly salida = typeof this.agenda.hora_salida === 'string' ? this.agenda.hora_salida.slice(0, 5) : '';
  readonly pacientes = signal<PacienteListado[]>([]);
  readonly pacienteSeleccionado = signal<PacienteListado | null>(null);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly limite = 20;
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.limite)));
  readonly criterioActual = signal<string | null>(null);
  readonly consultaRealizada = signal(false);
  readonly cargandoPacientes = signal(false);
  readonly errorPacientes = signal('');
  readonly horarios = signal<string[]>([]);
  readonly cargandoHorarios = signal(true);
  readonly errorHorarios = signal('');
  readonly enviando = signal(false);
  readonly errorReserva = signal('');
  readonly errorContexto = computed(() => {
    const formatoHora = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (![this.agenda.id, this.agenda.id_medico, this.agenda.id_especialidad, this.agenda.id_sede].every(idPositivo) ||
        !fechaCalendario(this.fecha) || !formatoHora.test(this.entrada) || !formatoHora.test(this.salida) || this.salida <= this.entrada) {
      return 'El rango de agenda no tiene un contexto válido. Cerrá el diálogo y actualizá la agenda.';
    }
    const usuario = this.session.obtenerUsuario();
    if (usuario?.rol !== 'operador' || !idPositivo(usuario.id_sede) || usuario.id_sede !== this.agenda.id_sede) {
      return 'Solo podés asignar turnos en tu sede registrada. Volvé a iniciar sesión si cambió tu asignación.';
    }
    return '';
  });
  readonly coberturaValida = computed(() => {
    const paciente = this.pacienteSeleccionado();
    return !!paciente && idPositivo(paciente.id_cobertura) &&
      typeof paciente.cobertura_nombre === 'string' && paciente.cobertura_nombre.trim().length > 0;
  });

  readonly busqueda = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), (control) => {
      const texto = String(control.value).trim();
      return /^\d+$/.test(texto) && !/^\d{7,8}$/.test(texto) ? { dniInvalido: true } : null;
    }]
  });
  readonly formularioBusqueda = new FormGroup({ busqueda: this.busqueda });
  readonly formulario = new FormGroup({
    id_paciente: new FormControl<number | null>(null, [Validators.required, opcionDisponible(() => this.pacientes())]),
    hora: new FormControl({ value: '', disabled: true }, {
      nonNullable: true,
      validators: [Validators.required, horaAgendaValida, (control) =>
        !control.value || this.horarios().includes(control.value) ? null : { horarioInvalido: true }]
    }),
    nota: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(40)] })
  });

  ngOnInit(): void {
    this.consultas.pipe(
      switchMap((consulta) => {
        this.pacientes.set([]);
        this.total.set(0);
        this.cambiarPaciente();
        this.errorPacientes.set('');
        if (!consulta || this.errorContexto()) {
          this.cargandoPacientes.set(false);
          return EMPTY;
        }
        this.cargandoPacientes.set(true);
        const filtros: FiltrosPacientes = /^\d+$/.test(consulta.criterio)
          ? { dni: consulta.criterio, pagina: consulta.pagina }
          : { busqueda: consulta.criterio, pagina: consulta.pagina };
        return this.pacientesApi.listar(filtros).pipe(
          map((respuesta) => {
            const datos = respuesta.datos;
            if (!datos || !Array.isArray(datos.items) || !Number.isSafeInteger(datos.total) || datos.total < 0 ||
                datos.pagina !== consulta.pagina || datos.limite !== this.limite) throw new Error('Respuesta de pacientes inválida');
            return datos;
          }),
          catchError((error: unknown) => {
            this.errorPacientes.set(mensajeErrorApi(error, 'No se pudieron buscar los pacientes. Revisá la conexión y reintentá.'));
            return EMPTY;
          }),
          finalize(() => this.cargandoPacientes.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((datos) => {
      this.pacientes.set(datos.items);
      this.total.set(datos.total);
    });

    // Editar el criterio cancela la consulta anterior, pero no inicia otra hasta pulsar Buscar o Enter.
    this.busqueda.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.criterioActual.set(null);
      this.consultaRealizada.set(false);
      this.pagina.set(1);
      this.consultas.next(null);
    });

    this.recargaHorarios.pipe(
      startWith(undefined),
      switchMap(() => {
        this.formulario.controls.hora.reset('', { emitEvent: false });
        this.formulario.controls.hora.disable({ emitEvent: false });
        this.horarios.set([]);
        this.errorHorarios.set('');
        if (this.errorContexto()) {
          this.cargandoHorarios.set(false);
          return EMPTY;
        }
        this.cargandoHorarios.set(true);
        return this.medicosApi.listarHorariosDisponibles(
          this.agenda.id_medico, this.agenda.id_especialidad, this.agenda.id_sede, fechaCalendario(this.fecha)!
        ).pipe(
          map((respuesta) => {
            if (!Array.isArray(respuesta.datos)) throw new Error('Respuesta de horarios inválida');
            return [...new Set(respuesta.datos.filter((item) => item.id_agenda === this.agenda.id &&
              typeof item.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.hora))
              .map((item) => item.hora))].sort();
          }),
          catchError((error: unknown) => {
            this.errorHorarios.set(mensajeErrorApi(error, 'No se pudieron cargar los horarios libres. Reintentá la consulta.'));
            return of<string[]>([]);
          }),
          finalize(() => this.cargandoHorarios.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((horarios) => {
      this.horarios.set(horarios);
      if (horarios.length && !this.enviando() && !this.errorContexto()) this.formulario.controls.hora.enable({ emitEvent: false });
    });

    if (this.errorContexto()) {
      this.busqueda.disable({ emitEvent: false });
      this.formulario.disable({ emitEvent: false });
    }
  }

  buscar(pagina = 1): void {
    if (this.enviando() || this.errorContexto()) return;
    this.busqueda.markAsTouched();
    const criterio = this.busqueda.value.trim();
    if (this.busqueda.invalid || !criterio || !Number.isSafeInteger(pagina) || pagina <= 0 ||
        !Number.isSafeInteger((pagina - 1) * this.limite)) return;
    this.pagina.set(this.criterioActual() !== criterio ? 1 : pagina);
    this.criterioActual.set(criterio);
    this.consultaRealizada.set(true);
    this.consultas.next({ criterio, pagina: this.pagina() });
  }

  seleccionarPaciente(paciente: PacienteListado): void {
    if (this.enviando() || this.cargandoPacientes() || !idPositivo(paciente.id) ||
        !this.pacientes().some((item) => item.id === paciente.id)) return;
    this.formulario.controls.id_paciente.setValue(paciente.id);
    this.pacienteSeleccionado.set(paciente);
  }

  cambiarPaciente(): void {
    if (this.enviando()) return;
    this.pacienteSeleccionado.set(null);
    this.formulario.controls.id_paciente.reset(null, { emitEvent: false });
  }

  actualizarHorarios(): void {
    if (!this.enviando()) this.recargaHorarios.next();
  }

  confirmar(): void {
    this.formulario.markAllAsTouched();
    const paciente = this.pacienteSeleccionado();
    const valores = this.formulario.getRawValue();
    const usuario = this.session.obtenerUsuario();
    if (this.enviando() || !usuario || usuario.rol !== 'operador' || this.errorContexto() || this.formulario.invalid || !paciente ||
        paciente.id !== valores.id_paciente || !this.coberturaValida() || this.cargandoPacientes() ||
        this.cargandoHorarios() || this.errorHorarios() || !this.horarios().includes(valores.hora) ||
        !idPositivo(usuario.id_sede) || usuario.id_sede !== this.agenda.id_sede) return;

    const solicitud: SolicitudTurnoOperador = {
      id_paciente: paciente.id, id_medico: this.agenda.id_medico, id_especialidad: this.agenda.id_especialidad,
      id_sede: usuario.id_sede, fecha: fechaCalendario(this.fecha)!, hora: valores.hora, nota: valores.nota.trim()
    };
    this.enviando.set(true);
    this.errorReserva.set('');
    this.dialogRef.disableClose = true;
    this.busqueda.disable({ emitEvent: false });
    this.formulario.disable({ emitEvent: false });
    this.turnosApi.crear(solicitud).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.enviando.set(false);
        this.dialogRef.disableClose = false;
        this.errorReserva.set(mensajeErrorApi(error, 'No se pudo confirmar el turno. Revisá la conexión y reintentá.'));
        if (!this.errorContexto()) {
          this.busqueda.enable({ emitEvent: false });
          this.formulario.enable({ emitEvent: false });
          if (this.horarios().length === 0) this.formulario.controls.hora.disable({ emitEvent: false });
        }
        if (error instanceof HttpErrorResponse && error.status === 409) this.actualizarHorarios();
      }
    });
  }
}
