import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-estado-page',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  template: `
    <section class="state-page">
      <mat-card class="state-card">
        <mat-icon class="state-icon">{{ icon }}</mat-icon>
        <p class="eyebrow">CLÍNICA VIRTUAL</p>
        <h1>{{ title }}</h1>
        <p class="description">{{ description }}</p>
        <a mat-flat-button color="primary" routerLink="/">
          <mat-icon>home</mat-icon>
          Volver al inicio
        </a>
      </mat-card>
    </section>
  `,
  styles: [`
    .state-page { display: grid; min-height: 54vh; place-items: center; padding: 48px 20px; }
    .state-card { width: min(100%, 520px); padding: 34px; border-radius: 8px; text-align: center; }
    .state-icon { width: 52px; height: 52px; color: var(--green-700); font-size: 52px; }
    .eyebrow { margin: 18px 0 8px; color: var(--green-700); font-size: 12px; font-weight: 700; }
    h1 { margin: 0; color: var(--ink); font-size: 28px; }
    .description { margin: 12px 0 24px; color: var(--ink-soft); line-height: 1.6; }
  `]
})
export class EstadoPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] ?? 'Página';
  readonly description = this.route.snapshot.data['description'] ?? '';
  readonly icon = this.route.snapshot.data['icon'] ?? 'info';
}