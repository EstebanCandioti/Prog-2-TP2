import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Sede } from '../../../core/models/sede.model';
import { SedeService } from '../../../core/services/sede.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';

@Component({
  selector: 'app-sedes',
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
  templateUrl: './sedes.component.html',
  styleUrl: './sedes.component.css'
})
export class SedesComponent implements OnInit {
  private readonly sedesApi = inject(SedeService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  readonly sedes = signal<Sede[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly eliminandoId = signal<number | null>(null);
  readonly error = signal('');
  readonly termino = signal('');
  readonly sedeEnEdicion = signal<Sede | null>(null);
  readonly formularioVisible = signal(false);
  readonly sedesFiltradas = computed(() => {
    const termino = this.termino().trim().toLocaleLowerCase();
    if (!termino) return this.sedes();

    return this.sedes().filter((sede) =>
      [sede.nombre, sede.direccion, sede.telefono].some((valor) =>
        valor.toLocaleLowerCase().includes(termino)
      )
    );
  });
  readonly formulario = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(50)]],
    direccion: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    telefono: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(15)]]
  });

  ngOnInit(): void {
    this.cargarSedes();
  }

  cargarSedes(): void {
    this.cargando.set(true);
    this.error.set('');

    this.sedesApi.listar().subscribe({
      next: (respuesta) => {
        if (!respuesta.datos) {
          this.error.set('La respuesta del servidor no contiene el listado de sedes.');
          this.cargando.set(false);
          return;
        }

        this.sedes.set(respuesta.datos);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(mensajeErrorApi(error, 'No se pudieron cargar las sedes.'));
        this.cargando.set(false);
      }
    });
  }

  buscar(event: Event): void {
    this.termino.set((event.target as HTMLInputElement).value);
  }

  nuevaSede(): void {
    this.sedeEnEdicion.set(null);
    this.formulario.reset({ nombre: '', direccion: '', telefono: '' });
    this.formularioVisible.set(true);
  }

  editarSede(sede: Sede): void {
    this.sedeEnEdicion.set(sede);
    this.formulario.reset({
      nombre: sede.nombre,
      direccion: sede.direccion,
      telefono: sede.telefono
    });
    this.formularioVisible.set(true);
  }

  cancelarEdicion(): void {
    this.formularioVisible.set(false);
    this.sedeEnEdicion.set(null);
    this.formulario.reset({ nombre: '', direccion: '', telefono: '' });
  }

  guardarSede(): void {
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    const sedeActual = this.sedeEnEdicion();
    const valores = this.formulario.getRawValue();
    const datos = {
      nombre: valores.nombre.trim(),
      direccion: valores.direccion.trim(),
      telefono: valores.telefono.trim()
    };

    this.guardando.set(true);
    const solicitud = sedeActual
      ? this.sedesApi.actualizar(sedeActual.id, datos)
      : this.sedesApi.crear(datos);

    solicitud.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cancelarEdicion();
        this.snackBar.open(
          sedeActual ? 'Sede actualizada correctamente.' : 'Sede creada correctamente.',
          'Cerrar',
          { duration: 3500 }
        );
        this.cargarSedes();
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.snackBar.open(mensajeErrorApi(error, 'No se pudo guardar la sede.'), 'Cerrar', {
          duration: 5000
        });
      }
    });
  }

  eliminarSede(sede: Sede): void {
    if (this.eliminandoId() !== null) return;

    const confirmar = window.confirm(`¿Está seguro de eliminar la sede "${sede.nombre}"?`);
    if (!confirmar) return;

    this.eliminandoId.set(sede.id);
    this.sedesApi.eliminar(sede.id).subscribe({
      next: () => {
        this.eliminandoId.set(null);
        this.snackBar.open('Sede eliminada correctamente.', 'Cerrar', { duration: 3500 });
        this.cargarSedes();
      },
      error: (error: unknown) => {
        this.eliminandoId.set(null);
        this.snackBar.open(mensajeErrorApi(error, 'No se pudo eliminar la sede.'), 'Cerrar', {
          duration: 5000
        });
      }
    });
  }
}
