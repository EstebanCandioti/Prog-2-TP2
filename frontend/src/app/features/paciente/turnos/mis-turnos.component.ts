import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { HistorialClinico, TurnoPaciente } from '../../../core/models/turno.model';
import { HistorialClinicoService } from '../../../core/services/historial-clinico.service';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { SessionService } from '../../../core/services/session.service';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';

@Component({
  selector: 'app-mis-turnos',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatSnackBarModule
  ],
  templateUrl: './mis-turnos.component.html',
  styleUrl: './mis-turnos.component.css'
})
export class MisTurnosComponent implements OnInit {
  private readonly tamanoPagina = 10;
  private readonly turnosApi = inject(TurnoService);
  private readonly historialApi = inject(HistorialClinicoService);
  private readonly session = inject(SessionService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly snackBar = inject(MatSnackBar);

  readonly turnos = signal<TurnoPaciente[]>([]);
  readonly historiales = signal<HistorialClinico[]>([]);
  readonly cargando = signal(true);
  readonly cargandoHistorial = signal(false);
  readonly error = signal('');
  readonly errorHistorial = signal('');
  readonly cancelandoId = signal<number | null>(null);
  readonly pestanaActiva = signal(0);
  readonly pagina = signal(1);
  readonly turnosProximos = computed(() =>
    this.turnos()
      .filter((turno) => turno.estado === 'confirmado' && this.esFechaFutura(turno))
      .sort((a, b) => this.fechaHora(a).localeCompare(this.fechaHora(b)))
  );
  readonly turnosHistorial = computed(() =>
    this.turnos()
      .filter((turno) => turno.estado !== 'confirmado' || !this.esFechaFutura(turno))
      .sort((a, b) => this.fechaHora(b).localeCompare(this.fechaHora(a)))
  );
  readonly turnosPestanaActiva = computed(() =>
    this.pestanaActiva() === 0 ? this.turnosProximos() : this.turnosHistorial()
  );
  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.turnosPestanaActiva().length / this.tamanoPagina))
  );
  readonly turnosPagina = computed(() => {
    const inicio = (this.pagina() - 1) * this.tamanoPagina;
    return this.turnosPestanaActiva().slice(inicio, inicio + this.tamanoPagina);
  });

  ngOnInit(): void {
    this.cargarTurnos();
  }

  cargarTurnos(): void {
    this.cargando.set(true);
    this.error.set('');
    this.errorHistorial.set('');

    this.turnosApi
      .listarMisTurnos()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.datos) {
            this.error.set('La respuesta del servidor no contiene el listado de turnos.');
            return;
          }

          this.turnos.set(respuesta.datos);
          this.pagina.set(1);
          if (respuesta.datos.some((turno) => turno.estado === 'atendido')) {
            this.cargarHistorial();
          } else {
            this.historiales.set([]);
          }
        },
        error: (error: unknown) => {
          this.error.set(mensajeErrorApi(error, 'No se pudieron cargar tus turnos.'));
        }
      });
  }

  cambiarPestana(indice: number): void {
    this.pestanaActiva.set(indice);
    this.pagina.set(1);
  }

  paginaAnterior(): void {
    if (this.pagina() > 1) this.pagina.update((pagina) => pagina - 1);
  }

  paginaSiguiente(): void {
    if (this.pagina() < this.totalPaginas()) this.pagina.update((pagina) => pagina + 1);
  }

  cargarHistorial(): void {
    const idPaciente = this.session.obtenerUsuario()?.id;
    if (!idPaciente) {
      this.errorHistorial.set('No se pudo identificar al paciente para consultar el historial clínico.');
      return;
    }

    this.cargandoHistorial.set(true);
    this.errorHistorial.set('');
    this.historialApi
      .listarDelPaciente(idPaciente)
      .pipe(finalize(() => this.cargandoHistorial.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.datos) {
            this.errorHistorial.set('La respuesta del servidor no contiene el historial clínico.');
            return;
          }
          this.historiales.set(respuesta.datos);
        },
        error: (error: unknown) => {
          this.errorHistorial.set(
            mensajeErrorApi(error, 'No se pudo cargar el historial clínico de tus turnos.')
          );
        }
      });
  }

  historialDelTurno(idTurno: number): HistorialClinico | undefined {
    return this.historiales().find((historial) => historial.id_turno === idTurno);
  }

  cancelarTurno(turno: TurnoPaciente): void {
    if (this.cancelandoId() !== null || turno.estado !== 'confirmado') return;

    if (!window.confirm(`¿Querés cancelar el turno del ${this.formatearFecha(turno.fecha)} a las ${turno.hora}?`)) {
      return;
    }

    this.cancelandoId.set(turno.id);
    this.turnosApi
      .cancelar(turno.id)
      .pipe(finalize(() => this.cancelandoId.set(null)))
      .subscribe({
        next: () => {
          this.snackBar.open('Turno cancelado correctamente.', 'Cerrar', { duration: 4000 });
          this.cargarTurnos();
          this.notificaciones.actualizarLista();
        },
        error: (error: unknown) => {
          this.snackBar.open(
            mensajeErrorApi(error, 'No se pudo cancelar el turno.'),
            'Cerrar',
            { duration: 5000 }
          );
        }
      });
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

  private esFechaFutura(turno: TurnoPaciente): boolean {
    return this.fechaHora(turno) >= this.fechaHoraActual();
  }

  private fechaHora(turno: TurnoPaciente): string {
    return `${turno.fecha.slice(0, 10)}T${turno.hora.slice(0, 5)}`;
  }

  private fechaHoraActual(): string {
    const ahora = new Date();
    const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
    return `${fecha}T${hora}`;
  }
}
