import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { navigationByRole } from '../../core/config/navigation';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css'
})
export class InicioComponent {
  private readonly session = inject(SessionService);
  readonly opciones = computed(() => {
    const role = this.session.sesionActual()?.usuario.rol;
    return role ? navigationByRole[role] : [];
  });

  sessionActive(): boolean {
    return this.session.tieneSesion();
  }
}