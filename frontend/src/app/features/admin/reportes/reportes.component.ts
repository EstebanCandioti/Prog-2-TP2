import { DecimalPipe, DOCUMENT } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Chart from 'chart.js/auto';
import { Subscription } from 'rxjs';

import {
  CantidadPorNombre,
  DashboardReportes,
  NumeroApi,
  RankingMedico,
  RespuestasReportes
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
    MatProgressSpinnerModule,
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
  readonly dashboard = signal<DashboardReportes | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly errorRango = signal('');
  readonly fechaMaxima = signal(this.hoyLocal());

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
    const ranking = this.dashboard()?.ranking;
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

  porcentajeFinalizados(cantidad: number, finalizados: number): number {
    return finalizados > 0 ? (cantidad * 100) / finalizados : 0;
  }

  private cargarReportes(rango: RangoFechas): void {
    this.consultaActual?.unsubscribe();
    this.destruirGraficos();
    this.dashboard.set(null);
    this.error.set('');
    this.cargando.set(true);

    const fechaDesde = rango.desde ? this.formatearFechaApi(rango.desde) : null;
    const fechaHasta = rango.hasta ? this.formatearFechaApi(rango.hasta) : null;
    const etiquetaPeriodo = this.etiquetaRango(rango);

    this.consultaActual = this.reportes.cargarReportes({ fechaDesde, fechaHasta }).subscribe({
      next: (respuestas) => {
        try {
          this.dashboard.set(this.normalizarDashboard(respuestas));
          this.periodoAplicado.set(etiquetaPeriodo);
          this.cargando.set(false);
          this.changeDetector.detectChanges();
          this.crearGraficos();
        } catch (error: unknown) {
          this.dashboard.set(null);
          this.cargando.set(false);
          this.error.set(
            error instanceof Error
              ? error.message
              : 'Los reportes recibidos contienen datos inconsistentes.'
          );
        }
      },
      error: (error: unknown) => {
        this.dashboard.set(null);
        this.cargando.set(false);
        this.error.set(mensajeErrorApi(error, 'No se pudieron cargar los reportes para el período seleccionado.'));
      }
    });
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

  private normalizarDashboard(respuestas: RespuestasReportes): DashboardReportes {
    const tasa = respuestas.tasaCancelacion.datos;
    if (!tasa) throw new Error('El reporte de cancelaciones no devolvió datos.');

    const especialidades = (respuestas.especialidades.datos ?? [])
      .map((item) => ({
        id: this.normalizarEntero(item.id, 'id de especialidad'),
        nombre: item.descripcion,
        cantidad: this.normalizarEntero(item.cantidad_turnos, 'turnos por especialidad')
      }))
      .sort(this.ordenarCantidades);

    const sedes = (respuestas.sedes.datos ?? [])
      .map((item) => ({
        id: this.normalizarEntero(item.id, 'id de sede'),
        nombre: item.nombre,
        cantidad: this.normalizarEntero(item.cantidad_turnos, 'turnos por sede')
      }))
      .sort(this.ordenarCantidades);

    const ranking = (respuestas.ranking.datos ?? [])
      .map((item) => ({
        id: this.normalizarEntero(item.id, 'id de médico'),
        nombreCompleto: `${item.nombre} ${item.apellido}`.trim(),
        turnosAtendidos: this.normalizarEntero(item.turnos_atendidos, 'turnos atendidos')
      }))
      .sort((a, b) => b.turnosAtendidos - a.turnosAtendidos || a.nombreCompleto.localeCompare(b.nombreCompleto));

    const total = this.normalizarEntero(tasa.total_turnos, 'total de turnos');
    const cancelados = this.normalizarEntero(tasa.turnos_cancelados, 'turnos cancelados');
    const tasaCancelacion = this.normalizarNumero(tasa.tasa_cancelacion, 'tasa de cancelación');
    const atendidos = ranking.reduce((totalAtendidos, medico) => totalAtendidos + medico.turnosAtendidos, 0);
    const confirmados = total - cancelados - atendidos;

    if (confirmados < 0 || tasaCancelacion < 0 || tasaCancelacion > 100) {
      throw new Error('Los reportes recibidos contienen cantidades inconsistentes.');
    }

    return {
      total,
      confirmados,
      atendidos,
      cancelados,
      finalizados: atendidos + cancelados,
      tasaCancelacion,
      especialidades,
      sedes,
      ranking
    };
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

  private crearGraficos(): void {
    this.crearGraficoDona();
  }

  private crearGraficoDona(): void {
    const reporte = this.dashboard();
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
