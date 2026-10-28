import { DecimalPipe, DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MAT_DATE_LOCALE,
  MatDateFormats,
  provideNativeDateAdapter
} from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import Chart from 'chart.js/auto';
import { Subscription } from 'rxjs';

import {
  CantidadPorNombre,
  NumeroApi,
  RankingMedico,
  RankingMedicoApi,
  ReporteEspecialidadApi,
  ReporteSedeApi,
  TasaCancelacionApi
} from '../../../core/models/reporte.model';
import { ReporteService } from '../../../core/services/reporte.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { RankingMedicoDialogComponent } from './ranking-medico-dialog.component';

type AtajoPeriodo =
  | 'todos'
  | 'semana-pasada'
  | 'mes-pasado'
  | 'este-mes'
  | 'este-anio'
  | 'anio-pasado'
  | 'personalizado';

interface RangoFechas {
  desde: Date | null;
  hasta: Date | null;
}

interface OpcionPeriodo {
  id: Exclude<AtajoPeriodo, 'personalizado'>;
  etiqueta: string;
}

interface ResumenTurnos {
  total: number;
  cancelados: number;
  tasaCancelacion: number;
}

const FORMATOS_FECHA: MatDateFormats = {
  parse: { dateInput: null },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'long', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
    provideNativeDateAdapter(FORMATOS_FECHA)
  ],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.css'
})
export class ReportesComponent implements OnInit, OnDestroy {
  @ViewChild('donaCanvas') private donaCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly reportes = inject(ReporteService);
  private readonly dialog = inject(MatDialog);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private consultaActual?: Subscription;
  private graficoDona?: Chart;
  private temporizadorMedianoche?: ReturnType<typeof setTimeout>;
  private readonly alVolverAPestania = (): void => {
    if (!this.document.hidden) this.actualizarLimiteHoy();
  };

  readonly opcionesPeriodo: OpcionPeriodo[] = [
    { id: 'todos', etiqueta: 'Todos' },
    { id: 'semana-pasada', etiqueta: 'Semana pasada' },
    { id: 'mes-pasado', etiqueta: 'Mes pasado' },
    { id: 'este-mes', etiqueta: 'Este mes' },
    { id: 'este-anio', etiqueta: 'Este año' },
    { id: 'anio-pasado', etiqueta: 'Año pasado' }
  ];
  readonly rangoForm = new FormGroup({
    desde: new FormControl<Date | null>(null),
    hasta: new FormControl<Date | null>(null)
  });
  readonly atajoActivo = signal<AtajoPeriodo>('todos');
  readonly periodoAplicado = signal('Todos los períodos');
  readonly especialidades = signal<CantidadPorNombre[] | null>(null);
  readonly sedes = signal<CantidadPorNombre[] | null>(null);
  readonly ranking = signal<RankingMedico[] | null>(null);
  readonly tasa = signal<ResumenTurnos | null>(null);
  readonly cargandoEspecialidades = signal(true);
  readonly cargandoSedes = signal(true);
  readonly cargandoRanking = signal(true);
  readonly cargandoTasa = signal(true);
  readonly errorEspecialidades = signal('');
  readonly errorSedes = signal('');
  readonly errorRanking = signal('');
  readonly errorTasa = signal('');
  readonly errorRango = signal('');
  readonly fechaMaxima = signal(this.hoyLocal());
  readonly resumen = computed(() => {
    const tasa = this.tasa();
    const ranking = this.ranking();
    if (!tasa || ranking === null) return null;

    const atendidos = this.totalAtendidos(ranking);
    const confirmados = tasa.total - tasa.cancelados - atendidos;
    if (confirmados < 0) return null;

    return { ...tasa, atendidos, confirmados, finalizados: atendidos + tasa.cancelados };
  });
  readonly errorConsistencia = computed(() =>
    this.tasa() && this.ranking() !== null && !this.resumen()
      ? 'Los reportes recibidos contienen cantidades inconsistentes.'
      : ''
  );

  ngOnInit(): void {
    this.document.addEventListener('visibilitychange', this.alVolverAPestania);
    this.aplicarAtajo('todos');
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizadorMedianoche);
    this.document.removeEventListener('visibilitychange', this.alVolverAPestania);
    this.consultaActual?.unsubscribe();
    this.destruirGraficos();
  }

  aplicarAtajo(atajo: Exclude<AtajoPeriodo, 'personalizado'>): void {
    this.actualizarLimiteHoy();
    const rango = this.calcularRango(atajo);
    this.atajoActivo.set(atajo);
    this.errorRango.set('');
    this.rangoForm.setValue(rango, { emitEvent: false });
    this.cargarReportes(rango);
  }

  marcarPersonalizado(): void {
    this.atajoActivo.set('personalizado');
    this.errorRango.set('');
  }

  aplicarPersonalizado(): void {
    this.actualizarLimiteHoy();
    const { desde, hasta } = this.rangoForm.getRawValue();

    if (!desde || !hasta || !this.esFechaValida(desde) || !this.esFechaValida(hasta)) {
      this.errorRango.set('Seleccioná una fecha de inicio y una fecha de fin válidas.');
      return;
    }

    const desdeLocal = this.fechaLocal(desde);
    const hastaLocal = this.fechaLocal(hasta);
    if (desdeLocal.getTime() > this.fechaMaxima().getTime() || hastaLocal.getTime() > this.fechaMaxima().getTime()) {
      this.errorRango.set('El rango no puede incluir fechas futuras.');
      return;
    }
    if (desdeLocal.getTime() > hastaLocal.getTime()) {
      this.errorRango.set('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }

    this.atajoActivo.set('personalizado');
    this.errorRango.set('');
    this.rangoForm.setValue({ desde: desdeLocal, hasta: hastaLocal }, { emitEvent: false });
    this.cargarReportes({ desde: desdeLocal, hasta: hastaLocal });
  }

  abrirRankingCompleto(): void {
    const ranking = this.ranking();
    if (!ranking?.length) return;

    this.dialog.open(RankingMedicoDialogComponent, {
      data: ranking,
      width: '960px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      restoreFocus: true
    });
  }

  rankingDestacado(ranking: RankingMedico[]): RankingMedico[] {
    return ranking.slice(0, 3);
  }

  totalAtendidos(ranking: RankingMedico[]): number {
    return ranking.reduce((total, medico) => total + medico.turnosAtendidos, 0);
  }

  porcentajeFinalizados(cantidad: number, finalizados: number): number {
    return finalizados > 0 ? (cantidad * 100) / finalizados : 0;
  }

  private cargarReportes(rango: RangoFechas): void {
    this.consultaActual?.unsubscribe();
    this.destruirGraficos();
    this.especialidades.set(null);
    this.sedes.set(null);
    this.ranking.set(null);
    this.tasa.set(null);
    this.cargandoEspecialidades.set(true);
    this.cargandoSedes.set(true);
    this.cargandoRanking.set(true);
    this.cargandoTasa.set(true);
    this.errorEspecialidades.set('');
    this.errorSedes.set('');
    this.errorRanking.set('');
    this.errorTasa.set('');

    const fechaDesde = rango.desde ? this.formatearFechaApi(rango.desde) : null;
    const fechaHasta = rango.hasta ? this.formatearFechaApi(rango.hasta) : null;
    const filtro = { fechaDesde, fechaHasta };
    this.periodoAplicado.set(this.etiquetaRango(rango));
    this.consultaActual = new Subscription();

    this.consultaActual.add(this.reportes.turnosPorEspecialidad(filtro).subscribe({
      next: (respuesta) => {
        try {
          this.especialidades.set(this.normalizarEspecialidades(
            this.validarListado(respuesta.datos, 'especialidades')
          ));
        } catch (error: unknown) {
          this.errorEspecialidades.set(this.mensajeDatosInvalidos(error));
        }
        this.cargandoEspecialidades.set(false);
      },
      error: (error: unknown) => {
        this.errorEspecialidades.set(mensajeErrorApi(error, 'No se pudieron cargar las especialidades.'));
        this.cargandoEspecialidades.set(false);
      }
    }));

    this.consultaActual.add(this.reportes.turnosPorSede(filtro).subscribe({
      next: (respuesta) => {
        try {
          this.sedes.set(this.normalizarSedes(this.validarListado(respuesta.datos, 'sedes')));
        } catch (error: unknown) {
          this.errorSedes.set(this.mensajeDatosInvalidos(error));
        }
        this.cargandoSedes.set(false);
      },
      error: (error: unknown) => {
        this.errorSedes.set(mensajeErrorApi(error, 'No se pudieron cargar las sedes.'));
        this.cargandoSedes.set(false);
      }
    }));

    this.consultaActual.add(this.reportes.rankingMedicos(filtro).subscribe({
      next: (respuesta) => {
        try {
          this.ranking.set(this.normalizarRanking(this.validarListado(respuesta.datos, 'ranking médico')));
        } catch (error: unknown) {
          this.errorRanking.set(this.mensajeDatosInvalidos(error));
        }
        this.cargandoRanking.set(false);
        this.actualizarGraficoDona();
      },
      error: (error: unknown) => {
        this.errorRanking.set(mensajeErrorApi(error, 'No se pudo cargar el ranking médico.'));
        this.cargandoRanking.set(false);
      }
    }));

    this.consultaActual.add(this.reportes.tasaCancelacion(filtro).subscribe({
      next: (respuesta) => {
        try {
          this.tasa.set(this.normalizarTasa(respuesta.datos));
        } catch (error: unknown) {
          this.errorTasa.set(this.mensajeDatosInvalidos(error));
        }
        this.cargandoTasa.set(false);
        this.actualizarGraficoDona();
      },
      error: (error: unknown) => {
        this.errorTasa.set(mensajeErrorApi(error, 'No se pudo cargar la tasa de cancelación.'));
        this.cargandoTasa.set(false);
      }
    }));
  }

  private calcularRango(atajo: Exclude<AtajoPeriodo, 'personalizado'>): RangoFechas {
    const hoy = this.hoyLocal();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth();

    switch (atajo) {
      case 'todos':
        return { desde: null, hasta: null };
      case 'semana-pasada': {
        const diasDesdeLunes = (hoy.getDay() + 6) % 7;
        return {
          desde: new Date(anio, mes, hoy.getDate() - diasDesdeLunes - 7),
          hasta: new Date(anio, mes, hoy.getDate() - diasDesdeLunes - 1)
        };
      }
      case 'mes-pasado':
        return {
          desde: new Date(anio, mes - 1, 1),
          hasta: new Date(anio, mes, 0)
        };
      case 'este-mes':
        return { desde: new Date(anio, mes, 1), hasta: hoy };
      case 'este-anio':
        return { desde: new Date(anio, 0, 1), hasta: hoy };
      case 'anio-pasado':
        return {
          desde: new Date(anio - 1, 0, 1),
          hasta: new Date(anio - 1, 11, 31)
        };
    }
  }

  private normalizarEspecialidades(datos: ReporteEspecialidadApi[]): CantidadPorNombre[] {
    return datos
      .map((item) => ({
        id: this.normalizarEntero(item.id, 'id de especialidad'),
        nombre: item.descripcion,
        cantidad: this.normalizarEntero(item.cantidad_turnos, 'turnos por especialidad')
      }))
      .sort(this.ordenarCantidades);

  }

  private validarListado<T>(datos: T[] | null, seccion: string): T[] {
    if (!Array.isArray(datos)) {
      throw new Error(`El reporte de ${seccion} no devolvió una lista válida.`);
    }
    return datos;
  }

  private normalizarSedes(datos: ReporteSedeApi[]): CantidadPorNombre[] {
    return datos
      .map((item) => ({
        id: this.normalizarEntero(item.id, 'id de sede'),
        nombre: item.nombre,
        cantidad: this.normalizarEntero(item.cantidad_turnos, 'turnos por sede')
      }))
      .sort(this.ordenarCantidades);

  }

  private normalizarRanking(datos: RankingMedicoApi[]): RankingMedico[] {
    return datos
      .map((item) => ({
        id: this.normalizarEntero(item.id, 'id de médico'),
        nombreCompleto: `${item.nombre} ${item.apellido}`.trim(),
        turnosAtendidos: this.normalizarEntero(item.turnos_atendidos, 'turnos atendidos')
      }))
      .sort((a, b) => b.turnosAtendidos - a.turnosAtendidos || a.nombreCompleto.localeCompare(b.nombreCompleto));

  }

  private normalizarTasa(tasa: TasaCancelacionApi | null): ResumenTurnos {
    if (!tasa) throw new Error('El reporte de cancelaciones no devolvió datos.');
    const total = this.normalizarEntero(tasa.total_turnos, 'total de turnos');
    const cancelados = this.normalizarEntero(tasa.turnos_cancelados, 'turnos cancelados');
    const tasaCancelacion = this.normalizarNumero(tasa.tasa_cancelacion, 'tasa de cancelación');
    if (cancelados > total || tasaCancelacion < 0 || tasaCancelacion > 100) {
      throw new Error('Los reportes recibidos contienen cantidades inconsistentes.');
    }
    return { total, cancelados, tasaCancelacion };
  }

  private mensajeDatosInvalidos(error: unknown): string {
    return error instanceof Error ? error.message : 'El reporte recibido contiene datos inconsistentes.';
  }

  private readonly ordenarCantidades = (a: CantidadPorNombre, b: CantidadPorNombre): number =>
    b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre);

  private normalizarEntero(valor: NumeroApi, campo: string): number {
    const numero = this.normalizarNumero(valor, campo);
    if (!Number.isInteger(numero) || numero < 0) {
      throw new Error(`El campo ${campo} no contiene una cantidad válida.`);
    }
    return numero;
  }

  private normalizarNumero(valor: NumeroApi, campo: string): number {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) throw new Error(`El campo ${campo} no contiene un número válido.`);
    return numero;
  }

  private actualizarGraficoDona(): void {
    if (!this.resumen()) return;
    this.changeDetector.detectChanges();
    this.crearGraficoDona();
  }

  private crearGraficoDona(): void {
    const reporte = this.resumen();
    if (!reporte || reporte.finalizados === 0 || !this.donaCanvas) return;

    this.graficoDona?.destroy();
    const porcentajeAtendidos = this.porcentajeFinalizados(reporte.atendidos, reporte.finalizados);
    const porcentajeCancelados = this.porcentajeFinalizados(reporte.cancelados, reporte.finalizados);

    this.graficoDona = new Chart(this.donaCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: [
          `Atendidos (${porcentajeAtendidos.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %)`,
          `Cancelados (${porcentajeCancelados.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %)`
        ],
        datasets: [
          {
            data: [reporte.atendidos, reporte.cancelados],
            backgroundColor: ['#237253', '#8c1d18'],
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  private destruirGraficos(): void {
    this.graficoDona?.destroy();
    this.graficoDona = undefined;
  }

  private etiquetaRango(rango: RangoFechas): string {
    if (!rango.desde || !rango.hasta) return 'Todos los períodos';
    return `${this.formatearFechaVisible(rango.desde)} – ${this.formatearFechaVisible(rango.hasta)}`;
  }

  private formatearFechaApi(fecha: Date): string {
    return [
      fecha.getFullYear(),
      this.completarDosDigitos(fecha.getMonth() + 1),
      this.completarDosDigitos(fecha.getDate())
    ].join('-');
  }

  private formatearFechaVisible(fecha: Date): string {
    return [
      this.completarDosDigitos(fecha.getDate()),
      this.completarDosDigitos(fecha.getMonth() + 1),
      fecha.getFullYear()
    ].join('/');
  }

  private completarDosDigitos(valor: number): string {
    return String(valor).padStart(2, '0');
  }

  private fechaLocal(fecha: Date): Date {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  }

  private hoyLocal(): Date {
    const ahora = new Date();
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  }

  private actualizarLimiteHoy(): void {
    const hoy = this.hoyLocal();
    this.fechaMaxima.set(hoy);
    clearTimeout(this.temporizadorMedianoche);
    const proximaMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    this.temporizadorMedianoche = setTimeout(
      () => this.actualizarLimiteHoy(),
      proximaMedianoche.getTime() - Date.now() + 1000
    );
  }

  private esFechaValida(fecha: Date): boolean {
    return !Number.isNaN(fecha.getTime());
  }
}
