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

import { Agenda } from '../../../core/models/agenda.model';
import { Sede } from '../../../core/models/sede.model';
import { PacienteBusqueda } from '../../../core/models/usuario-admin.model';
import {
  BloqueDisponible,
  CrearTurnoRequest,
  TurnoMedico
} from '../../../core/models/turno.model';
import { AgendaService } from '../../../core/services/agenda.service';
import { DisponibilidadService } from '../../../core/services/disponibilidad.service';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { SessionService } from '../../../core/services/session.service';
import { SedeService } from '../../../core/services/sede.service';
import { TurnoService } from '../../../core/services/turno.service';
import { UsuarioAdminService } from '../../../core/services/usuario-admin.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';

interface MedicoDisponible {
  id: number;
  nombre: string;
  apellido: string;
}

@Component({
  selector: 'app-turnos-operador',
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
  templateUrl: './turnos-operador.component.html',
  styleUrl: './turnos-operador.component.css'
})
export class TurnosOperadorComponent implements OnInit {
  private readonly turnosApi = inject(TurnoService);
  private readonly agendasApi = inject(AgendaService);
  private readonly disponibilidadApi = inject(DisponibilidadService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly pacientesApi = inject(UsuarioAdminService);
  private readonly sedesApi = inject(SedeService);
  private readonly session = inject(SessionService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly fechaSeleccionada = signal(this.fechaLocalActual());
  readonly idMedicoSeleccionado = signal<number | null>(null);
  readonly estadoSeleccionado = signal('');
  readonly turnos = signal<TurnoMedico[]>([]);
  readonly agendasSede = signal<Agenda[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly medicos = computed(() => {
    const opciones = new Map<number, MedicoDisponible>();
    for (const agenda of this.agendasSede()) {
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
  especialidadesDisponibles(): Array<{ id: number; descripcion: string }> {
    const idMedico = this.formularioTurno.controls.idMedico.value;
    if (idMedico === null) return [];
    const especialidades = new Map<number, string>();
    for (const agenda of this.agendasSede()) {
      if (agenda.id_medico !== idMedico) continue;
      especialidades.set(
        agenda.id_especialidad,
        agenda.especialidad_descripcion ?? `Especialidad #${agenda.id_especialidad}`
      );
    }
    return [...especialidades].map(([id, descripcion]) => ({ id, descripcion }));
  }
  readonly cargando = signal(false);
  readonly cargandoAgendas = signal(false);
  readonly cargandoPacientes = signal(false);
  readonly cargandoFechas = signal(false);
  readonly cargandoHorarios = signal(false);
  readonly guardandoId = signal<number | null>(null);
  readonly guardandoTurno = signal(false);
  readonly cancelandoId = signal<number | null>(null);
  readonly mostrarFormulario = signal(false);
  readonly pacientesEncontrados = signal<PacienteBusqueda[]>([]);
  readonly pacienteSeleccionado = signal<PacienteBusqueda | null>(null);
  readonly paginaPacientes = signal(1);
  readonly totalPacientes = signal(0);
  readonly limitePacientes = signal(20);
  readonly totalPaginasPacientes = computed(() =>
    Math.max(1, Math.ceil(this.totalPacientes() / this.limitePacientes()))
  );
  readonly rangoPacientes = computed(() => {
    const total = this.totalPacientes();
    if (total === 0) return '0 resultados';
    const desde = (this.paginaPacientes() - 1) * this.limitePacientes() + 1;
    const hasta = Math.min(this.paginaPacientes() * this.limitePacientes(), total);
    return `${desde}–${hasta} de ${total}`;
  });
  readonly fechasDisponibles = signal<string[]>([]);
  readonly horariosDisponibles = signal<BloqueDisponible[]>([]);
  readonly error = signal('');
  readonly errorAgendas = signal('');
  readonly errorSedes = signal('');
  readonly errorPacientes = signal('');
  readonly errorDisponibilidad = signal('');
  readonly errorFormulario = signal('');

  readonly formularioPaciente = this.formBuilder.nonNullable.group({
    busqueda: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]]
  });
  readonly formularioTurno = this.formBuilder.group({
    idMedico: this.formBuilder.control<number | null>(null, Validators.required),
    idEspecialidad: this.formBuilder.control<number | null>(null, Validators.required),
    fecha: this.formBuilder.nonNullable.control('', Validators.required),
    hora: this.formBuilder.nonNullable.control('', Validators.required),
    nota: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(255)
    ])
  });

  ngOnInit(): void {
    this.cargarAgendasSede();
    this.cargarSedes();
    this.cargarTurnos();
  }

  cambiarFecha(event: Event): void {
    const fecha = (event.target as HTMLInputElement).value;
    if (!fecha) return;
    this.fechaSeleccionada.set(fecha);
    this.cargarTurnos();
  }

  cambiarMedicoFiltro(idMedico: number | null): void {
    this.idMedicoSeleccionado.set(idMedico);
    this.cargarTurnos();
  }

  cambiarEstado(estado: string): void {
    this.estadoSeleccionado.set(estado);
    this.cargarTurnos();
  }

  cargarTurnos(): void {
    if (!this.tieneSedeAsignada()) {
      this.error.set('Tu usuario no tiene una sede asignada.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.turnosApi
      .listarTurnosOperador(
        this.fechaSeleccionada(),
        this.idMedicoSeleccionado() ?? undefined,
        this.estadoSeleccionado() || undefined
      )
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!Array.isArray(respuesta.datos)) {
            this.error.set('La respuesta del servidor no contiene los turnos.');
            return;
          }
          this.turnos.set(respuesta.datos);
        },
        error: (error: unknown) =>
          this.error.set(mensajeErrorApi(error, 'No se pudieron cargar los turnos de la sede.'))
      });
  }

  abrirAsignacion(): void {
    if (!this.tieneSedeAsignada()) return;
    this.mostrarFormulario.set(true);
    this.errorFormulario.set('');
    this.formularioPaciente.reset({ busqueda: '' });
    this.formularioTurno.reset({
      idMedico: null,
      idEspecialidad: null,
      fecha: '',
      hora: '',
      nota: ''
    });
    this.pacienteSeleccionado.set(null);
    this.pacientesEncontrados.set([]);
    this.paginaPacientes.set(1);
    this.totalPacientes.set(0);
    this.fechasDisponibles.set([]);
    this.horariosDisponibles.set([]);
  }

  cerrarAsignacion(): void {
    if (this.guardandoTurno()) return;
    this.mostrarFormulario.set(false);
    this.errorFormulario.set('');
  }

  buscarPacientes(pagina = 1): void {
    this.errorPacientes.set('');
    if (this.formularioPaciente.invalid || this.cargandoPacientes()) {
      this.formularioPaciente.markAllAsTouched();
      return;
    }
    const termino = this.formularioPaciente.controls.busqueda.value.trim();
    const esDni = /^\d{7,8}$/.test(termino);
    if (/^\d+$/.test(termino) && !esDni) {
      this.errorPacientes.set('Para buscar por DNI, ingresá sus 7 u 8 dígitos completos.');
      return;
    }
    this.pacienteSeleccionado.set(null);
    this.pacientesEncontrados.set([]);
    this.totalPacientes.set(0);
    this.cargandoPacientes.set(true);
    this.pacientesApi
      .listarPacientes({
        busqueda: esDni ? undefined : termino,
        dni: esDni ? termino : undefined,
        pagina
      })
      .pipe(finalize(() => this.cargandoPacientes.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!Array.isArray(respuesta.datos?.items)) {
            this.errorPacientes.set('La respuesta del servidor no contiene pacientes.');
            return;
          }
          const listado = respuesta.datos;
          this.pacientesEncontrados.set(listado.items);
          this.paginaPacientes.set(listado.pagina);
          this.totalPacientes.set(listado.total);
          this.limitePacientes.set(listado.limite);
          if (respuesta.datos.items.length === 0) {
            this.errorPacientes.set('No se encontraron pacientes con ese criterio.');
          }
        },
        error: (error: unknown) =>
          this.errorPacientes.set(mensajeErrorApi(error, 'No se pudieron buscar pacientes.'))
      });
  }

  cambiarPaginaPacientes(pagina: number): void {
    if (
      pagina < 1 ||
      pagina > this.totalPaginasPacientes() ||
      pagina === this.paginaPacientes() ||
      this.cargandoPacientes()
    ) {
      return;
    }
    this.buscarPacientes(pagina);
  }

  seleccionarPaciente(paciente: PacienteBusqueda): void {
    this.pacienteSeleccionado.set(paciente);
    this.errorFormulario.set('');
  }

  seleccionarPacientePorId(idPaciente: number | null): void {
    const paciente = this.pacientesEncontrados().find((opcion) => opcion.id === idPaciente);
    if (paciente) this.seleccionarPaciente(paciente);
  }

  cambiarMedico(idMedico: number | null): void {
    this.formularioTurno.controls.idEspecialidad.setValue(null);
    this.formularioTurno.controls.fecha.setValue('');
    this.formularioTurno.controls.hora.setValue('');
    this.fechasDisponibles.set([]);
    this.horariosDisponibles.set([]);
    this.errorDisponibilidad.set('');
    if (idMedico === null) return;
    const especialidades = this.especialidadesDisponibles().map((especialidad) => especialidad.id);
    if (especialidades.length === 1) {
      this.formularioTurno.controls.idEspecialidad.setValue(especialidades[0]);
      this.cargarFechas(idMedico, especialidades[0]);
    }
  }

  cambiarEspecialidad(idEspecialidad: number | null): void {
    const idMedico = this.formularioTurno.controls.idMedico.value;
    this.formularioTurno.controls.fecha.setValue('');
    this.formularioTurno.controls.hora.setValue('');
    this.fechasDisponibles.set([]);
    this.horariosDisponibles.set([]);
    this.errorDisponibilidad.set('');
    if (idMedico !== null && idEspecialidad !== null) {
      this.cargarFechas(idMedico, idEspecialidad);
    }
  }

  cambiarFechaTurno(fecha: string): void {
    this.formularioTurno.controls.fecha.setValue(fecha);
    this.formularioTurno.controls.hora.setValue('');
    this.horariosDisponibles.set([]);
    const idMedico = this.formularioTurno.controls.idMedico.value;
    const idEspecialidad = this.formularioTurno.controls.idEspecialidad.value;
    const idSede = this.session.obtenerUsuario()?.id_sede;
    if (idMedico !== null && idEspecialidad !== null && idSede) {
      this.cargarHorarios(idMedico, idEspecialidad, idSede, fecha);
    }
  }

  guardarTurno(): void {
    this.errorFormulario.set('');
    if (!this.pacienteSeleccionado()) {
      this.errorFormulario.set('Buscá y seleccioná un paciente.');
      return;
    }
    if (this.formularioTurno.invalid || this.guardandoTurno()) {
      this.formularioTurno.markAllAsTouched();
      return;
    }
    const valores = this.formularioTurno.getRawValue();
    const idSede = this.session.obtenerUsuario()?.id_sede;
    if (valores.idMedico === null || valores.idEspecialidad === null || !idSede) {
      this.errorFormulario.set('Seleccioná médico, especialidad, fecha y horario disponibles.');
      return;
    }
    const datos: CrearTurnoRequest = {
      id_paciente: this.pacienteSeleccionado()!.id,
      id_medico: valores.idMedico,
      id_especialidad: valores.idEspecialidad,
      id_sede: idSede,
      fecha: valores.fecha,
      hora: valores.hora,
      nota: valores.nota.trim()
    };
    this.guardandoTurno.set(true);
    this.turnosApi
      .crear(datos)
      .pipe(finalize(() => this.guardandoTurno.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.datos) {
            this.errorFormulario.set('La respuesta del servidor no contiene el turno creado.');
            return;
          }
          this.mostrarFormulario.set(false);
          this.snackBar.open('Turno asignado correctamente.', 'Cerrar', { duration: 4000 });
          this.cargarTurnos();
          this.notificaciones.actualizar();
        },
        error: (error: unknown) =>
          this.errorFormulario.set(mensajeErrorApi(error, 'No se pudo asignar el turno.'))
      });
  }

  cancelarTurno(turno: TurnoMedico): void {
    if (turno.estado !== 'confirmado' || this.guardandoId() !== null) return;
    if (
      !window.confirm(
        `¿Querés cancelar el turno de ${turno.paciente_nombre} ${turno.paciente_apellido} del ${this.formatearFecha(turno.fecha)} a las ${turno.hora}?`
      )
    ) {
      return;
    }
    this.guardandoId.set(turno.id);
    this.cancelandoId.set(turno.id);
    this.turnosApi
      .cancelar(turno.id)
      .pipe(finalize(() => {
        this.guardandoId.set(null);
        this.cancelandoId.set(null);
      }))
      .subscribe({
        next: () => {
          this.snackBar.open('Turno cancelado correctamente.', 'Cerrar', { duration: 4000 });
          this.cargarTurnos();
          this.notificaciones.actualizar();
        },
        error: (error: unknown) =>
          this.snackBar.open(
            mensajeErrorApi(error, 'No se pudo cancelar el turno.'),
            'Cerrar',
            { duration: 6000 }
          )
      });
  }

  calcularEdad(fechaNacimiento: string | null): string {
    if (!fechaNacimiento) return '—';
    const [anio, mes, dia] = fechaNacimiento.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return '—';
    const nacimiento = new Date(anio, mes - 1, dia);
    if (
      nacimiento.getFullYear() !== anio ||
      nacimiento.getMonth() !== mes - 1 ||
      nacimiento.getDate() !== dia
    ) {
      return '—';
    }
    const hoy = new Date();
    let edad = hoy.getFullYear() - anio;
    if (hoy.getMonth() < mes - 1 || (hoy.getMonth() === mes - 1 && hoy.getDate() < dia)) edad--;
    return `${edad} años`;
  }

  formatearFecha(fecha: string): string {
    const [anio, mes, dia] = fecha.slice(0, 10).split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
  }

  etiquetaEstado(estado: string): string {
    const etiquetas: Record<string, string> = {
      confirmado: 'Confirmado',
      cancelado: 'Cancelado',
      atendido: 'Atendido'
    };
    return etiquetas[estado] ?? estado;
  }

  nombreSedePropia(): string {
    const idSede = this.session.obtenerUsuario()?.id_sede;
    if (!idSede) return 'Sin sede asignada';
    return this.sedes().find((sede) => sede.id === idSede)?.nombre
      ?? this.agendasSede().find((agenda) => agenda.id_sede === idSede)?.sede_nombre
      ?? `Sede #${idSede}`;
  }

  medicoSeleccionadoNombre(): string {
    const idMedico = this.formularioTurno.controls.idMedico.value;
    const medico = this.medicos().find((opcion) => opcion.id === idMedico);
    return medico ? `${medico.nombre} ${medico.apellido}` : '';
  }

  especialidadSeleccionadaNombre(): string {
    const idEspecialidad = this.formularioTurno.controls.idEspecialidad.value;
    return this.especialidadesDisponibles().find((opcion) => opcion.id === idEspecialidad)?.descripcion ?? '';
  }

  tieneSedeAsignada(): boolean {
    const idSede = this.session.obtenerUsuario()?.id_sede;
    return typeof idSede === 'number' && Number.isSafeInteger(idSede) && idSede > 0;
  }

  private cargarAgendasSede(): void {
    const idSede = this.session.obtenerUsuario()?.id_sede;
    if (!idSede) {
      this.errorAgendas.set('Tu usuario no tiene una sede asignada.');
      return;
    }
    this.cargandoAgendas.set(true);
    this.agendasApi
      .listarOperador()
      .pipe(finalize(() => this.cargandoAgendas.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!Array.isArray(respuesta.datos)) {
            this.errorAgendas.set('La respuesta del servidor no contiene las agendas.');
            return;
          }
          this.agendasSede.set(respuesta.datos.filter((agenda) => agenda.id_sede === idSede));
        },
        error: (error: unknown) =>
          this.errorAgendas.set(mensajeErrorApi(error, 'No se pudieron cargar los médicos disponibles.'))
      });
  }

  private cargarSedes(): void {
    this.sedesApi.listar().subscribe({
      next: (respuesta) => {
        if (!Array.isArray(respuesta.datos)) {
          this.errorSedes.set('La respuesta del servidor no contiene las sedes.');
          return;
        }
        this.sedes.set(respuesta.datos);
      },
      error: (error: unknown) =>
        this.errorSedes.set(mensajeErrorApi(error, 'No se pudo cargar el nombre de la sede.'))
    });
  }

  private cargarFechas(idMedico: number, idEspecialidad: number): void {
    const idSede = this.session.obtenerUsuario()?.id_sede;
    if (!idSede) return;
    this.cargandoFechas.set(true);
    this.errorDisponibilidad.set('');
    this.disponibilidadApi
      .listarFechas(idMedico, idEspecialidad, idSede)
      .pipe(finalize(() => this.cargandoFechas.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!Array.isArray(respuesta.datos)) {
            this.errorDisponibilidad.set('La respuesta del servidor no contiene las fechas disponibles.');
            return;
          }
          this.fechasDisponibles.set(respuesta.datos);
        },
        error: (error: unknown) =>
          this.errorDisponibilidad.set(mensajeErrorApi(error, 'No se pudieron cargar las fechas disponibles.'))
      });
  }

  private cargarHorarios(
    idMedico: number,
    idEspecialidad: number,
    idSede: number,
    fecha: string
  ): void {
    this.cargandoHorarios.set(true);
    this.errorDisponibilidad.set('');
    this.disponibilidadApi
      .listarHorarios(idMedico, idEspecialidad, idSede, fecha)
      .pipe(finalize(() => this.cargandoHorarios.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!Array.isArray(respuesta.datos)) {
            this.errorDisponibilidad.set('La respuesta del servidor no contiene los horarios disponibles.');
            return;
          }
          this.horariosDisponibles.set(respuesta.datos);
        },
        error: (error: unknown) =>
          this.errorDisponibilidad.set(mensajeErrorApi(error, 'No se pudieron cargar los horarios disponibles.'))
      });
  }

  private fechaLocalActual(): string {
    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${ahora.getFullYear()}-${mes}-${dia}`;
  }
}
