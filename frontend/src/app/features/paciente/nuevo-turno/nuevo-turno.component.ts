import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, forkJoin, startWith, Subject, switchMap, tap } from 'rxjs';

import { PacienteReserva, SolicitudTurno } from '../../../core/models/turno.model';
import { AuthService } from '../../../core/services/auth.service';
import { CoberturaService } from '../../../core/services/cobertura.service';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { ReservaTurnoComponent } from '../../shared/reserva-turno/reserva-turno.component';

@Component({
  selector: 'app-nuevo-turno',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, RouterLink, ReservaTurnoComponent],
  templateUrl: './nuevo-turno.component.html',
  styleUrl: './nuevo-turno.component.css'
})
export class NuevoTurnoComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly coberturas = inject(CoberturaService);
  private readonly turnos = inject(TurnoService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recargarPerfil$ = new Subject<void>();

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly paciente = signal<PacienteReserva | null>(null);
  readonly reservarTurno = (solicitud: SolicitudTurno) => this.turnos.crear(solicitud);

  ngOnInit(): void {
    this.recargarPerfil$.pipe(
      startWith(undefined),
      switchMap(() => {
        this.cargando.set(true);
        this.error.set('');
        this.paciente.set(null);
        return forkJoin({ perfil: this.auth.obtenerPerfil(), coberturas: this.coberturas.listar() }).pipe(
          tap(({ perfil, coberturas }) => {
            this.cargando.set(false);
            const usuario = perfil.datos;
            if (!usuario || usuario.rol !== 'paciente' || !Number.isSafeInteger(usuario.id) || usuario.id <= 0) {
              this.error.set('No se pudo obtener el perfil del paciente. Reintentá la carga.');
              return;
            }
            if (!Array.isArray(coberturas.datos)) {
              this.error.set('No se pudo obtener el listado de coberturas. Reintentá la carga.');
              return;
            }
            const cobertura = coberturas.datos.find((item) => item.id === usuario.id_cobertura);
            if (!cobertura || !Number.isSafeInteger(cobertura.id) || cobertura.id <= 0 || !cobertura.nombre.trim()) {
              this.error.set('No tenés una cobertura válida registrada. Revisá tu perfil antes de reservar.');
              return;
            }
            this.paciente.set({ id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, cobertura });
          }),
          catchError((error: unknown) => {
            this.cargando.set(false);
            this.error.set(mensajeErrorApi(error, 'No se pudo cargar tu perfil o cobertura. Revisá la conexión y reintentá.'));
            return EMPTY;
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  reintentar(): void {
    this.recargarPerfil$.next();
  }

  verMisTurnos(): void {
    void this.router.navigateByUrl('/paciente/turnos');
  }
}
