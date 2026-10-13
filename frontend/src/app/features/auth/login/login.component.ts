import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { AuthService } from '../../../core/services/auth.service';
import { SessionService } from '../../../core/services/session.service';
import { RolUsuario } from '../../../core/models/usuario.model';

const inicioPorRol: Record<RolUsuario, string> = {
  admin: '/admin',
  medico: '/medico',
  operador: '/operador',
  paciente: '/paciente'
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  readonly enviando = signal(false);
  readonly verPassword = signal(false);
  readonly form = this.formBuilder.nonNullable.group({
    dni: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    password: ['', Validators.required]
  });

  ingresar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.auth.login(this.form.getRawValue()).pipe(finalize(() => this.enviando.set(false))).subscribe({
      next: (response) => {
        if (!response.datos?.token) {
          this.snackBar.open('El servidor no devolvió una sesión válida.', 'Cerrar', {
            duration: 5000,
            panelClass: ['app-snackbar', 'app-snackbar-error']
          });
          return;
        }
        this.session.guardarSesion(response.datos);
        const destino = this.route.snapshot.queryParamMap.get('returnUrl') ?? inicioPorRol[response.datos.usuario.rol];
        void this.router.navigateByUrl(destino);
      },
      error: (error: unknown) => {
        this.snackBar.open(mensajeErrorApi(error, 'No se pudo iniciar sesión. Revisá el DNI y la contraseña.'), 'Cerrar', {
          duration: 6000,
          panelClass: ['app-snackbar', 'app-snackbar-error']
        });
      }
    });
  }
}
