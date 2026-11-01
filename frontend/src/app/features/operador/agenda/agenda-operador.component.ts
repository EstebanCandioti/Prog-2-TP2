import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, combineLatest, EMPTY, finalize, map, of, startWith, Subject, switchMap, takeUntil } from 'rxjs';

import { AgendaListado } from '../../../core/models/agenda.model';
import { Sede } from '../../../core/models/sede.model';
import { AgendaService } from '../../../core/services/agenda.service';
import { SedeService } from '../../../core/services/sede.service';
import { SessionService } from '../../../core/services/session.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import {
  AgendaFormDialogComponent, AgendaFormularioData, AgendaFormularioResultado
} from '../../shared/agenda/agenda-form-dialog.component';
import {
  fechaAgendaValida, fechaCalendario, FORMATOS_FECHA_AGENDA, leerFechaCalendario, opcionDisponible
} from '../../shared/agenda/agenda-form.utils';
import { AsignarTurnoDialogComponent } from './asignar-turno-dialog.component';
import { TurnosConfirmadosComponent } from './turnos-confirmados.component';

interface AgendaPorMedico {
  id: number;
  nombre: string;
  apellido: string;
  rangos: AgendaListado[];
}

@Component({
  selector: 'app-agenda-operador',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCardModule, MatDatepickerModule, MatDialogModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule,
    MatSnackBarModule, MatTableModule, MatTooltipModule, TurnosConfirmadosComponent
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
    provideNativeDateAdapter(FORMATOS_FECHA_AGENDA)
  ],
  templateUrl: './agenda-operador.component.html',
  styleUrl: './agenda-operador.component.css'
})
export class AgendaOperadorComponent implements OnInit, OnDestroy {
  private readonly agendasApi = inject(AgendaService);
  private readonly sedesApi = inject(SedeService);
  private readonly session = inject(SessionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recarga = new Subject<void>();
  private readonly recargaSedes = new Subject<void>();
  private formularioAbierto?: MatDialogRef<AgendaFormDialogComponent, AgendaFormularioResultado>;
  private asignacionAbierta?: MatDialogRef<AsignarTurnoDialogComponent, boolean>;

  readonly sedeOperador = computed(() => {
    const usuario = this.session.obtenerUsuario();
    const id = usuario?.id_sede;
    return usuario?.rol === 'operador' && typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  readonly sedes = signal<Sede[]>([]);
  readonly fecha = new FormControl<Date | null>(new Date(), [Validators.required, fechaAgendaValida]);
  readonly idSede = new FormControl<number | null>({ value: this.sedeOperador(), disabled: true }, [
    Validators.required, opcionDisponible(() => this.sedes())
  ]);
  readonly fechaMinima = new Date(1000, 0, 1);
  readonly fechaMaxima = new Date(9999, 11, 31);
  readonly fechaConsulta = signal<string | null>(null);
  readonly medicos = signal<AgendaPorMedico[]>([]);
  readonly abiertos = signal<ReadonlySet<number>>(new Set());
  readonly versionesTurnos = signal<Partial<Record<number, number>>>({});
  readonly cargando = signal(false);
  readonly cargandoSedes = signal(true);
  readonly error = signal('');
  readonly errorSedes = signal('');
  readonly dialogoAbierto = signal(false);
  readonly columnas = ['medico', 'rangos', 'acciones'];

  ngOnInit(): void {
    combineLatest([
      this.fecha.valueChanges.pipe(startWith(this.fecha.value)),
      this.idSede.valueChanges.pipe(startWith(this.idSede.value)),
      this.recarga.pipe(startWith(undefined))
    ]).pipe(
      switchMap(([fecha, idSede]) => {
        // Destruir los detalles también cancela sus consultas de turnos.
        this.abiertos.set(new Set());
        this.medicos.set([]);
        this.error.set('');
        const dia = fechaCalendario(fecha);
        this.fechaConsulta.set(dia);
        if (!dia || this.fecha.invalid || this.cargandoSedes() || !idSede || !this.sedeDisponible()) {
          this.cargando.set(false);
          return EMPTY;
        }
        this.cargando.set(true);
        return this.agendasApi.listar(dia, { id_sede: idSede }).pipe(
          map((respuesta) => {
            if (!Array.isArray(respuesta.datos)) throw new Error('Respuesta de agendas inválida');
            return respuesta.datos;
          }),
          catchError((error: unknown) => {
            this.error.set(mensajeErrorApi(error, 'No se pudieron cargar las agendas. Revisá la conexión y reintentá.'));
            return of<AgendaListado[]>([]);
          }),
          finalize(() => this.cargando.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((agendas) => this.medicos.set(this.agrupar(agendas)));

    this.recargaSedes.pipe(
      startWith(undefined),
      switchMap(() => {
        this.cargandoSedes.set(true);
        this.errorSedes.set('');
        this.idSede.disable({ emitEvent: false });
        this.recargar();
        return this.sedesApi.listar().pipe(
          map((respuesta) => {
            if (!Array.isArray(respuesta.datos)) throw new Error('Respuesta de sedes inválida');
            return respuesta.datos;
          }),
          catchError((error: unknown) => {
            this.errorSedes.set(mensajeErrorApi(error, 'No se pudieron cargar las sedes. Reintentá la carga.'));
            return EMPTY;
          }),
          finalize(() => this.cargandoSedes.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((sedes) => {
      this.sedes.set(sedes);
      this.cargandoSedes.set(false);
      this.idSede.enable();
    });
  }

  ngOnDestroy(): void {
    this.formularioAbierto?.close();
    this.asignacionAbierta?.close();
  }

  recargar(): void {
    this.recarga.next();
  }

  cargarSedes(): void {
    this.recargaSedes.next();
  }

  sedeDisponible(): boolean {
    return this.sedes().some((sede) => sede.id === this.idSede.value);
  }

  sedeAsignadaValida(): boolean {
    return this.sedeOperador() !== null && this.sedes().some((sede) => sede.id === this.sedeOperador());
  }

  puedeGestionar(): boolean {
    return !this.cargandoSedes() && !this.errorSedes() && this.sedeAsignadaValida() &&
      this.idSede.value === this.sedeOperador() && this.fecha.valid;
  }

  alternarTurnos(medico: AgendaPorMedico): void {
    if (!this.puedeGestionar() || this.dialogoAbierto()) return;
    const abiertos = new Set(this.abiertos());
    if (abiertos.has(medico.id)) abiertos.delete(medico.id);
    else abiertos.add(medico.id);
    this.abiertos.set(abiertos);
  }

  abrirFormulario(medico: AgendaPorMedico | null = null): void {
    if (!this.puedeGestionar() || this.dialogoAbierto()) return;
    const fecha = fechaCalendario(this.fecha.value);
    if (!fecha) return;
    this.dialogoAbierto.set(true);
    const referencia = this.dialog.open<AgendaFormDialogComponent, AgendaFormularioData, AgendaFormularioResultado>(
      AgendaFormDialogComponent,
      {
        width: '680px', maxWidth: 'calc(100vw - 24px)', maxHeight: '90vh',
        data: {
          modo: 'operador', gestionarRangos: medico !== null, idMedico: medico?.id ?? null,
          idSedeInicial: this.sedeOperador(), fecha, agenda: null
        }
      }
    );
    this.formularioAbierto = referencia;
    referencia.componentInstance.cambiosGuardados.pipe(
      takeUntil(referencia.afterClosed()), takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.recargar());
    referencia.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      this.dialogoAbierto.set(false);
      this.formularioAbierto = undefined;
      if (!resultado) return;
      this.snackBar.open('Agenda creada correctamente.', 'Cerrar', {
        duration: 4000, panelClass: ['app-snackbar', 'app-snackbar-success']
      });
      // Los filtros se conservan, aunque el alta se haya hecho para otra fecha.
      this.recargar();
    });
  }

  asignarTurno(agenda: AgendaListado): void {
    if (!this.puedeGestionar() || this.dialogoAbierto() || agenda.id_sede !== this.sedeOperador()) return;
    const fecha = fechaCalendario(this.fecha.value);
    if (!fecha || fechaCalendario(leerFechaCalendario(agenda.fecha)) !== fecha ||
        !this.medicos().some((medico) => medico.rangos.some((rango) => rango.id === agenda.id))) return;

    this.dialogoAbierto.set(true);
    const referencia = this.dialog.open<AsignarTurnoDialogComponent, AgendaListado, boolean>(
      AsignarTurnoDialogComponent,
      { width: '680px', maxWidth: 'calc(100vw - 24px)', maxHeight: '90vh', data: { ...agenda, fecha } }
    );
    this.asignacionAbierta = referencia;
    referencia.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((creado) => {
      this.dialogoAbierto.set(false);
      this.asignacionAbierta = undefined;
      if (!creado) return;
      this.snackBar.open('Turno asignado correctamente.', 'Cerrar', {
        duration: 4000, panelClass: ['app-snackbar', 'app-snackbar-success']
      });
      if (this.idSede.value === agenda.id_sede && fechaCalendario(this.fecha.value) === fecha) {
        // Refrescar solo los turnos del médico, sin reconstruir filas ni cerrar sus detalles.
        this.versionesTurnos.update((versiones) => ({
          ...versiones, [agenda.id_medico]: (versiones[agenda.id_medico] ?? 0) + 1
        }));
      }
    });
  }

  private agrupar(agendas: AgendaListado[]): AgendaPorMedico[] {
    const grupos = new Map<number, AgendaPorMedico>();
    for (const agenda of [...agendas].sort((a, b) => a.hora_entrada.localeCompare(b.hora_entrada) || a.id - b.id)) {
      let medico = grupos.get(agenda.id_medico);
      if (!medico) {
        medico = { id: agenda.id_medico, nombre: agenda.medico_nombre, apellido: agenda.medico_apellido, rangos: [] };
        grupos.set(medico.id, medico);
      }
      medico.rangos.push(agenda);
    }
    return [...grupos.values()].sort((a, b) => a.apellido.localeCompare(b.apellido) ||
      a.nombre.localeCompare(b.nombre) || a.id - b.id);
  }
}
