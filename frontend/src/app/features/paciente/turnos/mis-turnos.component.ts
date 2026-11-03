import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize, Subscription } from 'rxjs';

import { HistorialClinico, TipoListadoTurnos, TurnoPaciente } from '../../../core/models/turno.model';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { ConfirmacionDialogComponent } from '../../shared/confirmacion-dialog.component';

@Component({
  selector: 'app-mis-turnos',
  standalone: true,
  imports: [
    MatButtonModule, MatCardModule, MatDialogModule, MatExpansionModule, MatIconModule,
    MatProgressSpinnerModule, MatTabsModule, MatSnackBarModule
  ],
  templateUrl: './mis-turnos.component.html',
  styleUrl: './mis-turnos.component.css'
})
export class MisTurnosComponent implements OnInit, OnDestroy {
  private readonly tamanoPagina = 20;
  private readonly turnosApi = inject(TurnoService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private consultaActual?: Subscription;
  private readonly consultasHistorial = new Map<number, Subscription>();

  readonly turnos = signal<TurnoPaciente[]>([]);
  readonly historiales = signal<ReadonlyMap<number, HistorialClinico>>(new Map());
  readonly cargando = signal(true);
  readonly cargandoHistorial = signal<ReadonlySet<number>>(new Set());
  readonly error = signal('');
  readonly errorHistorial = signal<ReadonlyMap<number, string>>(new Map());
  readonly cancelandoId = signal<number | null>(null);
  readonly pestanaActiva = signal(0);
  readonly pagina = signal(1);
  readonly total = signal(0);
  readonly tipo = computed<TipoListadoTurnos>(() => this.pestanaActiva() === 0 ? 'proximos' : 'todos');
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamanoPagina)));

  ngOnInit(): void {
    this.cargarTurnos();
  }

  ngOnDestroy(): void {
    this.consultaActual?.unsubscribe();
    this.limpiarHistorial();
  }

  cargarTurnos(): void {
    this.consultaActual?.unsubscribe();
    this.limpiarHistorial();
    this.turnos.set([]);
    this.error.set('');
    this.cargando.set(true);
    const pagina = this.pagina();
    this.consultaActual = this.turnosApi.listarMisTurnos(this.tipo(), pagina).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cargando.set(false))
    ).subscribe({
      next: (respuesta) => {
        const datos = respuesta.datos;
        if (!datos || !Array.isArray(datos.items) || !Number.isSafeInteger(datos.total) || datos.total < 0 ||
            datos.pagina !== pagina || datos.limite !== this.tamanoPagina) {
          this.error.set('La respuesta del servidor no contiene una página válida de turnos.');
          return;
        }
        this.total.set(datos.total);
        if (pagina > this.totalPaginas()) {
          this.pagina.set(this.totalPaginas());
          this.cargarTurnos();
          return;
        }
        this.turnos.set(datos.items);
      },
      error: (error: unknown) => this.error.set(mensajeErrorApi(error, 'No se pudieron cargar tus turnos.'))
    });
  }

  cambiarPestana(indice: number): void {
    if ((indice !== 0 && indice !== 1) || indice === this.pestanaActiva()) return;
    this.pestanaActiva.set(indice);
    this.pagina.set(1);
    this.cargarTurnos();
  }

  paginaAnterior(): void {
    if (this.cargando() || this.pagina() <= 1) return;
    this.pagina.update((pagina) => pagina - 1);
    this.cargarTurnos();
  }

  paginaSiguiente(): void {
    if (this.cargando() || this.pagina() >= this.totalPaginas()) return;
    this.pagina.update((pagina) => pagina + 1);
    this.cargarTurnos();
  }

  cargarHistorial(turno: TurnoPaciente, reintentar = false): void {
    if (turno.estado !== 'atendido' || this.consultasHistorial.has(turno.id) ||
        !this.turnos().some((item) => item.id === turno.id) ||
        (!reintentar && (this.historiales().has(turno.id) || this.errorHistorial().has(turno.id)))) return;
    const solicitud = new Subscription();
    this.consultasHistorial.set(turno.id, solicitud);
    this.cargandoHistorial.update((ids) => new Set([...ids, turno.id]));
    this.errorHistorial.update((errores) => {
      const siguientes = new Map(errores);
      siguientes.delete(turno.id);
      return siguientes;
    });
    solicitud.add(this.turnosApi.obtenerHistorial(turno.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (this.consultasHistorial.get(turno.id) !== solicitud) return;
        this.consultasHistorial.delete(turno.id);
        this.cargandoHistorial.update((ids) => {
          const siguientes = new Set(ids);
          siguientes.delete(turno.id);
          return siguientes;
        });
      })
    ).subscribe({
      next: (respuesta) => {
        if (!respuesta.datos || respuesta.datos.id_turno !== turno.id) {
          this.errorHistorial.update((errores) => new Map(errores).set(turno.id, 'La respuesta no contiene el resumen de este turno.'));
          return;
        }
        this.historiales.update((datos) => new Map(datos).set(turno.id, respuesta.datos!));
      },
      error: (error: unknown) => this.errorHistorial.update((errores) => new Map(errores).set(
        turno.id, mensajeErrorApi(error, 'No se pudo cargar el resumen clínico de este turno.')
      ))
    }));
  }

  historialDelTurno(idTurno: number): HistorialClinico | undefined {
    return this.historiales().get(idTurno);
  }

  cancelarTurno(turno: TurnoPaciente): void {
    if (this.cancelandoId() !== null || turno.estado !== 'confirmado') return;
    this.dialog.open<ConfirmacionDialogComponent, { titulo: string; mensaje: string; textoConfirmar: string }, boolean>(
      ConfirmacionDialogComponent,
      {
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
        data: {
          titulo: 'Cancelar turno',
          mensaje: `¿Querés cancelar el turno del ${this.formatearFecha(turno.fecha)} a las ${turno.hora}?`,
          textoConfirmar: 'Cancelar turno'
        }
      }
    ).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmada) => {
      if (!confirmada) return;
      this.cancelandoId.set(turno.id);
      this.turnosApi.cancelar(turno.id).pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cancelandoId.set(null))
      ).subscribe({
        next: () => {
          this.snackBar.open('Turno cancelado correctamente.', 'Cerrar', { duration: 4000 });
          this.cargarTurnos();
          this.notificaciones.actualizar();
        },
        error: (error: unknown) => this.snackBar.open(
          mensajeErrorApi(error, 'No se pudo cancelar el turno.'), 'Cerrar', { duration: 5000 }
        )
      });
    });
  }

  formatearFecha(fecha: string): string {
    const [anio, mes, dia] = fecha.slice(0, 10).split('-');
    return anio && mes && dia ? dia + '/' + mes + '/' + anio : fecha;
  }

  etiquetaEstado(estado: string): string {
    const etiquetas: Record<string, string> = { confirmado: 'Confirmado', cancelado: 'Cancelado', atendido: 'Atendido' };
    return etiquetas[estado] ?? estado;
  }

  private limpiarHistorial(): void {
    for (const consulta of this.consultasHistorial.values()) consulta.unsubscribe();
    this.consultasHistorial.clear();
    this.historiales.set(new Map());
    this.cargandoHistorial.set(new Set());
    this.errorHistorial.set(new Map());
  }
}
