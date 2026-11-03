import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, EMPTY, finalize, map, Subject, switchMap, tap, throwError } from 'rxjs';

import { AgendaListado } from '../../../core/models/agenda.model';
import { FiltrosPacientes, PacienteListado } from '../../../core/models/paciente.model';
import { PacienteReserva, SolicitudTurno } from '../../../core/models/turno.model';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { PacienteService } from '../../../core/services/paciente.service';
import { SessionService } from '../../../core/services/session.service';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { fechaCalendario, leerFechaCalendario } from '../../shared/agenda/agenda-form.utils';
import {
  ContextoAgendaReserva, ReservaTurnoComponent
} from '../../shared/reserva-turno/reserva-turno.component';

const idPositivo = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0;

const TAMANO_PAGINA = 20;

@Component({
  selector: 'app-asignar-turno-dialog',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatProgressSpinnerModule, ReservaTurnoComponent
  ],
  templateUrl: './asignar-turno-dialog.component.html',
  styleUrl: './asignar-turno-dialog.component.css'
})
export class AsignarTurnoDialogComponent implements OnInit {
  readonly agenda = inject<AgendaListado>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AsignarTurnoDialogComponent, boolean>>(MatDialogRef);
  private readonly pacientesApi = inject(PacienteService);
  private readonly turnosApi = inject(TurnoService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly consultas = new Subject<{ criterio: string; pagina: number } | null>();

  readonly fecha = leerFechaCalendario(this.agenda.fecha);
  readonly entrada = this.agenda.hora_entrada.slice(0, 5);
  readonly salida = this.agenda.hora_salida.slice(0, 5);
  readonly contextoFijo: ContextoAgendaReserva = {
    idAgenda: this.agenda.id,
    idMedico: this.agenda.id_medico,
    idEspecialidad: this.agenda.id_especialidad,
    idSede: this.agenda.id_sede,
    fecha: fechaCalendario(this.fecha) ?? ''
  };
  readonly errorContexto = computed(() => {
    const formatoHora = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (![this.agenda.id, this.agenda.id_medico, this.agenda.id_especialidad, this.agenda.id_sede].every(idPositivo) ||
        !this.fecha || !this.contextoFijo.fecha || !formatoHora.test(this.entrada) ||
        !formatoHora.test(this.salida) || this.salida <= this.entrada) {
      return 'El rango de agenda no tiene un contexto válido. Cerrá el diálogo y actualizá la agenda.';
    }
    const usuario = this.session.obtenerUsuario();
    if (usuario?.rol !== 'operador' || !idPositivo(usuario.id_sede) || usuario.id_sede !== this.agenda.id_sede) {
      return 'Solo podés asignar turnos en tu sede registrada. Volvé a iniciar sesión si cambió tu asignación.';
    }
    return '';
  });
  readonly pacientes = signal<PacienteListado[]>([]);
  readonly pacienteSeleccionado = signal<PacienteListado | null>(null);
  readonly pacienteReserva = computed<PacienteReserva | null>(() => {
    const paciente = this.pacienteSeleccionado();
    if (!paciente || !idPositivo(paciente.id_cobertura) ||
        typeof paciente.cobertura_nombre !== 'string' || !paciente.cobertura_nombre.trim()) return null;
    return {
      id: paciente.id,
      nombre: paciente.nombre,
      apellido: paciente.apellido,
      cobertura: { id: paciente.id_cobertura, nombre: paciente.cobertura_nombre }
    };
  });
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly criterioActual = signal<string | null>(null);
  readonly consultaRealizada = signal(false);
  readonly cargandoPacientes = signal(false);
  readonly errorPacientes = signal('');
  readonly reservando = signal(false);
  readonly reservaConfirmada = signal(false);

  readonly busqueda = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), (control) => {
      const texto = String(control.value).trim();
      return /^\d+$/.test(texto) && !/^\d{7,8}$/.test(texto) ? { dniInvalido: true } : null;
    }]
  });
  readonly formularioBusqueda = new FormGroup({ busqueda: this.busqueda });
  readonly reservarTurno = (solicitud: SolicitudTurno) => {
    const paciente = this.pacienteReserva();
    const usuario = this.session.obtenerUsuario();
    if (!paciente || usuario?.rol !== 'operador' || usuario.id_sede !== this.agenda.id_sede) {
      return throwError(() => new Error('No se pudo validar el paciente o la sede del operador.'));
    }
    this.reservando.set(true);
    this.dialogRef.disableClose = true;
    return this.turnosApi.crear({ ...solicitud, id_paciente: paciente.id }).pipe(
      tap(() => {
        this.notificaciones.actualizar();
      }),
      finalize(() => {
        this.reservando.set(false);
        this.dialogRef.disableClose = false;
      })
    );
  };

  ngOnInit(): void {
    this.consultas.pipe(
      switchMap((consulta) => {
        this.pacientes.set([]);
        this.total.set(0);
        this.pacienteSeleccionado.set(null);
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
                datos.pagina !== consulta.pagina || datos.limite !== TAMANO_PAGINA) {
              throw new Error('La respuesta de búsqueda de pacientes no es válida.');
            }
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

    this.busqueda.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.criterioActual.set(null);
      this.consultaRealizada.set(false);
      this.pagina.set(1);
      this.consultas.next(null);
    });
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA));
  }

  buscar(pagina = 1): void {
    if (this.cargandoPacientes() || this.errorContexto()) return;
    this.busqueda.markAsTouched();
    const criterio = this.busqueda.value.trim();
    if (this.busqueda.invalid || !criterio || !Number.isSafeInteger(pagina) || pagina <= 0 ||
        !Number.isSafeInteger((pagina - 1) * TAMANO_PAGINA)) return;
    const paginaSolicitada = this.criterioActual() !== criterio ? 1 : pagina;
    this.pagina.set(paginaSolicitada);
    this.criterioActual.set(criterio);
    this.consultaRealizada.set(true);
    this.consultas.next({ criterio, pagina: paginaSolicitada });
  }

  seleccionarPaciente(paciente: PacienteListado): void {
    if (this.cargandoPacientes() || !idPositivo(paciente.id) ||
        !this.pacientes().some((item) => item.id === paciente.id)) return;
    this.pacienteSeleccionado.set(paciente);
  }

  cambiarPaciente(): void {
    this.pacienteSeleccionado.set(null);
  }

  reservaCreada(): void {
    this.reservaConfirmada.set(true);
  }

  cerrar(): void {
    this.dialogRef.close(true);
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
