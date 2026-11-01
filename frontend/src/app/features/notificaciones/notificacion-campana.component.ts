import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { DatePipe } from '@angular/common';
import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { NotificacionService } from '../../core/services/notificacion.service';
import { SessionService } from '../../core/services/session.service';
import { NotificacionMarcadoMasivoComponent } from './notificacion-marcado-masivo.component';

@Component({
  selector: 'app-notificacion-campana',
  standalone: true,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, CdkTrapFocus, DatePipe, MatBadgeModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, RouterLink,
    NotificacionMarcadoMasivoComponent],
  templateUrl: './notificacion-campana.component.html',
  styleUrl: './notificacion-campana.component.css'
})
export class NotificacionCampanaComponent {
  readonly notificaciones = inject(NotificacionService);
  private readonly session = inject(SessionService);
  private readonly campana = viewChild.required('campana', { read: ElementRef });
  private readonly cierre = viewChild('cierre', { read: ElementRef });
  readonly abierto = signal(false);
  readonly posiciones: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 }
  ];

  constructor() {
    effect(() => {
      this.session.sesionActual();
      this.abierto.set(false);
    });
  }

  alternar(): void {
    this.campana().nativeElement.focus();
    this.abierto.update((abierto) => !abierto);
    if (this.abierto()) this.notificaciones.actualizar();
  }

  cerrarDesdeFuera(event: MouseEvent): void {
    // El clic en el origen ya lo atiende alternar(), sin cerrar y volver a abrir.
    if (!this.campana().nativeElement.contains(event.target as Node)) this.abierto.set(false);
  }

  manejarTecla(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.abierto.set(false);
  }

  marcarComoLeida(id: number): void {
    this.notificaciones.marcarComoLeida(id);
    // La acción desaparecerá al marcarse: conservar el foco en un control estable del panel.
    this.cierre()?.nativeElement.focus();
  }
}
