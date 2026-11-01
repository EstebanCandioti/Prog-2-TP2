import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './core/services/auth.service';
import { navigationByRole } from './core/config/navigation';
import { SessionService } from './core/services/session.service';
import { RolUsuario } from './core/models/usuario.model';
import { NotificacionService } from './core/services/notificacion.service';
import { mensajeErrorApi } from './core/utils/mensaje-error-api';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule, MatTooltipModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class App {
  protected readonly title = signal('Clínica Virtual');
  readonly session = inject(SessionService);
  readonly notificacionService = inject(NotificacionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly profile = signal<{ nombre: string; apellido: string } | null>(null);
  readonly profileError = signal('');
  readonly navItems = computed(() => {
    const role = this.session.sesionActual()?.usuario.rol;
    return role ? navigationByRole[role] : [];
  });
  readonly displayName = computed(() => {
    const profile = this.profile();
    return profile ? `${profile.nombre} ${profile.apellido}` : 'Mi cuenta';
  });
  readonly displayRole = computed(() => this.roleLabel(this.session.sesionActual()?.usuario.rol));

  constructor() {
    effect((onCleanup) => {
      if (!this.session.sesionActual()) {
        this.notificacionService.limpiar();
        return;
      }

      const subscription = this.notificacionService.actualizarLista();
      onCleanup(() => subscription.unsubscribe());
    });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.session.tieneSesion()) this.notificacionService.actualizarLista();
      });

    effect((onCleanup) => {
      if (!this.session.sesionActual()) {
        this.profile.set(null);
        this.profileError.set('');
        return;
      }

      const subscription = this.auth.obtenerPerfil().subscribe({
        next: (response) => {
          this.profile.set(response.datos);
          this.profileError.set('');
        },
        error: (error: unknown) => {
          this.profile.set(null);
          this.profileError.set(
            mensajeErrorApi(error, 'No se pudo cargar la información de tu cuenta.')
          );
        }
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  cerrarSesion(): void {
    this.session.cerrarSesion();
    void this.router.navigateByUrl('/');
  }

  private roleLabel(role?: RolUsuario): string {
    const labels: Record<RolUsuario, string> = {
      admin: 'Administrador',
      medico: 'Médico',
      operador: 'Operador',
      paciente: 'Paciente'
    };
    return role ? labels[role] : '';
  }
}
