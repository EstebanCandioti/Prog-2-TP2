import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';

import { PerfilResponse } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { mensajeErrorApi } from '../../core/utils/mensaje-error-api';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  private readonly auth = inject(AuthService);
  readonly perfil = signal<PerfilResponse | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.cargarPerfil();
  }

  cargarPerfil(): void {
    this.cargando.set(true);
    this.error.set('');
    this.auth.obtenerPerfil().pipe(finalize(() => this.cargando.set(false))).subscribe({
      next: (response) => this.perfil.set(response.datos),
      error: (error: unknown) => this.error.set(mensajeErrorApi(error, 'No se pudo cargar tu perfil.'))
    });
  }
}