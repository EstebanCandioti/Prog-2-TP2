import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';

import { Agenda, AgendaRequest } from '../../../core/models/agenda.model';
import { Sede } from '../../../core/models/sede.model';
import { AgendaService } from '../../../core/services/agenda.service';
import { SedeService } from '../../../core/services/sede.service';
import { SessionService } from '../../../core/services/session.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { ConfirmacionDialogComponent } from '../../shared/confirmacion-dialog.component';

@Component({
  selector: 'app-agenda-medico',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    ReactiveFormsModule
  ],
  templateUrl: './agenda-medico.component.html',
  styleUrl: './agenda-medico.component.css'
})
export class AgendaMedicoComponent implements OnInit {
  private readonly agendaApi = inject(AgendaService);
  private readonly sedesApi = inject(SedeService);
  private readonly session = inject(SessionService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly fechaSeleccionada = signal(this.fechaLocalActual());
  readonly agendas = signal<Agenda[]>([]);
  readonly todasLasAgendas = signal<Agenda[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly cargando = signal(false);
  readonly cargandoSedes = signal(false);
  readonly formularioVisible = signal(false);
  readonly guardando = signal(false);
  readonly eliminandoId = signal<number | null>(null);
  readonly error = signal('');
  readonly errorSedes = signal('');
  readonly errorFormulario = signal('');
  readonly agendaEnEdicion = signal<Agenda | null>(null);
  readonly columnas = ['horario', 'especialidad', 'sede', 'acciones'];

  readonly formulario = this.formBuilder.nonNullable.group({
    fecha: ['', Validators.required],
    horaEntrada: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    horaSalida: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    idEspecialidad: this.formBuilder.control<number | null>(null, Validators.required),
    idSede: this.formBuilder.control<number | null>(null, Validators.required)
  });

  readonly especialidadesDisponibles = computed(() => {
    const especialidades = new Map<number, string>();
    for (const agenda of this.todasLasAgendas()) {
      especialidades.set(
        agenda.id_especialidad,
        agenda.especialidad_descripcion ?? `Especialidad #${agenda.id_especialidad}`
      );
    }
    return [...especialidades].map(([id, descripcion]) => ({ id, descripcion }));
  });

  ngOnInit(): void {
    this.cargarSedes();
    this.cargarAgenda();
  }

  cambiarFecha(event: Event): void {
    const fecha = (event.target as HTMLInputElement).value;
    if (!fecha) return;
    this.fechaSeleccionada.set(fecha);
    this.cargarAgenda();
  }

  cargarAgenda(): void {
    this.cargando.set(true);
    this.error.set('');

    this.agendaApi
      .listarPropia()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!Array.isArray(respuesta.datos)) {
            this.error.set('La respuesta del servidor no contiene el listado de agenda.');
            return;
          }
          this.todasLasAgendas.set(respuesta.datos);
          this.agendas.set(
            respuesta.datos
              .filter((agenda) => agenda.fecha.slice(0, 10) === this.fechaSeleccionada())
              .sort((a, b) => a.hora_entrada.localeCompare(b.hora_entrada))
          );
        },
        error: (error: unknown) => {
          this.error.set(mensajeErrorApi(error, 'No se pudo cargar tu agenda.'));
        }
      });
  }

  nuevaAgenda(): void {
    const usuario = this.session.obtenerUsuario();
    this.agendaEnEdicion.set(null);
    this.errorFormulario.set('');
    this.formulario.reset({
      fecha: this.fechaSeleccionada(),
      horaEntrada: '',
      horaSalida: '',
      idEspecialidad: null,
      idSede: usuario?.id_sede ?? null
    });
    this.formularioVisible.set(true);
  }

  editarAgenda(agenda: Agenda): void {
    this.agendaEnEdicion.set(agenda);
    this.errorFormulario.set('');
    this.formulario.reset({
      fecha: agenda.fecha.slice(0, 10),
      horaEntrada: agenda.hora_entrada.slice(0, 5),
      horaSalida: agenda.hora_salida.slice(0, 5),
      idEspecialidad: agenda.id_especialidad,
      idSede: agenda.id_sede
    });
    this.formularioVisible.set(true);
  }

  cancelarFormulario(): void {
    if (this.guardando()) return;
    this.formularioVisible.set(false);
    this.agendaEnEdicion.set(null);
    this.errorFormulario.set('');
  }

  guardarAgenda(): void {
    this.errorFormulario.set('');
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    if (valores.horaSalida <= valores.horaEntrada) {
      this.errorFormulario.set('La hora de salida debe ser posterior a la hora de entrada.');
      return;
    }
    const idMedico = this.session.obtenerUsuario()?.id;
    if (!idMedico) {
      this.errorFormulario.set('No se pudo identificar al médico autenticado.');
      return;
    }
    if (valores.idEspecialidad === null || valores.idSede === null) {
      this.errorFormulario.set('Seleccioná una especialidad y una sede.');
      return;
    }

    const datos: AgendaRequest = {
      fecha: valores.fecha,
      hora_entrada: valores.horaEntrada,
      hora_salida: valores.horaSalida,
      id_medico: idMedico,
      id_especialidad: valores.idEspecialidad,
      id_sede: valores.idSede
    };
    const agendaActual = this.agendaEnEdicion();
    this.guardando.set(true);
    const operacion = agendaActual
      ? this.agendaApi.actualizar(agendaActual.id, datos)
      : this.agendaApi.crear(datos);

    operacion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (respuesta) => {
        if (!respuesta.datos) {
          this.errorFormulario.set('La respuesta del servidor no contiene la agenda guardada.');
          return;
        }
        this.fechaSeleccionada.set(valores.fecha);
        this.formularioVisible.set(false);
        this.agendaEnEdicion.set(null);
        this.snackBar.open(
          agendaActual ? 'Rango horario actualizado.' : 'Rango horario creado.',
          'Cerrar',
          { duration: 3500 }
        );
        this.cargarAgenda();
      },
      error: (error: unknown) =>
        this.errorFormulario.set(
          mensajeErrorApi(error, 'No se pudo guardar el rango horario.')
        )
    });
  }

  eliminarAgenda(agenda: Agenda): void {
    if (this.eliminandoId() !== null) return;
    this.dialog.open<ConfirmacionDialogComponent, { titulo: string; mensaje: string }, boolean>(
      ConfirmacionDialogComponent,
      {
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
        data: {
          titulo: 'Eliminar rango horario',
          mensaje: `¿Está seguro de eliminar el rango ${agenda.hora_entrada.slice(0, 5)}–${agenda.hora_salida.slice(0, 5)} del ${this.formatearFecha(agenda.fecha)}?`
        }
      }
    ).afterClosed().subscribe((confirmada) => {
      if (!confirmada) return;
      this.eliminandoId.set(agenda.id);
      this.agendaApi
        .eliminar(agenda.id)
        .pipe(finalize(() => this.eliminandoId.set(null)))
        .subscribe({
          next: () => {
            this.snackBar.open('Rango horario eliminado.', 'Cerrar', { duration: 3500 });
            this.cargarAgenda();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              mensajeErrorApi(error, 'No se pudo eliminar el rango horario.'),
              'Cerrar',
              { duration: 6000 }
            )
        });
    });
  }

  nombreSede(idSede: number): string {
    return this.sedes().find((sede) => sede.id === idSede)?.nombre ?? `Sede #${idSede}`;
  }

  formatearFecha(fecha: string): string {
    const [anio, mes, dia] = fecha.slice(0, 10).split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
  }

  private cargarSedes(): void {
    this.cargandoSedes.set(true);
    this.errorSedes.set('');
    this.sedesApi
      .listar()
      .pipe(finalize(() => this.cargandoSedes.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!Array.isArray(respuesta.datos)) {
            this.errorSedes.set('La respuesta del servidor no contiene las sedes.');
            return;
          }
          this.sedes.set(respuesta.datos);
        },
        error: (error: unknown) =>
          this.errorSedes.set(mensajeErrorApi(error, 'No se pudieron cargar las sedes.'))
      });
  }

  private fechaLocalActual(): string {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
}
