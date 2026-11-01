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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { catchError, combineLatest, EMPTY, finalize, map, of, startWith, Subject, switchMap } from 'rxjs';

import { Sede } from '../../../core/models/sede.model';
import { TurnoMedico } from '../../../core/models/turno.model';
import { SedeService } from '../../../core/services/sede.service';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import {
  fechaAgendaValida, fechaCalendario, FORMATOS_FECHA_AGENDA, leerFechaCalendario
} from '../../shared/agenda/agenda-form.utils';
import { AtenderTurnoDialogComponent } from './atender-turno-dialog.component';
import { CancelarTurnoDialogComponent } from '../../shared/turnos/cancelar-turno-dialog.component';

@Component({
  selector: 'app-turnos-programados',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCardModule, MatDatepickerModule, MatDialogModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule,
    MatSelectModule, MatSnackBarModule, MatTableModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
    provideNativeDateAdapter(FORMATOS_FECHA_AGENDA)
  ],
  templateUrl: './turnos-programados.component.html',
  styleUrl: './turnos-programados.component.css'
})
export class TurnosProgramadosComponent implements OnInit, OnDestroy {
  private readonly turnosApi = inject(TurnoService);
  private readonly sedesApi = inject(SedeService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recarga = new Subject<void>();
  private readonly recargaSedes = new Subject<void>();
  private dialogo?: MatDialogRef<AtenderTurnoDialogComponent, boolean> | MatDialogRef<CancelarTurnoDialogComponent, boolean>;

  readonly fecha = new FormControl<Date | null>(new Date(), [Validators.required, fechaAgendaValida]);
  readonly idSede = new FormControl<number | null>({ value: null, disabled: true });
  readonly fechaMinima = new Date(1000, 0, 1);
  readonly fechaMaxima = new Date(9999, 11, 31);
  readonly sedes = signal<Sede[]>([]);
  readonly turnos = signal<TurnoMedico[]>([]);
  readonly cargando = signal(true);
  readonly cargandoSedes = signal(true);
  readonly error = signal('');
  readonly errorSedes = signal('');
  readonly dialogoAbierto = signal(false);
  readonly expandido = signal<number | null>(null);
  readonly columnas = ['hora', 'paciente', 'edad', 'sede', 'estado', 'acciones'];
  readonly estados: Record<string, string> = { confirmado: 'Confirmado', atendido: 'Atendido', cancelado: 'Cancelado' };

  ngOnInit(): void {
    this.recargaSedes.pipe(
      startWith(undefined),
      switchMap(() => {
        this.cargandoSedes.set(true);
        this.errorSedes.set('');
        this.idSede.disable({ emitEvent: false });
        return this.sedesApi.listar().pipe(
          map((respuesta) => {
            if (!Array.isArray(respuesta.datos)) throw new Error('Respuesta de sedes inválida');
            return respuesta.datos;
          }),
          catchError((error: unknown) => {
            this.errorSedes.set(mensajeErrorApi(error, 'No se pudieron cargar las sedes. Reintentá la carga.'));
            return EMPTY;
          }),
          finalize(() => this.cargandoSedes.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((sedes) => {
      this.sedes.set(sedes);
      this.idSede.enable({ emitEvent: false });
    });

    combineLatest([
      this.fecha.valueChanges.pipe(startWith(this.fecha.value)),
      this.idSede.valueChanges.pipe(startWith(this.idSede.value)),
      this.recarga.pipe(startWith(undefined))
    ]).pipe(
      switchMap(([fecha, idSede]) => {
        this.turnos.set([]);
        this.expandido.set(null);
        this.error.set('');
        const dia = fechaCalendario(fecha);
        if (this.fecha.invalid || !dia) {
          this.cargando.set(false);
          return EMPTY;
        }

        this.cargando.set(true);
        return this.turnosApi.listarMedico(dia, idSede ?? undefined).pipe(
          map((respuesta) => {
            if (!Array.isArray(respuesta.datos)) throw new Error('Respuesta de turnos inválida');
            return respuesta.datos;
          }),
          catchError((error: unknown) => {
            this.error.set(mensajeErrorApi(error, 'No se pudieron cargar tus turnos. Revisá la conexión y reintentá.'));
            return of<TurnoMedico[]>([]);
          }),
          finalize(() => this.cargando.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((turnos) => {
      this.turnos.set([...turnos].sort((a, b) => a.hora.localeCompare(b.hora) || a.id - b.id));
    });
  }

  ngOnDestroy(): void {
    this.dialogo?.close();
  }

  recargar(): void {
    this.recarga.next();
  }

  cargarSedes(): void {
    this.recargaSedes.next();
  }

  alternarNota(turno: TurnoMedico): void {
    this.expandido.update((id) => id === turno.id ? null : turno.id);
  }

  edadActual(nacimiento: string | null): number | '—' {
    if (typeof nacimiento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return '—';
    const fecha = leerFechaCalendario(nacimiento);
    const hoy = new Date();
    if (!fecha || fecha > hoy) return '—';
    let edad = hoy.getFullYear() - fecha.getFullYear();
    if (hoy.getMonth() < fecha.getMonth() ||
        (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate())) edad--;
    return edad;
  }

  atender(turno: TurnoMedico): void {
    if (this.dialogoAbierto() || turno.estado !== 'confirmado') return;
    this.dialogoAbierto.set(true);
    const referencia = this.dialog.open<AtenderTurnoDialogComponent, TurnoMedico, boolean>(
      AtenderTurnoDialogComponent,
      { width: '640px', maxWidth: 'calc(100vw - 24px)', maxHeight: '90vh', data: turno }
    );
    this.dialogo = referencia;
    referencia.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((atendido) => {
      this.dialogoAbierto.set(false);
      this.dialogo = undefined;
      if (!atendido) return;
      this.notificar('Atención e historial clínico guardados correctamente.');
      this.recargar();
    });
  }

  cancelar(turno: TurnoMedico): void {
    if (this.dialogoAbierto() || turno.estado !== 'confirmado') return;
    this.dialogoAbierto.set(true);
    const referencia = this.dialog.open<CancelarTurnoDialogComponent, TurnoMedico, boolean>(
      CancelarTurnoDialogComponent,
      { width: '480px', maxWidth: 'calc(100vw - 24px)', maxHeight: '90vh', data: turno }
    );
    this.dialogo = referencia;
    referencia.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((cancelado) => {
      this.dialogoAbierto.set(false);
      this.dialogo = undefined;
      if (!cancelado) return;
      this.notificar('Turno cancelado correctamente.');
      this.recargar();
    });
  }

  private notificar(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 4000, panelClass: ['app-snackbar', 'app-snackbar-success']
    });
  }
}
