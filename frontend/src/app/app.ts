import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './core/services/auth.service';
import { navigationByRole } from './core/config/navigation';
import { SessionService } from './core/services/session.service';
import { RolUsuario } from './core/models/usuario.model';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule, MatTooltipModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class App {
  protected readonly title = signal('Clínica Virtual');
  readonly session = inject(SessionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly profile = signal<{ nombre: string; apellido: string } | null>(null);
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
        this.profile.set(null);
        return;
      }

      const subscription = this.auth.obtenerPerfil().subscribe({
        next: (response) => this.profile.set(response.datos),
        error: () => this.profile.set(null)
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
