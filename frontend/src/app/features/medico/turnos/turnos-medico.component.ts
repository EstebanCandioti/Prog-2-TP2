import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';

import { ApiResponse } from '../../../core/models/api-response.model';
import { Sede } from '../../../core/models/sede.model';
import { DatosClinicosRequest, TurnoMedico } from '../../../core/models/turno.model';
import { NotificacionService } from '../../../core/services/notificacion.service';
import { SedeService } from '../../../core/services/sede.service';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { ConfirmacionDialogComponent } from '../../shared/confirmacion-dialog.component';

@Component({
  selector: 'app-turnos-medico',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    ReactiveFormsModule
  ],
  templateUrl: './turnos-medico.component.html',
  styleUrl: './turnos-medico.component.css'
})
export class TurnosMedicoComponent implements OnInit {
  private readonly turnosApi = inject(TurnoService);
  private readonly sedesApi = inject(SedeService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly fechaSeleccionada = signal(this.fechaLocalActual());
  readonly idSedeSeleccionada = signal<number | null>(null);
  readonly sedes = signal<Sede[]>([]);
  readonly turnos = signal<TurnoMedico[]>([]);
  readonly cargando = signal(false);
  readonly cargandoSedes = signal(false);
  readonly guardandoId = signal<number | null>(null);
  readonly atendiendoId = signal<number | null>(null);
  readonly error = signal('');
  readonly errorSedes = signal('');
  readonly errorAtencion = signal('');
  readonly columnas = ['hora', 'paciente', 'edad', 'sede', 'estado', 'notas', 'acciones'];

  readonly formularioAtencion = this.formBuilder.nonNullable.group({
    diagnostico: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]],
    tratamiento: ['', Validators.maxLength(255)],
    observaciones: ['', Validators.maxLength(255)]
  });

  ngOnInit(): void {
    this.cargarSedes();
    this.cargarTurnos();
  }

  cambiarFecha(event: Event): void {
    const fecha = (event.target as HTMLInputElement).value;
    if (!fecha) return;
    this.fechaSeleccionada.set(fecha);
    this.cargarTurnos();
  }

  cambiarSede(idSede: number | null): void {
    this.idSedeSeleccionada.set(idSede);
    this.cargarTurnos();
  }

  cargarTurnos(): void {
    this.cargando.set(true);
    this.error.set('');
    this.turnosApi
      .listarTurnosMedico(this.fechaSeleccionada(), this.idSedeSeleccionada() ?? undefined)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (!Array.isArray(respuesta.datos)) {
            this.error.set('La respuesta del servidor no contiene el listado de turnos.');
            return;
          }
          this.turnos.set([...respuesta.datos].sort((a, b) =>
            a.hora.localeCompare(b.hora) || a.id - b.id
          ));
          this.atendiendoId.set(null);
          this.errorAtencion.set('');
        },
        error: (error: unknown) =>
          this.error.set(mensajeErrorApi(error, 'No se pudieron cargar los turnos del día.'))
      });
  }

  abrirAtencion(turno: TurnoMedico): void {
    if (turno.estado !== 'confirmado' || this.guardandoId() !== null) return;
    this.formularioAtencion.reset({ diagnostico: '', tratamiento: '', observaciones: '' });
    this.errorAtencion.set('');
    this.atendiendoId.set(turno.id);
  }

  cancelarAtencion(): void {
    if (this.guardandoId() !== null) return;
    this.atendiendoId.set(null);
    this.errorAtencion.set('');
    this.formularioAtencion.reset();
  }

  guardarAtencion(turno: TurnoMedico): void {
    if (turno.id !== this.atendiendoId() || this.guardandoId() !== null) return;
    if (this.formularioAtencion.invalid) {
      this.formularioAtencion.markAllAsTouched();
      return;
    }

    const valores = this.formularioAtencion.getRawValue();
    const datos: DatosClinicosRequest = {
      diagnostico: valores.diagnostico.trim(),
      ...(valores.tratamiento.trim() ? { tratamiento: valores.tratamiento.trim() } : {}),
      ...(valores.observaciones.trim() ? { observaciones: valores.observaciones.trim() } : {})
    };

    this.guardandoId.set(turno.id);
    this.errorAtencion.set('');
    this.turnosApi
      .atender(turno.id, datos)
      .pipe(finalize(() => this.guardandoId.set(null)))
      .subscribe({
        next: (respuesta) => {
          if (!respuesta.datos) {
            this.errorAtencion.set('La respuesta del servidor no contiene el turno actualizado.');
            return;
          }
          this.atendiendoId.set(null);
          this.snackBar.open('Turno marcado como atendido.', 'Cerrar', { duration: 4000 });
          this.cargarTurnos();
          this.notificaciones.actualizar();
        },
        error: (error: unknown) =>
          this.errorAtencion.set(
            mensajeErrorApi(error, 'No se pudo registrar la atención del turno.')
          )
      });
  }

  cancelarTurno(turno: TurnoMedico): void {
    if (turno.estado !== 'confirmado' || this.guardandoId() !== null) return;
    this.dialog.open<ConfirmacionDialogComponent, { titulo: string; mensaje: string; textoConfirmar: string }, boolean>(
      ConfirmacionDialogComponent,
      {
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
        data: {
          titulo: 'Cancelar turno',
          mensaje: `¿Querés cancelar el turno de ${turno.paciente_nombre} ${turno.paciente_apellido} del ${this.formatearFecha(turno.fecha)} a las ${turno.hora}?`,
          textoConfirmar: 'Cancelar turno'
        }
      }
    ).afterClosed().subscribe((confirmada) => {
      if (!confirmada) return;
      this.guardandoId.set(turno.id);
      this.turnosApi
        .cancelar(turno.id)
        .pipe(finalize(() => this.guardandoId.set(null)))
        .subscribe({
          next: () => {
            this.snackBar.open('Turno cancelado correctamente.', 'Cerrar', { duration: 4000 });
            this.cargarTurnos();
            this.notificaciones.actualizar();
          },
          error: (error: unknown) =>
            this.snackBar.open(
              mensajeErrorApi(error, 'No se pudo cancelar el turno.'),
              'Cerrar',
              { duration: 6000 }
            )
        });
    });
  }

  turnoAtendiendo(): TurnoMedico | null {
    return this.turnos().find((turno) => turno.id === this.atendiendoId()) ?? null;
  }

  calcularEdad(fechaNacimiento: string | null): string {
    if (!fechaNacimiento) return '—';
    const [anio, mes, dia] = fechaNacimiento.slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return '—';
    const nacimiento = new Date(anio, mes - 1, dia);
    if (
      nacimiento.getFullYear() !== anio ||
      nacimiento.getMonth() !== mes - 1 ||
      nacimiento.getDate() !== dia
    ) {
      return '—';
    }
    const hoy = new Date();
    let edad = hoy.getFullYear() - anio;
    if (
      hoy.getMonth() < mes - 1 ||
      (hoy.getMonth() === mes - 1 && hoy.getDate() < dia)
    ) {
      edad--;
    }
    return `${edad} años`;
  }

  formatearFecha(fecha: string): string {
    const [anio, mes, dia] = fecha.slice(0, 10).split('-');
    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
  }

  etiquetaEstado(estado: string): string {
    const etiquetas: Record<string, string> = {
      confirmado: 'Confirmado',
      cancelado: 'Cancelado',
      atendido: 'Atendido'
    };
    return etiquetas[estado] ?? estado;
  }

  private cargarSedes(): void {
    this.cargandoSedes.set(true);
    this.errorSedes.set('');
    this.sedesApi
      .listar()
      .pipe(finalize(() => this.cargandoSedes.set(false)))
      .subscribe({
        next: (respuesta: ApiResponse<Sede[]>) => {
          if (!Array.isArray(respuesta.datos)) {
            this.errorSedes.set('La respuesta del servidor no contiene las sedes.');
            return;
          }
          this.sedes.set(respuesta.datos);
        },
        error: (error: unknown) =>
          this.errorSedes.set(mensajeErrorApi(error, 'No se pudieron cargar las sedes.'))
      });
  }

  private fechaLocalActual(): string {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
}
