import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, DestroyRef, inject, Input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import {
  catchError, combineLatest, defer, distinctUntilChanged, EMPTY, exhaustMap, finalize,
  map, Observable, shareReplay, startWith, Subject, switchMap, tap
} from 'rxjs';

import { ApiResponse } from '../../../core/models/api-response.model';
import { Especialidad } from '../../../core/models/especialidad.model';
import { Medico } from '../../../core/models/medico.model';
import { Sede } from '../../../core/models/sede.model';
import { PacienteReserva, ResumenReserva, SolicitudTurno, Turno } from '../../../core/models/turno.model';
import { EspecialidadService } from '../../../core/services/especialidad.service';
import { MedicoService } from '../../../core/services/medico.service';
import { SedeService } from '../../../core/services/sede.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { fechaAgendaValida, fechaCalendario, FORMATOS_FECHA_AGENDA, leerFechaCalendario, opcionDisponible } from '../agenda/agenda-form.utils';

type PasoOpciones = 'especialidades' | 'sedes' | 'medicos' | 'fechas' | 'horarios';

export interface ContextoAgendaReserva {
  idAgenda: number;
  idMedico: number;
  idEspecialidad: number;
  idSede: number;
  fecha: string;
}

export interface SeleccionesInicialesReserva {
  id_especialidad?: number;
  id_sede?: number;
  id_medico?: number;
  fecha?: string;
  hora?: string;
}

interface SeleccionReserva {
  id_especialidad: number | null;
  id_sede: number | null;
  id_medico: number | null;
  fecha: Date | null;
  hora: string | null;
  nota: string;
}

@Component({
  selector: 'app-reserva-turno',
  standalone: true,
  imports: [
    DatePipe, NgTemplateOutlet, ReactiveFormsModule, MatButtonModule, MatCardModule, MatDatepickerModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule, MatStepperModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
    provideNativeDateAdapter(FORMATOS_FECHA_AGENDA)
  ],
  templateUrl: './reserva-turno.component.html',
  styleUrl: './reserva-turno.component.css'
})
export class ReservaTurnoComponent implements OnInit {
  // El anfitrión aporta el paciente, la cobertura y la operación de reserva.
  // No se deducen roles ni comportamiento desde la URL o la sesión.
  @Input({ required: true }) paciente!: PacienteReserva;
  @Input({ required: true }) reservar!: (solicitud: SolicitudTurno) => Observable<ApiResponse<Turno>>;
  @Input() idSedeFija: number | null = null;
  @Input() contextoFijo: ContextoAgendaReserva | null = null;
  @Input() esOperador = false;
  @Input() presentacion: 'pasos' | 'formulario' = 'pasos';
  @Input() seleccionesIniciales: SeleccionesInicialesReserva = {};
  readonly verTurnos = output<void>();
  readonly reservaExitosa = output<Turno>();
  readonly cerrar = output<void>();

  private readonly especialidadesApi = inject(EspecialidadService);
  private readonly sedesApi = inject(SedeService);
  private readonly medicosApi = inject(MedicoService);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargarEspecialidades$ = new Subject<void>();
  private readonly recargarSedes$ = new Subject<void>();
  private readonly recargarMedicos$ = new Subject<void>();
  private readonly recargarFechas$ = new Subject<void>();
  private readonly recargarHorarios$ = new Subject<void>();
  private readonly solicitudes$ = new Subject<{ solicitud: SolicitudTurno; resumen: ResumenReserva }>();
  private precargas: SeleccionesInicialesReserva = {};
  private aplicandoPrecarga = false;

  readonly especialidades = signal<Especialidad[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly medicos = signal<Medico[]>([]);
  readonly fechas = signal<string[]>([]);
  readonly horarios = signal<string[]>([]);
  readonly cargando = signal<Record<PasoOpciones, boolean>>({
    especialidades: false, sedes: false, medicos: false, fechas: false, horarios: false
  });
  readonly errores = signal<Record<PasoOpciones, string>>({
    especialidades: '', sedes: '', medicos: '', fechas: '', horarios: ''
  });
  readonly orientacion = signal<'horizontal' | 'vertical'>('horizontal');
  readonly pasoActual = signal(0);
  readonly reservando = signal(false);
  readonly errorReserva = signal('');
  readonly errorConfiguracion = signal('');
  readonly confirmada = signal<{ resumen: ResumenReserva; turno: Turno | null } | null>(null);

  readonly formulario = new FormGroup({
    id_especialidad: new FormControl<number | null>({ value: null, disabled: true }, [
      Validators.required, opcionDisponible(() => this.especialidades())
    ]),
    id_sede: new FormControl<number | null>({ value: null, disabled: true }, [
      Validators.required, opcionDisponible(() => this.sedes())
    ]),
    id_medico: new FormControl<number | null>({ value: null, disabled: true }, [
      Validators.required, opcionDisponible(() => this.medicos())
    ]),
    fecha: new FormControl<Date | null>({ value: null, disabled: true }, [
      Validators.required, fechaAgendaValida,
      (control) => control.value && !this.filtroFecha(control.value) ? { fechaNoDisponible: true } : null
    ]),
    hora: new FormControl<string | null>({ value: null, disabled: true }, [
      Validators.required,
      (control) => control.value && !this.horarios().includes(control.value) ? { horaNoDisponible: true } : null
    ]),
    nota: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(40)] })
  });
  readonly controles = this.formulario.controls;
  readonly valores = signal<SeleccionReserva>(this.formulario.getRawValue());
  private seleccionAnterior = this.formulario.getRawValue();
  readonly primeraFecha = computed(() => this.fechas().length ? leerFechaCalendario(this.fechas()[0]) : null);
  readonly ultimaFecha = computed(() => this.fechas().length ? leerFechaCalendario(this.fechas()[this.fechas().length - 1]) : null);
  readonly fechasPermitidas = computed(() => new Set(this.fechas()));
  readonly filtroFecha = (fecha: Date | null): boolean => {
    const valor = fechaCalendario(fecha);
    return valor !== null && this.fechasPermitidas().has(valor);
  };
  readonly resumen = computed<ResumenReserva>(() => {
    const valores = this.valores();
    const especialidad = this.especialidades().find((item) => item.id === valores.id_especialidad);
    const sede = this.sedes().find((item) => item.id === valores.id_sede);
    const medico = this.medicos().find((item) => item.id === valores.id_medico);
    return {
      especialidad: especialidad ? `${especialidad.id}. ${especialidad.descripcion}` : 'Sin seleccionar',
      sede: sede ? `${sede.id}. ${sede.nombre}` : 'Sin seleccionar',
      medico: medico ? `${medico.id}. ${medico.apellido}, ${medico.nombre}` : 'Sin seleccionar',
      fecha: fechaCalendario(valores.fecha) ?? '', hora: valores.hora ?? '',
      cobertura: this.paciente ? `${this.paciente.cobertura.id}. ${this.paciente.cobertura.nombre}` : '',
      nota: valores.nota.trim()
    };
  });

  get sedeFija(): number | null {
    return this.contextoFijo?.idSede ?? this.idSedeFija;
  }

  ngOnInit(): void {
    this.errorConfiguracion.set(this.validarConfiguracion());
    if (this.errorConfiguracion()) return;
    this.precargas = { ...this.seleccionesIniciales };
    this.breakpoints.observe('(max-width: 850px)').pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((estado) => this.orientacion.set(estado.matches ? 'vertical' : 'horizontal'));

    const seleccion$ = this.formulario.valueChanges.pipe(
      startWith(null),
      map(() => {
        const actual = this.formulario.getRawValue();
        const anterior = this.seleccionAnterior;
        // Las precargas se consumen una sola vez. Una modificación del usuario
        // descarta las pendientes aguas abajo de una selección ya establecida.
        if (!this.aplicandoPrecarga) {
          if (actual.id_especialidad !== anterior.id_especialidad && anterior.id_especialidad !== null) this.descartarPrecargasDesde(1);
          else if (actual.id_sede !== anterior.id_sede && anterior.id_sede !== null) this.descartarPrecargasDesde(2);
          else if (actual.id_medico !== anterior.id_medico && anterior.id_medico !== null) this.descartarPrecargasDesde(3);
          else if (fechaCalendario(actual.fecha) !== fechaCalendario(anterior.fecha) && anterior.fecha !== null) this.descartarPrecargasDesde(4);
        }
        if (actual.id_especialidad !== anterior.id_especialidad) this.limpiarDesde(1);
        else if (actual.id_sede !== anterior.id_sede) this.limpiarDesde(2);
        else if (actual.id_medico !== anterior.id_medico) this.limpiarDesde(3);
        else if (fechaCalendario(actual.fecha) !== fechaCalendario(anterior.fecha)) this.limpiarDesde(4);
        if (actual.id_especialidad !== anterior.id_especialidad || actual.id_sede !== anterior.id_sede ||
            actual.id_medico !== anterior.id_medico || actual.fecha !== anterior.fecha || actual.hora !== anterior.hora) {
          this.errorReserva.set('');
        }
        // Los resets internos no emiten: esta misma emisión publica TODOS los
        // valores ya limpiados. Cada switchMap recibe el cambio y cancela su HTTP.
        const seleccion = this.formulario.getRawValue();
        this.seleccionAnterior = seleccion;
        this.valores.set(seleccion);
        return seleccion;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.prepararEspecialidades();
    this.prepararSedes(seleccion$);
    this.prepararMedicos(seleccion$);
    this.prepararFechas(seleccion$);
    this.prepararHorarios(seleccion$);
    this.prepararReserva();
  }

  private prepararEspecialidades(): void {
    this.recargarEspecialidades$.pipe(
      startWith(undefined),
      switchMap(() => {
        this.especialidades.set([]);
        this.estado('especialidades', true);
        return this.especialidadesApi.listar().pipe(
          tap((respuesta) => {
            this.estado('especialidades', false);
            if (!Array.isArray(respuesta.datos)) {
              this.estado('especialidades', false, 'La respuesta no contiene el listado de especialidades.');
              return;
            }
            const opciones = this.contextoFijo
              ? respuesta.datos.filter((item) => item.id === this.contextoFijo?.idEspecialidad)
              : respuesta.datos;
            this.especialidades.set(opciones);
            if (this.contextoFijo) {
              if (!opciones.length) {
                this.estado('especialidades', false, 'La especialidad de esta agenda ya no está disponible.');
                return;
              }
              const idEspecialidad = this.contextoFijo.idEspecialidad;
              this.asignarPrecarga(() => this.controles.id_especialidad.setValue(idEspecialidad));
              this.controles.id_especialidad.disable({ emitEvent: false });
            } else if (opciones.length) {
              this.controles.id_especialidad.enable({ emitEvent: false });
              this.aplicarPrecarga('id_especialidad');
            }
          }),
          catchError((error: unknown) => {
            this.estado('especialidades', false, mensajeErrorApi(error, 'No se pudieron cargar las especialidades.'));
            return EMPTY;
          })
        );
      }), takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  private prepararSedes(seleccion$: Observable<SeleccionReserva>): void {
    combineLatest([
      seleccion$.pipe(map((s) => s.id_especialidad), distinctUntilChanged()),
      this.recargarSedes$.pipe(startWith(undefined))
    ]).pipe(
      switchMap(([idEspecialidad]) => {
        this.sedes.set([]);
        this.controles.id_sede.disable({ emitEvent: false });
        this.estado('sedes', false);
        if (idEspecialidad === null || !this.pasoListo(0)) return EMPTY;
        this.estado('sedes', true);
        return this.sedesApi.listar().pipe(
          tap((respuesta) => {
            this.estado('sedes', false);
            if (!Array.isArray(respuesta.datos)) {
              this.estado('sedes', false, 'La respuesta no contiene el listado de sedes.');
              return;
            }
            const sedes = this.sedeFija === null
              ? respuesta.datos
              : respuesta.datos.filter((sede) => sede.id === this.sedeFija);
            this.sedes.set(sedes);
            if (this.sedeFija !== null) {
              if (!sedes.length) {
                this.estado('sedes', false, 'La sede fijada para esta reserva no está disponible.');
                return;
              }
              this.asignarPrecarga(() => this.controles.id_sede.setValue(this.sedeFija));
              this.controles.id_sede.disable({ emitEvent: false });
            } else if (sedes.length) {
              this.controles.id_sede.enable({ emitEvent: false });
              this.aplicarPrecarga('id_sede');
            }
          }),
          catchError((error: unknown) => {
            this.estado('sedes', false, mensajeErrorApi(error, 'No se pudieron cargar las sedes.'));
            return EMPTY;
          })
        );
      }), takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  private prepararMedicos(seleccion$: Observable<SeleccionReserva>): void {
    combineLatest([
      seleccion$.pipe(map((s) => [s.id_especialidad, s.id_sede] as const),
        distinctUntilChanged((a, b) => a[0] === b[0] && a[1] === b[1])),
      this.recargarMedicos$.pipe(startWith(undefined))
    ]).pipe(
      switchMap(([[idEspecialidad, idSede]]) => {
        this.medicos.set([]);
        this.controles.id_medico.disable({ emitEvent: false });
        this.estado('medicos', false);
        if (idEspecialidad === null || idSede === null || !this.pasoListo(1)) return EMPTY;
        this.estado('medicos', true);
        return this.medicosApi.listar({ id_especialidad: idEspecialidad, id_sede: idSede }).pipe(
          tap((respuesta) => {
            this.estado('medicos', false);
            if (!Array.isArray(respuesta.datos)) {
              this.estado('medicos', false, 'La respuesta no contiene el listado de médicos.');
              return;
            }
            const medicos = this.contextoFijo
              ? respuesta.datos.filter((item) => item.id === this.contextoFijo?.idMedico)
              : respuesta.datos;
            this.medicos.set(medicos);
            if (this.contextoFijo) {
              if (!medicos.length) {
                this.estado('medicos', false, 'El médico de esta agenda ya no está disponible para la selección.');
                return;
              }
              const idMedico = this.contextoFijo.idMedico;
              this.asignarPrecarga(() => this.controles.id_medico.setValue(idMedico));
              this.controles.id_medico.disable({ emitEvent: false });
            } else if (medicos.length) {
              this.controles.id_medico.enable({ emitEvent: false });
              this.aplicarPrecarga('id_medico');
            }
          }),
          catchError((error: unknown) => {
            this.estado('medicos', false, mensajeErrorApi(error, 'No se pudieron cargar los médicos.'));
            return EMPTY;
          })
        );
      }), takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  private prepararFechas(seleccion$: Observable<SeleccionReserva>): void {
    combineLatest([
      seleccion$.pipe(map((s) => [s.id_especialidad, s.id_sede, s.id_medico] as const),
        distinctUntilChanged((a, b) => a.every((valor, index) => valor === b[index]))),
      this.recargarFechas$.pipe(startWith(undefined))
    ]).pipe(
      switchMap(([[idEspecialidad, idSede, idMedico]]) => {
        this.fechas.set([]);
        this.controles.fecha.disable({ emitEvent: false });
        this.estado('fechas', false);
        if (idEspecialidad === null || idSede === null || idMedico === null || !this.pasoListo(2)) return EMPTY;
        this.estado('fechas', true);
        return this.medicosApi.listarFechasDisponibles(idMedico, idEspecialidad, idSede).pipe(
          tap((respuesta) => {
            this.estado('fechas', false);
            if (!Array.isArray(respuesta.datos)) {
              this.estado('fechas', false, 'La respuesta no contiene el listado de fechas.');
              return;
            }
            const fechas = [...new Set(respuesta.datos)].sort();
            if (this.contextoFijo) {
              if (!fechas.includes(this.contextoFijo.fecha)) {
                this.estado('fechas', false, 'La fecha de esta agenda ya no está disponible para la selección.');
                return;
              }
              this.fechas.set([this.contextoFijo.fecha]);
              const fecha = leerFechaCalendario(this.contextoFijo.fecha);
              this.asignarPrecarga(() => this.controles.fecha.setValue(fecha));
              this.controles.fecha.disable({ emitEvent: false });
            } else {
              this.fechas.set(fechas);
              if (fechas.length) {
                this.controles.fecha.enable({ emitEvent: false });
                this.aplicarPrecarga('fecha');
              }
            }
          }),
          catchError((error: unknown) => {
            this.estado('fechas', false, mensajeErrorApi(error, 'No se pudieron cargar las fechas.'));
            return EMPTY;
          })
        );
      }), takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  private prepararHorarios(seleccion$: Observable<SeleccionReserva>): void {
    combineLatest([
      seleccion$.pipe(map((s) => [s.id_especialidad, s.id_sede, s.id_medico, fechaCalendario(s.fecha)] as const),
        distinctUntilChanged((a, b) => a.every((valor, index) => valor === b[index]))),
      this.recargarHorarios$.pipe(startWith(undefined))
    ]).pipe(
      switchMap(([[idEspecialidad, idSede, idMedico, fecha]]) => {
        this.horarios.set([]);
        this.controles.hora.disable({ emitEvent: false });
        this.estado('horarios', false);
        if (idEspecialidad === null || idSede === null || idMedico === null || fecha === null || !this.pasoListo(3)) return EMPTY;
        this.estado('horarios', true);
        return this.medicosApi.listarHorariosDisponibles(idMedico, idEspecialidad, idSede, fecha).pipe(
          tap((respuesta) => {
            this.estado('horarios', false);
            if (!Array.isArray(respuesta.datos)) {
              this.estado('horarios', false, 'La respuesta no contiene el listado de horarios.');
              return;
            }
            const disponibles = this.contextoFijo
              ? respuesta.datos.filter((item) => item.id_agenda === this.contextoFijo?.idAgenda)
              : respuesta.datos;
            this.horarios.set([...new Set(disponibles.map((item) => item.hora))].sort());
            if (this.horarios().length) {
              this.controles.hora.enable({ emitEvent: false });
              this.aplicarPrecarga('hora');
            }
          }),
          catchError((error: unknown) => {
            this.estado('horarios', false, mensajeErrorApi(error, 'No se pudieron cargar los horarios.'));
            return EMPTY;
          })
        );
      }), takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  private prepararReserva(): void {
    this.solicitudes$.pipe(
      exhaustMap(({ solicitud, resumen }) => {
        this.reservando.set(true);
        this.errorReserva.set('');
        this.formulario.disable({ emitEvent: false });
        return defer(() => this.reservar(solicitud)).pipe(
          tap((respuesta) => {
            if (!respuesta.datos) throw new Error('La respuesta no contiene el turno creado.');
            this.confirmada.set({ resumen, turno: respuesta.datos });
            this.reservaExitosa.emit(respuesta.datos);
          }),
          catchError((error: unknown) => {
            this.reservando.set(false);
            this.formulario.enable({ emitEvent: false });
            if (this.sedeFija !== null) this.controles.id_sede.disable({ emitEvent: false });
            if (this.contextoFijo) {
              this.controles.id_especialidad.disable({ emitEvent: false });
              this.controles.id_medico.disable({ emitEvent: false });
              this.controles.fecha.disable({ emitEvent: false });
            }
            if (error instanceof HttpErrorResponse && error.status === 409) {
              this.controles.hora.reset({ value: null, disabled: true });
              this.pasoActual.set(4);
              this.recargarHorarios$.next();
            }
            this.errorReserva.set(mensajeErrorApi(error, 'No se pudo reservar el turno. Revisá la conexión y reintentá.'));
            return EMPTY;
          }),
          finalize(() => this.reservando.set(false))
        );
      }), takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  pasoListo(paso: number): boolean {
    if (this.errorConfiguracion()) return false;
    const valor = this.valores();
    const carga = this.cargando();
    const error = this.errores();
    const especialidad = !carga.especialidades && !error.especialidades && this.especialidades().some((e) => e.id === valor.id_especialidad);
    if (paso === 0 || !especialidad) return especialidad;
    const sede = !carga.sedes && !error.sedes && this.sedes().some((s) => s.id === valor.id_sede);
    if (paso === 1 || !sede) return sede;
    const medico = !carga.medicos && !error.medicos && this.medicos().some((m) => m.id === valor.id_medico);
    if (paso === 2 || !medico) return medico;
    const fecha = !carga.fechas && !error.fechas && this.filtroFecha(valor.fecha);
    if (paso === 3 || !fecha) return fecha;
    return !carga.horarios && !error.horarios && valor.hora !== null && valor.hora.length > 0 && this.horarios().includes(valor.hora);
  }

  avanzar(paso: number): void {
    if (!this.reservando() && this.pasoListo(paso)) this.pasoActual.set(paso + 1);
  }

  volver(): void {
    if (!this.reservando()) this.pasoActual.update((paso) => Math.max(0, paso - 1));
  }

  reintentar(paso: PasoOpciones): void {
    if (this.reservando() || this.confirmada() || this.errorConfiguracion()) return;
    // Estos resets sí emiten; la selección compartida cancela los flujos inferiores.
    switch (paso) {
      case 'especialidades': this.controles.id_especialidad.reset({ value: null, disabled: true }); this.recargarEspecialidades$.next(); break;
      case 'sedes': this.controles.id_sede.reset({ value: null, disabled: true }); this.recargarSedes$.next(); break;
      case 'medicos': this.controles.id_medico.reset({ value: null, disabled: true }); this.recargarMedicos$.next(); break;
      case 'fechas': this.controles.fecha.reset({ value: null, disabled: true }); this.recargarFechas$.next(); break;
      case 'horarios': this.controles.hora.reset({ value: null, disabled: true }); this.recargarHorarios$.next(); break;
    }
  }

  confirmar(): void {
    if (this.presentacion === 'pasos' && this.pasoActual() !== 5) return;
    this.formulario.markAllAsTouched();
    if (this.reservando() || this.confirmada() || !this.pasoListo(4) || this.controles.nota.invalid ||
        !this.paciente?.cobertura || !Number.isSafeInteger(this.paciente.cobertura.id) || this.paciente.cobertura.id <= 0) return;
    const valor = this.formulario.getRawValue();
    const fecha = fechaCalendario(valor.fecha);
    if (valor.id_especialidad === null || valor.id_sede === null || valor.id_medico === null || !fecha || !valor.hora) return;
    // El paciente no envía id_paciente, id_cobertura ni id_agenda.
    const solicitud: SolicitudTurno = {
      id_especialidad: valor.id_especialidad, id_sede: valor.id_sede, id_medico: valor.id_medico,
      fecha, hora: valor.hora, nota: valor.nota.trim()
    };
    this.solicitudes$.next({ solicitud, resumen: this.resumen() });
  }

  reservarOtro(): void {
    if (this.reservando()) return;
    this.confirmada.set(null);
    this.errorReserva.set('');
    this.pasoActual.set(0);
    this.precargas = {};
    this.formulario.reset({
      id_especialidad: { value: null, disabled: true }, id_sede: { value: null, disabled: true },
      id_medico: { value: null, disabled: true }, fecha: { value: null, disabled: true },
      hora: { value: null, disabled: true }, nota: { value: '', disabled: false }
    });
    this.recargarEspecialidades$.next();
  }

  fechaLegible(fecha: string): Date | null {
    return leerFechaCalendario(fecha);
  }

  private validarConfiguracion(): string {
    if (this.idSedeFija !== null && !this.idValido(this.idSedeFija)) return 'La sede fija de esta reserva no es válida.';
    const contexto = this.contextoFijo;
    if (!contexto) return '';
    if (![contexto.idAgenda, contexto.idMedico, contexto.idEspecialidad, contexto.idSede].every((id) => this.idValido(id)) ||
        typeof contexto.fecha !== 'string' || fechaCalendario(leerFechaCalendario(contexto.fecha)) !== contexto.fecha) {
      return 'El contexto de agenda debe incluir agenda, médico, especialidad, sede y una fecha válida. Cerrá y actualizá la agenda.';
    }
    if (this.idSedeFija !== null && this.idSedeFija !== contexto.idSede) return 'La agenda no pertenece a la sede fija de esta reserva.';
    return '';
  }

  private idValido(id: unknown): id is number {
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  }

  private asignarPrecarga(asignar: () => void): void {
    const anterior = this.aplicandoPrecarga;
    this.aplicandoPrecarga = true;
    try { asignar(); } finally { this.aplicandoPrecarga = anterior; }
  }

  private aplicarPrecarga(campo: keyof SeleccionesInicialesReserva): void {
    const valor = this.precargas[campo];
    delete this.precargas[campo];
    if (this.controles[campo].value !== null) return;
    if (campo === 'fecha') {
      if (typeof valor === 'string' && this.fechas().includes(valor) && fechaCalendario(leerFechaCalendario(valor)) === valor) {
        this.asignarPrecarga(() => this.controles.fecha.setValue(leerFechaCalendario(valor)));
      }
    } else if (campo === 'hora') {
      if (typeof valor === 'string' && this.horarios().includes(valor)) this.asignarPrecarga(() => this.controles.hora.setValue(valor));
    } else {
      const opciones = { id_especialidad: this.especialidades(), id_sede: this.sedes(), id_medico: this.medicos() };
      if (this.idValido(valor) && opciones[campo].some((item) => item.id === valor)) {
        const control = this.controles[campo];
        this.asignarPrecarga(() => control.setValue(valor));
      }
    }
  }

  private descartarPrecargasDesde(paso: number): void {
    if (paso <= 1) delete this.precargas.id_sede;
    if (paso <= 2) delete this.precargas.id_medico;
    if (paso <= 3) delete this.precargas.fecha;
    if (paso <= 4) delete this.precargas.hora;
  }

  private estado(paso: PasoOpciones, cargando: boolean, error = ''): void {
    this.cargando.update((valor) => ({ ...valor, [paso]: cargando }));
    this.errores.update((valor) => ({ ...valor, [paso]: error }));
  }

  private limpiarDesde(paso: number): void {
    const sinEmitir = { emitEvent: false };
    if (paso <= 1) {
      this.sedes.set([]); this.estado('sedes', false);
      this.controles.id_sede.reset({ value: null, disabled: true }, sinEmitir);
    }
    if (paso <= 2) {
      this.medicos.set([]); this.estado('medicos', false);
      this.controles.id_medico.reset({ value: null, disabled: true }, sinEmitir);
    }
    if (paso <= 3) {
      this.fechas.set([]); this.estado('fechas', false);
      this.controles.fecha.reset({ value: null, disabled: true }, sinEmitir);
    }
    if (paso <= 4) {
      this.horarios.set([]); this.estado('horarios', false);
      this.controles.hora.reset({ value: null, disabled: true }, sinEmitir);
    }
  }
}
