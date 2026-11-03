import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

import { Cobertura } from '../../../core/models/cobertura.model';
import { CoberturaService } from '../../../core/services/cobertura.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { ConfirmacionDialogComponent } from '../../shared/confirmacion-dialog.component';

@Component({
  selector: 'app-coberturas',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTableModule,
    MatSnackBarModule,
    ReactiveFormsModule
  ],
  templateUrl: './coberturas.component.html',
  styleUrl: './coberturas.component.css'
})
export class CoberturasComponent implements OnInit {
  private readonly coberturasApi = inject(CoberturaService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly coberturas = signal<Cobertura[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly eliminandoId = signal<number | null>(null);
  readonly error = signal('');
  readonly termino = signal('');
  readonly coberturaEnEdicion = signal<Cobertura | null>(null);
  readonly formularioVisible = signal(false);
  readonly columnas = ['nombre', 'acciones'];
  readonly coberturasFiltradas = computed(() => {
    const termino = this.termino().trim().toLocaleLowerCase();
    if (!termino) return this.coberturas();

    return this.coberturas().filter((cobertura) =>
      cobertura.nombre.toLocaleLowerCase().includes(termino)
    );
  });
  readonly formulario = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)]]
  });

  ngOnInit(): void {
    this.cargarCoberturas();
  }

  cargarCoberturas(): void {
    this.cargando.set(true);
    this.error.set('');

    this.coberturasApi.listar().subscribe({
      next: (respuesta) => {
        if (!respuesta.datos) {
          this.error.set('La respuesta del servidor no contiene el listado de coberturas.');
          this.cargando.set(false);
          return;
        }

        this.coberturas.set(respuesta.datos);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.error.set(mensajeErrorApi(error, 'No se pudieron cargar las coberturas.'));
        this.cargando.set(false);
      }
    });
  }

  buscar(event: Event): void {
    this.termino.set((event.target as HTMLInputElement).value);
  }

  nuevaCobertura(): void {
    this.coberturaEnEdicion.set(null);
    this.formulario.reset({ nombre: '' });
    this.formularioVisible.set(true);
  }

  editarCobertura(cobertura: Cobertura): void {
    this.coberturaEnEdicion.set(cobertura);
    this.formulario.reset({ nombre: cobertura.nombre });
    this.formularioVisible.set(true);
  }

  cancelarEdicion(): void {
    this.formularioVisible.set(false);
    this.coberturaEnEdicion.set(null);
    this.formulario.reset({ nombre: '' });
  }

  guardarCobertura(): void {
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    const coberturaActual = this.coberturaEnEdicion();
    const nombre = this.formulario.controls.nombre.value.trim();
    this.guardando.set(true);
    const solicitud = coberturaActual
      ? this.coberturasApi.actualizar(coberturaActual.id, { nombre })
      : this.coberturasApi.crear({ nombre });

    solicitud.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cancelarEdicion();
        this.snackBar.open(
          coberturaActual ? 'Cobertura actualizada correctamente.' : 'Cobertura creada correctamente.',
          'Cerrar',
          { duration: 3500 }
        );
        this.cargarCoberturas();
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.snackBar.open(mensajeErrorApi(error, 'No se pudo guardar la cobertura.'), 'Cerrar', {
          duration: 5000
        });
      }
    });
  }

  eliminarCobertura(cobertura: Cobertura): void {
    if (this.eliminandoId() !== null) return;

    this.dialog.open<ConfirmacionDialogComponent, { titulo: string; mensaje: string }, boolean>(
      ConfirmacionDialogComponent,
      {
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
        data: { titulo: 'Eliminar cobertura', mensaje: `¿Está seguro de eliminar la cobertura "${cobertura.nombre}"?` }
      }
    ).afterClosed().subscribe((confirmada) => {
      if (!confirmada) return;
      this.eliminandoId.set(cobertura.id);
      this.coberturasApi.eliminar(cobertura.id).subscribe({
        next: () => {
          this.eliminandoId.set(null);
          this.snackBar.open('Cobertura eliminada correctamente.', 'Cerrar', { duration: 3500 });
          this.cargarCoberturas();
        },
        error: (error: unknown) => {
          this.eliminandoId.set(null);
          this.snackBar.open(mensajeErrorApi(error, 'No se pudo eliminar la cobertura.'), 'Cerrar', {
            duration: 5000
          });
        }
      });
    });
  }
}
