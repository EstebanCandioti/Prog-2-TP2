import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Notificacion } from '../models/notificacion.model';
import { mensajeErrorApi } from '../utils/mensaje-error-api';

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/notificaciones`;

  readonly notificaciones = signal<Notificacion[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly marcandoId = signal<number | null>(null);
  readonly cantidadNoLeidas = computed(
    () => this.notificaciones().filter((notificacion) => !this.estaLeida(notificacion)).length
  );
  cargar(): Observable<ApiResponse<Notificacion[]>> {
    this.cargando.set(true);
    this.error.set('');

    return this.http.get<ApiResponse<Notificacion[]>>(this.url);
  }

  actualizarLista(): Subscription {
    return this.cargar().subscribe({
      next: (respuesta) => {
        if (!respuesta.datos) {
          this.error.set('La respuesta del servidor no contiene las notificaciones.');
          this.cargando.set(false);
          return;
        }

        this.notificaciones.set(
          [...respuesta.datos].sort((a, b) => {
            const diferencia = Date.parse(b.fecha) - Date.parse(a.fecha);
            return Number.isNaN(diferencia) || diferencia === 0 ? b.id - a.id : diferencia;
          })
        );
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(mensajeErrorApi(error, 'No se pudieron cargar las notificaciones.'));
        this.cargando.set(false);
      }
    });
  }

  marcarComoLeida(id: number): void {
    if (this.marcandoId() !== null) return;

    const notificacionAnterior = this.notificaciones().find((notificacion) => notificacion.id === id);
    this.error.set('');
    this.marcandoId.set(id);
    this.notificaciones.update((notificaciones) =>
      notificaciones.map((notificacion) =>
        notificacion.id === id ? { ...notificacion, leida: true } : notificacion
      )
    );
    this.http.patch<ApiResponse<Notificacion>>(`${this.url}/${id}/leida`, {}).subscribe({
      next: (respuesta) => {
        if (!respuesta.datos) {
          this.error.set('La respuesta del servidor no contiene la notificación actualizada.');
          this.restaurarNotificacion(id, notificacionAnterior);
          this.marcandoId.set(null);
          return;
        }

        const notificacionActualizada = respuesta.datos;
        this.notificaciones.update((notificaciones) =>
          notificaciones.map((notificacion) =>
            notificacion.id === id ? notificacionActualizada : notificacion
          )
        );
        this.marcandoId.set(null);
      },
      error: (error: unknown) => {
        this.error.set(mensajeErrorApi(error, 'No se pudo marcar la notificación como leída.'));
        this.restaurarNotificacion(id, notificacionAnterior);
        this.marcandoId.set(null);
      }
    });
  }

  limpiar(): void {
    this.notificaciones.set([]);
    this.cargando.set(false);
    this.error.set('');
    this.marcandoId.set(null);
  }

  estaLeida(notificacion: Notificacion): boolean {
    return notificacion.leida === true || Number(notificacion.leida) === 1;
  }

  private restaurarNotificacion(id: number, notificacionAnterior: Notificacion | undefined): void {
    if (!notificacionAnterior) return;
    this.notificaciones.update((notificaciones) =>
      notificaciones.map((notificacion) =>
        notificacion.id === id ? notificacionAnterior : notificacion
      )
    );
  }
}
