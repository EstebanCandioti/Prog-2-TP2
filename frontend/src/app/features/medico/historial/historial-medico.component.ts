import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';

import { HistorialClinico } from '../../../core/models/turno.model';
import { PacienteBusqueda } from '../../../core/models/usuario-admin.model';
import { HistorialClinicoService } from '../../../core/services/historial-clinico.service';
import { UsuarioAdminService } from '../../../core/services/usuario-admin.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';

const TAMANO_PAGINA = 20;

@Component({
  selector: 'app-historial-medico',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    ReactiveFormsModule
  ],
  templateUrl: './historial-medico.component.html',
  styleUrl: './historial-medico.component.css'
})
export class HistorialMedicoComponent {
  private readonly usuariosApi = inject(UsuarioAdminService);
  private readonly historialApi = inject(HistorialClinicoService);
  private readonly formBuilder = inject(FormBuilder);

  readonly pacientes = signal<PacienteBusqueda[]>([]);
  readonly pacienteSeleccionado = signal<PacienteBusqueda | null>(null);
  readonly historiales = signal<HistorialClinico[]>([]);
  readonly buscando = signal(false);
  readonly cargandoHistorial = signal(false);
  readonly errorBusqueda = signal('');
  readonly errorHistorial = signal('');
  readonly pagina = signal(1);
  readonly totalPacientes = signal(0);
  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalPacientes() / TAMANO_PAGINA))
  );
  readonly columnas = ['paciente', 'dni', 'fechaNacimiento', 'accion'];

  readonly formulario = this.formBuilder.nonNullable.group({
    termino: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]]
  });

  buscar(): void {
    this.errorBusqueda.set('');
    this.formulario.controls.termino.markAsTouched();
    const termino = this.formulario.controls.termino.value.trim();
    if (this.formulario.invalid || !termino) {
      this.errorBusqueda.set('Ingresá un DNI o apellido para buscar.');
      return;
    }

    const esNumerico = /^\d+$/.test(termino);
    if (esNumerico && !/^\d{7,8}$/.test(termino)) {
      this.errorBusqueda.set('El DNI debe tener 7 u 8 dígitos.');
      return;
    }

    this.pacienteSeleccionado.set(null);
    this.historiales.set([]);
    this.errorHistorial.set('');
    this.pagina.set(1);
    this.cargarPacientes(termino, 1);
  }

  paginaAnterior(): void {
    if (this.pagina() <= 1 || this.buscando()) return;
    this.pagina.update((pagina) => pagina - 1);
    this.cargarPacientes(this.formulario.controls.termino.value.trim(), this.pagina());
  }

  paginaSiguiente(): void {
    if (this.pagina() >= this.totalPaginas() || this.buscando()) return;
    this.pagina.update((pagina) => pagina + 1);
    this.cargarPacientes(this.formulario.controls.termino.value.trim(), this.pagina());
  }

  verHistorial(paciente: PacienteBusqueda): void {
    this.pacienteSeleccionado.set(paciente);
    this.historiales.set([]);
    this.errorHistorial.set('');
    this.cargandoHistorial.set(true);
    this.historialApi
      .listarDelPaciente(paciente.id)
      .pipe(finalize(() => this.cargandoHistorial.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.datos) {
            this.errorHistorial.set('La respuesta del servidor no contiene el historial clínico.');
            return;
          }
          this.historiales.set(respuesta.datos);
        },
        error: (error: unknown) =>
          this.errorHistorial.set(
            mensajeErrorApi(error, 'No se pudo cargar el historial clínico de este paciente.')
          )
      });
  }

  private cargarPacientes(termino: string, pagina: number): void {
    this.buscando.set(true);
    this.errorBusqueda.set('');
    const esDni = /^\d+$/.test(termino);
    this.usuariosApi
      .listarPacientes({
        dni: esDni ? termino : undefined,
        busqueda: esDni ? undefined : termino,
        pagina
      })
      .pipe(finalize(() => this.buscando.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.datos || !Array.isArray(respuesta.datos.items)) {
            this.errorBusqueda.set('La respuesta del servidor no contiene los pacientes.');
            return;
          }
          this.pacientes.set(respuesta.datos.items);
          this.totalPacientes.set(respuesta.datos.total);
          this.pagina.set(respuesta.datos.pagina);
        },
        error: (error: unknown) =>
          this.errorBusqueda.set(mensajeErrorApi(error, 'No se pudieron buscar pacientes.'))
      });
  }
}
