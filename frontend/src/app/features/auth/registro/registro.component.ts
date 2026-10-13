import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Cobertura } from '../../../core/models/cobertura.model';
import { AuthService } from '../../../core/services/auth.service';
import { CoberturaService } from '../../../core/services/cobertura.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';

const fechaNoFutura: ValidatorFn = (control) => {
  const value = control.value as string;
  return value && value > new Date().toISOString().slice(0, 10) ? { fechaFutura: true } : null;
};

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly coberturaService = inject(CoberturaService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  readonly coberturas = signal<Cobertura[]>([]);
  readonly cargandoCoberturas = signal(true);
  readonly errorCoberturas = signal('');
  readonly enviando = signal(false);
  readonly verPassword = signal(false);
  readonly fechaMaxima = new Date().toISOString().slice(0, 10);
  readonly form = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(30)]],
    apellido: ['', [Validators.required, Validators.maxLength(30)]],
    dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(30)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    fecha_nacimiento: ['', [Validators.required, fechaNoFutura]],
    id_cobertura: [0, [Validators.required, Validators.min(1)]]
  });

  ngOnInit(): void {
    this.cargarCoberturas();
  }

  cargarCoberturas(): void {
    this.cargandoCoberturas.set(true);
    this.errorCoberturas.set('');
    this.coberturaService.listarDisponibles().pipe(finalize(() => this.cargandoCoberturas.set(false))).subscribe({
      next: (response) => {
        this.coberturas.set(response.datos ?? []);
        if (!response.datos?.length) this.errorCoberturas.set('No hay coberturas disponibles para seleccionar.');
      },
      error: (error: unknown) => this.errorCoberturas.set(mensajeErrorApi(error, 'No se pudo cargar el listado de coberturas.'))
    });
  }

  registrar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    this.enviando.set(true);
    this.auth.registrar({ ...values, id_cobertura: Number(values.id_cobertura) })
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.datos) {
            this.snackBar.open('No se pudo completar el registro.', 'Cerrar', {
              duration: 5000,
              panelClass: ['app-snackbar', 'app-snackbar-error']
            });
            return;
          }
          this.snackBar.open('Registro exitoso. Ya podés iniciar sesión.', 'Cerrar', {
            duration: 5000,
            panelClass: ['app-snackbar', 'app-snackbar-success']
          });
          void this.router.navigateByUrl('/login');
        },
        error: (error: unknown) => {
          this.snackBar.open(mensajeErrorApi(error, 'No se pudo completar el registro. Revisá los datos.'), 'Cerrar', {
            duration: 7000,
            panelClass: ['app-snackbar', 'app-snackbar-error']
          });
        }
      });
  }
}
