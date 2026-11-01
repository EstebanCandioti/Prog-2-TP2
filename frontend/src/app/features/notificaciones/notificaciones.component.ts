import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { NotificacionService } from '../../core/services/notificacion.service';
import { NotificacionMarcadoMasivoComponent } from './notificacion-marcado-masivo.component';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, NotificacionMarcadoMasivoComponent],
  templateUrl: './notificaciones.component.html',
  styleUrl: './notificaciones.component.css'
})
export class NotificacionesComponent implements OnInit {
  readonly notificaciones = inject(NotificacionService);

  ngOnInit(): void {
    this.notificaciones.actualizar();
  }
}
