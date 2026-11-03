import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { RegistroAuditoria } from '../../../core/models/auditoria.model';
import { AuditoriaService } from '../../../core/services/auditoria.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';

const TAMANO_PAGINA = 10;
const ENTIDADES_AUDITORIA = [
  { valor: '', nombre: 'Todas' },
  { valor: 'sede', nombre: 'Sede' },
  { valor: 'usuario', nombre: 'Usuario' },
  { valor: 'cobertura', nombre: 'Cobertura' },
  { valor: 'especialidad', nombre: 'Especialidad' }
] as const;

@Component({
  selector: 'app-auditoria',
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
    MatTableModule,
    ReactiveFormsModule
  ],
  templateUrl: './auditoria.component.html',
  styleUrl: './auditoria.component.css'
})
export class AuditoriaComponent implements OnInit {
  private readonly auditoriaApi = inject(AuditoriaService);
  private readonly formBuilder = inject(FormBuilder);

  readonly entidades = ENTIDADES_AUDITORIA;
  readonly registros = signal<RegistroAuditoria[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly errorFiltros = signal('');
  readonly pagina = signal(0);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.registros().length / TAMANO_PAGINA)));
  readonly registrosPagina = computed(() => {
    const inicio = this.pagina() * TAMANO_PAGINA;
    return this.registros().slice(inicio, inicio + TAMANO_PAGINA);
  });
  readonly columnas = ['fecha', 'usuario', 'accion', 'entidad', 'idEntidad', 'detalle'];
  readonly formulario = this.formBuilder.nonNullable.group({
    idUsuario: ['', [Validators.pattern(/^[1-9]\d*$/)]],
    idEntidad: ['', [Validators.pattern(/^[1-9]\d*$/)]],
    entidad: [''],
    fechaDesde: [''],
    fechaHasta: ['']
  });

  ngOnInit(): void {
    this.cargarAuditoria();
  }

  cargarAuditoria(): void {
    this.cargando.set(true);
    this.error.set('');

    const valores = this.formulario.getRawValue();
    const idUsuario = valores.idUsuario ? Number(valores.idUsuario) : undefined;
    const idEntidad = valores.idEntidad ? Number(valores.idEntidad) : undefined;

    this.auditoriaApi
      .listar({
        idUsuario,
        idEntidad,
        entidad: valores.entidad || undefined,
        fechaDesde: valores.fechaDesde || undefined,
        fechaHasta: valores.fechaHasta || undefined
      })
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.datos) {
            this.error.set('La respuesta del servidor no contiene el listado de auditoría.');
            this.cargando.set(false);
            return;
          }

          // La API actual no filtra por id_entidad; el listado ya se pagina en esta pantalla.
          this.registros.set(idEntidad === undefined ? respuesta.datos : respuesta.datos.filter((registro) => registro.id_entidad === idEntidad));
          this.pagina.set(0);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeErrorApi(error, 'No se pudo cargar el registro de auditoría.'));
          this.cargando.set(false);
        }
      });
  }

  aplicarFiltros(): void {
    this.errorFiltros.set('');
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid) {
      this.errorFiltros.set('Ingresá IDs de usuario y entidad válidos.');
      return;
    }

    const { fechaDesde, fechaHasta } = this.formulario.getRawValue();
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      this.errorFiltros.set('La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }

    this.cargarAuditoria();
  }

  limpiarFiltros(): void {
    this.formulario.reset({ idUsuario: '', idEntidad: '', entidad: '', fechaDesde: '', fechaHasta: '' });
    this.errorFiltros.set('');
    this.cargarAuditoria();
  }

  paginaAnterior(): void {
    if (this.pagina() > 0) this.pagina.update((pagina) => pagina - 1);
  }

  paginaSiguiente(): void {
    if (this.pagina() + 1 < this.totalPaginas()) this.pagina.update((pagina) => pagina + 1);
  }
}
