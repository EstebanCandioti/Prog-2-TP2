import { Component, ElementRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { NotificacionService } from '../../core/services/notificacion.service';

@Component({
  selector: 'app-notificacion-marcado-masivo',
  standalone: true,
  host: { tabindex: '-1', role: 'group', 'aria-label': 'Acciones de marcado masivo' },
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <button mat-stroked-button type="button" (click)="marcarTodas()"
      [disabled]="!notificaciones.puedeMarcarTodas()"
      aria-label="Marcar todas como leídas: incluye todas tus notificaciones pendientes, no solo las visibles">
      <mat-icon>done_all</mat-icon>Marcar todas como leídas
    </button>
    <p class="help">Incluye todas tus notificaciones pendientes, no solo las visibles.</p>
    @if (notificaciones.marcandoTodas()) {
      <p class="progress" role="status" aria-live="polite"><mat-spinner diameter="20"></mat-spinner>Marcando todas y actualizando la lista…</p>
    } @else if (notificaciones.marcando().size > 0) {
      <p class="help" role="status">Esperá a que termine el marcado individual.</p>
    } @else if (notificaciones.sincronizacionPendiente()) {
      <p class="help" role="status">El marcado se realizó. Reintentá la consulta para sincronizar la lista antes de volver a marcar.</p>
    }
    @if (notificaciones.errorMasivo()) {
      <p class="error" role="alert">{{ notificaciones.errorMasivo() }}</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    :host:focus-visible { outline: 2px solid var(--green-700); outline-offset: 4px; border-radius: 4px; }
    button { max-width: 100%; height: auto; min-height: 40px; padding-block: 8px; white-space: normal; }
    button:not(:disabled) { color: var(--green-800); }
    p { margin: 8px 0 0; font-size: 13px; line-height: 1.5; white-space: normal; }
    .help, .progress { color: var(--ink-soft); }
    .progress { display: flex; align-items: center; gap: 8px; }
    mat-spinner { flex-shrink: 0; }
    .error { color: #8c1d18; overflow-wrap: anywhere; }
  `
})
export class NotificacionMarcadoMasivoComponent {
  readonly notificaciones = inject(NotificacionService);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  marcarTodas(): void {
    this.notificaciones.marcarTodasComoLeidas();
    // El botón queda deshabilitado durante PATCH + GET: mantener el foco dentro de las acciones.
    if (this.notificaciones.marcandoTodas()) this.elemento.nativeElement.focus();
  }
}
