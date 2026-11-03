import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { Cobertura } from '../../core/models/cobertura.model';
import { PerfilResponse } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { CoberturaService } from '../../core/services/cobertura.service';
import { SessionService } from '../../core/services/session.service';
import { mensajeErrorApi } from '../../core/utils/mensaje-error-api';

const validarBytesPassword = (control: { value: unknown }) => {
  if (typeof control.value !== 'string' || control.value.length === 0) return null;
  return new TextEncoder().encode(control.value).length <= 72 ? null : { maxBytes: true };
};

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    ReactiveFormsModule
  ],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly coberturaApi = inject(CoberturaService);
  private readonly session = inject(SessionService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly perfil = signal<PerfilResponse | null>(null);
  readonly coberturas = signal<Cobertura[]>([]);
  readonly esPaciente = this.session.obtenerUsuario()?.rol === 'paciente';
  readonly cargando = signal(true);
  readonly cargandoCoberturas = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal(false);
  readonly error = signal('');
  readonly errorCoberturas = signal('');
  readonly errorFormulario = signal('');

  readonly formulario = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(30)]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{7,10}$/)]],
    idCobertura: this.formBuilder.control<number | null>(null, Validators.required),
    password: ['', [Validators.minLength(8), Validators.maxLength(72), validarBytesPassword]],
    confirmarPassword: ['']
  });

  ngOnInit(): void {
    this.cargarPerfil();
    if (this.esPaciente) this.cargarCoberturas();
  }

  cargarPerfil(): void {
    this.cargando.set(true);
    this.error.set('');
    this.auth
      .obtenerPerfil()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.datos) {
            this.error.set('La respuesta del servidor no contiene los datos del perfil.');
            return;
          }
          this.perfil.set(response.datos);
        },
        error: (error: unknown) =>
          this.error.set(mensajeErrorApi(error, 'No se pudo cargar tu perfil.'))
      });
  }

  cargarCoberturas(): void {
    this.cargandoCoberturas.set(true);
    this.errorCoberturas.set('');
    this.coberturaApi
      .listar()
      .pipe(finalize(() => this.cargandoCoberturas.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.datos) {
            this.errorCoberturas.set('La respuesta del servidor no contiene las coberturas.');
            return;
          }
          this.coberturas.set(response.datos);
        },
        error: (error: unknown) =>
          this.errorCoberturas.set(mensajeErrorApi(error, 'No se pudieron cargar las coberturas.'))
      });
  }

  comenzarEdicion(): void {
    const usuario = this.perfil();
    if (!usuario || !this.esPaciente || this.cargandoCoberturas()) return;
    this.formulario.reset({
      email: usuario.email,
      telefono: usuario.telefono,
      idCobertura: usuario.id_cobertura,
      password: '',
      confirmarPassword: ''
    });
    this.errorFormulario.set('');
    this.editando.set(true);
  }

  cancelarEdicion(): void {
    this.editando.set(false);
    this.errorFormulario.set('');
    this.formulario.reset({
      email: this.perfil()?.email ?? '',
      telefono: this.perfil()?.telefono ?? '',
      idCobertura: this.perfil()?.id_cobertura ?? null,
      password: '',
      confirmarPassword: ''
    });
  }

  filtrarTelefono(event: Event): void {
    const input = event.target as HTMLInputElement;
    const telefono = input.value.replace(/[^0-9]/g, '');
    if (input.value !== telefono) {
      input.value = telefono;
      this.formulario.controls.telefono.setValue(telefono);
    }
  }

  guardarCambios(): void {
    this.errorFormulario.set('');
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    if (valores.password || valores.confirmarPassword) {
      if (!valores.password || !valores.confirmarPassword) {
        this.errorFormulario.set('Ingresá y repetí la nueva contraseña.');
        return;
      }
      if (valores.password !== valores.confirmarPassword) {
        this.errorFormulario.set('Las contraseñas no coinciden.');
        return;
      }
    }
    if (valores.idCobertura === null) {
      this.errorFormulario.set('Seleccioná una cobertura.');
      return;
    }

    const datos = {
      email: valores.email.trim(),
      telefono: valores.telefono.trim(),
      id_cobertura: valores.idCobertura,
      ...(valores.password ? { password: valores.password } : {})
    };

    this.guardando.set(true);
    this.auth
      .actualizarPerfilPaciente(datos)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.datos) {
            this.errorFormulario.set('La respuesta del servidor no contiene el perfil actualizado.');
            return;
          }
          this.perfil.set(response.datos);
          this.editando.set(false);
          this.snackBar.open('Tus datos se actualizaron correctamente.', 'Cerrar', {
            duration: 4000
          });
        },
        error: (error: unknown) =>
          this.errorFormulario.set(mensajeErrorApi(error, 'No se pudieron actualizar tus datos.'))
      });
  }

  nombreCobertura(id: number | null): string {
    if (id === null) return 'No informada';
    return this.coberturas().find((cobertura) => cobertura.id === id)?.nombre ?? `Cobertura ${id}`;
  }
}
