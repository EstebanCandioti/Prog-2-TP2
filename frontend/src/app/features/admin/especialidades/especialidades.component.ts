import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Especialidad } from '../../../core/models/especialidad.model';
import { EspecialidadService } from '../../../core/services/especialidad.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';

@Component({
  selector: 'app-especialidades',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    ReactiveFormsModule
  ],
  templateUrl: './especialidades.component.html',
  styleUrl: './especialidades.component.css'
})
export class EspecialidadesComponent implements OnInit {
  private readonly especialidadesApi = inject(EspecialidadService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly especialidades = signal<Especialidad[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly eliminandoId = signal<number | null>(null);
  readonly error = signal('');
  readonly termino = signal('');
  readonly especialidadEnEdicion = signal<Especialidad | null>(null);
  readonly formularioVisible = signal(false);
  readonly especialidadesFiltradas = computed(() => {
    const termino = this.termino().trim().toLocaleLowerCase();
    if (!termino) return this.especialidades();

    return this.especialidades().filter((especialidad) =>
      especialidad.descripcion.toLocaleLowerCase().includes(termino)
    );
  });
  readonly formulario = this.formBuilder.nonNullable.group({
    descripcion: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)]]
  });

  ngOnInit(): void {
    this.cargarEspecialidades();
  }

  cargarEspecialidades(): void {
    this.cargando.set(true);
    this.error.set('');

    this.especialidadesApi.listar().subscribe({
      next: (respuesta) => {
        if (!respuesta.datos) {
          this.error.set('La respuesta del servidor no contiene el listado de especialidades.');
          this.cargando.set(false);
          return;
        }

        this.especialidades.set(respuesta.datos);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(mensajeErrorApi(error, 'No se pudieron cargar las especialidades.'));
        this.cargando.set(false);
      }
    });
  }

  buscar(event: Event): void {
    this.termino.set((event.target as HTMLInputElement).value);
  }

  nuevaEspecialidad(): void {
    this.especialidadEnEdicion.set(null);
    this.formulario.reset({ descripcion: '' });
    this.formularioVisible.set(true);
  }

  editarEspecialidad(especialidad: Especialidad): void {
    this.especialidadEnEdicion.set(especialidad);
    this.formulario.reset({ descripcion: especialidad.descripcion });
    this.formularioVisible.set(true);
  }

  cancelarEdicion(): void {
    this.formularioVisible.set(false);
    this.especialidadEnEdicion.set(null);
    this.formulario.reset({ descripcion: '' });
  }

  guardarEspecialidad(): void {
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    const especialidadActual = this.especialidadEnEdicion();
    const descripcion = this.formulario.controls.descripcion.value.trim();
    this.guardando.set(true);
    const solicitud = especialidadActual
      ? this.especialidadesApi.actualizar(especialidadActual.id, { descripcion })
      : this.especialidadesApi.crear({ descripcion });

    solicitud.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cancelarEdicion();
        this.snackBar.open(
          especialidadActual
            ? 'Especialidad actualizada correctamente.'
            : 'Especialidad creada correctamente.',
          'Cerrar',
          { duration: 3500 }
        );
        this.cargarEspecialidades();
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.snackBar.open(
          mensajeErrorApi(error, 'No se pudo guardar la especialidad.'),
          'Cerrar',
          { duration: 5000 }
        );
      }
    });
  }

  eliminarEspecialidad(especialidad: Especialidad): void {
    if (this.eliminandoId() !== null) return;

    const confirmar = window.confirm(
      `¿Está seguro de eliminar la especialidad "${especialidad.descripcion}"?`
    );
    if (!confirmar) return;

    this.eliminandoId.set(especialidad.id);
    this.especialidadesApi.eliminar(especialidad.id).subscribe({
      next: () => {
        this.eliminandoId.set(null);
        this.snackBar.open('Especialidad eliminada correctamente.', 'Cerrar', {
          duration: 3500
        });
        this.cargarEspecialidades();
      },
      error: (error: unknown) => {
        this.eliminandoId.set(null);
        this.snackBar.open(
          mensajeErrorApi(error, 'No se pudo eliminar la especialidad.'),
          'Cerrar',
          { duration: 5000 }
        );
      }
    });
  }
}
