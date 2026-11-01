import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { Agenda, AgendaRequest } from '../../../core/models/agenda.model';
import { Sede } from '../../../core/models/sede.model';
import { AgendaService } from '../../../core/services/agenda.service';
import { SedeService } from '../../../core/services/sede.service';
import { SessionService } from '../../../core/services/session.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';

interface MedicoAgenda {
  id: number;
  nombre: string;
  apellido: string;
}

@Component({
  selector: 'app-agenda-operador',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    ReactiveFormsModule
  ],
  templateUrl: './agenda-operador.component.html',
  styleUrl: './agenda-operador.component.css'
})
export class AgendaOperadorComponent implements OnInit {
  private readonly agendaApi = inject(AgendaService);
  private readonly sedesApi = inject(SedeService);
  private readonly session = inject(SessionService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly fechaSeleccionada = signal(this.fechaLocalActual());
  readonly sedeSeleccionada = signal<number | null>(this.session.obtenerUsuario()?.id_sede ?? null);
  readonly sedePropiaId = signal<number | null>(this.session.obtenerUsuario()?.id_sede ?? null);
  readonly agendas = signal<Agenda[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly cargando = signal(false);
  readonly cargandoSedes = signal(false);
  readonly guardando = signal(false);
  readonly eliminandoId = signal<number | null>(null);
  readonly formularioVisible = signal(false);
  readonly agendaEnEdicion = signal<Agenda | null>(null);
  readonly error = signal('');
  readonly errorSedes = signal('');
  readonly errorFormulario = signal('');

  readonly medicos = computed(() => {
    const opciones = new Map<number, MedicoAgenda>();
    for (const agenda of this.agendas()) {
      if (!agenda.medico_nombre || !agenda.medico_apellido) continue;
      opciones.set(agenda.id_medico, {
        id: agenda.id_medico,
        nombre: agenda.medico_nombre,
        apellido: agenda.medico_apellido
      });
    }
    return [...opciones.values()].sort((a, b) =>
      `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`)
    );
  });

  readonly agendasVisibles = computed(() =>
    this.agendas()
      .filter((agenda) => {
        const coincideFecha = agenda.fecha.slice(0, 10) === this.fechaSeleccionada();
        const coincideSede =
          this.sedeSeleccionada() === null || agenda.id_sede === this.sedeSeleccionada();
        return coincideFecha && coincideSede;
      })
      .sort(
        (a, b) =>
          (a.medico_apellido ?? '').localeCompare(b.medico_apellido ?? '') ||
          a.hora_entrada.localeCompare(b.hora_entrada)
      )
  );

  especialidadesMedico(): Array<{ id: number; descripcion: string }> {
    const idMedico = this.formulario.controls.idMedico.value;
    if (idMedico === null) return [];
    const especialidades = new Map<number, string>();
    for (const agenda of this.agendas()) {
      if (agenda.id_medico !== idMedico) continue;
      especialidades.set(
        agenda.id_especialidad,
        agenda.especialidad_descripcion ?? `Especialidad #${agenda.id_especialidad}`
      );
    }
    return [...especialidades].map(([id, descripcion]) => ({ id, descripcion }));
  }

  readonly formulario = this.formBuilder.nonNullable.group({
    idMedico: this.formBuilder.control<number | null>(null, Validators.required),
    idEspecialidad: this.formBuilder.control<number | null>(null, Validators.required),
    fecha: ['', Validators.required],
    horaEntrada: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    horaSalida: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]]
  });

  ngOnInit(): void {
    this.cargarSedes();
    this.cargarAgendas();
  }

  cambiarFecha(event: Event): void {
    const fecha = (event.target as HTMLInputElement).value;
    if (!fecha) return;
    this.fechaSeleccionada.set(fecha);
  }

  cambiarSede(idSede: number | null): void {
    this.sedeSeleccionada.set(idSede);
  }

  cambiarMedico(idMedico: number | null): void {
    this.formulario.controls.idEspecialidad.setValue(null);
    this.formulario.controls.idEspecialidad.markAsUntouched();
    if (idMedico === null) return;
    const existentes = this.agendas()
      .filter((agenda) => agenda.id_medico === idMedico)
      .map((agenda) => agenda.id_especialidad);
    if (existentes.length === 1) {
      this.formulario.controls.idEspecialidad.setValue(existentes[0]);
    }
  }

  nuevaAgenda(): void {
    if (!this.tieneSedeAsignada()) return;
    this.agendaEnEdicion.set(null);
    this.errorFormulario.set('');
    this.formulario.reset({
      idMedico: null,
      idEspecialidad: null,
      fecha: this.fechaSeleccionada(),
      horaEntrada: '',
      horaSalida: ''
    });
    this.formularioVisible.set(true);
  }

  editarAgenda(agenda: Agenda): void {
    if (!this.esSedePropia(agenda)) return;
    this.agendaEnEdicion.set(agenda);
    this.errorFormulario.set('');
    this.formulario.reset({
      idMedico: agenda.id_medico,
      idEspecialidad: agenda.id_especialidad,
      fecha: agenda.fecha.slice(0, 10),
      horaEntrada: agenda.hora_entrada.slice(0, 5),
      horaSalida: agenda.hora_salida.slice(0, 5)
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
    if (!this.tieneSedeAsignada()) {
      this.errorFormulario.set('Tu usuario no tiene una sede asignada.');
      return;
    }
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    const valores = this.formulario.getRawValue();
    if (valores.horaSalida <= valores.horaEntrada) {
      this.errorFormulario.set('La hora de salida debe ser posterior a la hora de entrada.');
      return;
    }
    if (valores.idMedico === null || valores.idEspecialidad === null) {
      this.errorFormulario.set('Seleccioná un médico y una especialidad.');
      return;
    }

    const datos: AgendaRequest = {
      fecha: valores.fecha,
      hora_entrada: valores.horaEntrada,
      hora_salida: valores.horaSalida,
      id_medico: valores.idMedico,
      id_especialidad: valores.idEspecialidad,
      id_sede: this.session.obtenerUsuario()!.id_sede!
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
        this.sedeSeleccionada.set(datos.id_sede);
        this.formularioVisible.set(false);
        this.agendaEnEdicion.set(null);
        this.snackBar.open(
          agendaActual ? 'Agenda actualizada correctamente.' : 'Agenda creada correctamente.',
          'Cerrar',
          { duration: 3500 }
        );
        this.cargarAgendas();
      },
      error: (error: unknown) =>
        this.errorFormulario.set(mensajeErrorApi(error, 'No se pudo guardar la agenda.'))
    });
  }

  eliminarAgenda(agenda: Agenda): void {
    if (!this.esSedePropia(agenda) || this.eliminandoId() !== null) return;
    if (
      !window.confirm(
        `¿Está seguro de eliminar la agenda de ${agenda.medico_nombre} ${agenda.medico_apellido} del ${this.formatearFecha(agenda.fecha)} (${agenda.hora_entrada.slice(0, 5)}–${agenda.hora_salida.slice(0, 5)})?`
      )
    ) {
      return;
    }
    this.eliminandoId.set(agenda.id);
    this.agendaApi
      .eliminar(agenda.id)
      .pipe(finalize(() => this.eliminandoId.set(null)))
      .subscribe({
        next: () => {
          this.snackBar.open('Rango horario eliminado.', 'Cerrar', { duration: 3500 });
          this.cargarAgendas();
        },
        error: (error: unknown) =>
          this.snackBar.open(
            mensajeErrorApi(error, 'No se pudo eliminar el rango horario.'),
            'Cerrar',
            { duration: 6000 }
          )
      });
  }

  cargarAgendas(): void {
    this.cargando.set(true);
    this.error.set('');
    this.agendaApi
      .listarOperador()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!Array.isArray(respuesta.datos)) {
            this.error.set('La respuesta del servidor no contiene las agendas.');
            return;
          }
          this.agendas.set(respuesta.datos);
        },
        error: (error: unknown) =>
          this.error.set(mensajeErrorApi(error, 'No se pudieron cargar las agendas.'))
      });
  }

  nombreSede(idSede: number): string {
    return this.sedes().find((sede) => sede.id === idSede)?.nombre ?? `Sede #${idSede}`;
  }

  formatearFecha(fecha: string): string {
    const [anio, mes, dia] = fecha.slice(0, 10).split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
  }

  tieneSedeAsignada(): boolean {
    const idSede = this.session.obtenerUsuario()?.id_sede;
    return typeof idSede === 'number' && Number.isSafeInteger(idSede) && idSede > 0;
  }

  esSedePropia(agenda: Agenda): boolean {
    return agenda.id_sede === this.session.obtenerUsuario()?.id_sede;
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
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${ahora.getFullYear()}-${mes}-${dia}`;
  }
}
