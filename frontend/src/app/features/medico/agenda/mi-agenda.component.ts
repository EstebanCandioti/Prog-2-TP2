import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { AgendaListado } from '../../../core/models/agenda.model';
import { AgendaService } from '../../../core/services/agenda.service';
import { SessionService } from '../../../core/services/session.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import {
  AgendaFormDialogComponent, AgendaFormularioData, AgendaFormularioResultado
} from '../../shared/agenda/agenda-form-dialog.component';
import { fechaAgendaValida, fechaCalendario, FORMATOS_FECHA_AGENDA, leerFechaCalendario } from '../../shared/agenda/agenda-form.utils';
import { EliminarAgendaDialogComponent } from '../../shared/agenda/eliminar-agenda-dialog.component';

@Component({
  selector: 'app-mi-agenda',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCardModule, MatDatepickerModule, MatDialogModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatTableModule, MatTooltipModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
    provideNativeDateAdapter(FORMATOS_FECHA_AGENDA)
  ],
  templateUrl: './mi-agenda.component.html',
  styleUrl: './mi-agenda.component.css'
})
export class MiAgendaComponent implements OnInit, OnDestroy {
  private readonly agendasApi = inject(AgendaService);
  private readonly session = inject(SessionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private consultaActual?: Subscription;
  private formularioAbierto?: MatDialogRef<AgendaFormDialogComponent, AgendaFormularioResultado>;
  private confirmacionAbierta?: MatDialogRef<EliminarAgendaDialogComponent, boolean>;

  readonly fecha = new FormControl<Date | null>(new Date(), [Validators.required, fechaAgendaValida]);
  readonly fechaMinima = new Date(1000, 0, 1);
  readonly fechaMaxima = new Date(9999, 11, 31);
  readonly agendas = signal<AgendaListado[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly errorAccion = signal('');
  readonly dialogoAbierto = signal(false);
  readonly columnas = ['entrada', 'salida', 'especialidad', 'sede', 'acciones'];

  ngOnInit(): void {
    this.cargarAgendas();
  }

  ngOnDestroy(): void {
    this.consultaActual?.unsubscribe();
    this.formularioAbierto?.close();
    this.confirmacionAbierta?.close();
  }

  cargarAgendas(): void {
    this.consultaActual?.unsubscribe();
    this.error.set('');
    this.agendas.set([]);
    const fecha = fechaCalendario(this.fecha.value);
    if (this.fecha.invalid || !fecha) {
      this.fecha.markAsTouched();
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.consultaActual = this.agendasApi.listar(fecha).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (respuesta) => {
        this.cargando.set(false);
        if (!respuesta.datos) {
          this.error.set('La respuesta del servidor no contiene los horarios.');
          return;
        }
        this.agendas.set([...respuesta.datos].sort((a, b) =>
          a.hora_entrada.localeCompare(b.hora_entrada) || a.id - b.id
        ));
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorApi(error, 'No se pudo cargar tu agenda. Revisá la conexión y reintentá.'));
      }
    });
  }

  abrirFormulario(agenda: AgendaListado | null = null): void {
    if (this.dialogoAbierto()) return;
    this.errorAccion.set('');
    const usuario = this.session.obtenerUsuario();
    if (!usuario || usuario.rol !== 'medico') {
      this.errorAccion.set('No se pudo identificar al médico. Volvé a iniciar sesión.');
      return;
    }
    const fecha = fechaCalendario(this.fecha.value);
    if (!fecha || this.fecha.invalid) {
      this.fecha.markAsTouched();
      return;
    }

    this.dialogoAbierto.set(true);
    const referencia = this.dialog.open<AgendaFormDialogComponent, AgendaFormularioData, AgendaFormularioResultado>(
      AgendaFormDialogComponent,
      {
        width: '620px', maxWidth: 'calc(100vw - 24px)', maxHeight: '90vh',
        data: { modo: 'medico', idMedico: usuario.id, idSedeInicial: usuario.id_sede, fecha, agenda }
      }
    );
    this.formularioAbierto = referencia;
    referencia.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      this.dialogoAbierto.set(false);
      this.formularioAbierto = undefined;
      if (!resultado) return;
      const fechaGuardada = leerFechaCalendario(resultado.fecha);
      if (fechaGuardada) this.fecha.setValue(fechaGuardada);
      this.notificar(agenda ? 'Horario actualizado correctamente.' : 'Horario agregado correctamente.');
      // POST y PUT no incluyen los nombres obtenidos mediante JOIN.
      this.cargarAgendas();
    });
  }

  confirmarEliminacion(agenda: AgendaListado): void {
    if (this.dialogoAbierto()) return;
    this.dialogoAbierto.set(true);
    const referencia = this.dialog.open<EliminarAgendaDialogComponent, AgendaListado, boolean>(
      EliminarAgendaDialogComponent,
      { width: '480px', maxWidth: 'calc(100vw - 24px)', data: agenda }
    );
    this.confirmacionAbierta = referencia;
    referencia.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((eliminada) => {
      this.dialogoAbierto.set(false);
      this.confirmacionAbierta = undefined;
      if (!eliminada) return;
      this.notificar('Horario eliminado correctamente.');
      this.cargarAgendas();
    });
  }

  private notificar(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 4000, panelClass: ['app-snackbar', 'app-snackbar-success']
    });
  }
}
