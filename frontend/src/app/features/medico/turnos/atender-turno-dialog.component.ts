import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { DatosAtencionTurno, TurnoMedico } from '../../../core/models/turno.model';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { leerFechaCalendario } from '../../shared/agenda/agenda-form.utils';

@Component({
  selector: 'app-atender-turno-dialog',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, MatButtonModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule
  ],
  templateUrl: './atender-turno-dialog.component.html',
  styleUrl: './atender-turno-dialog.component.css'
})
export class AtenderTurnoDialogComponent {
  readonly turno = inject<TurnoMedico>(MAT_DIALOG_DATA);
  readonly fecha = leerFechaCalendario(this.turno.fecha);
  private readonly dialogRef = inject<MatDialogRef<AtenderTurnoDialogComponent, boolean>>(MatDialogRef);
  private readonly turnosApi = inject(TurnoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly guardando = signal(false);
  readonly error = signal('');
  readonly formulario = new FormGroup({
    diagnostico: new FormControl('', {
      nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]
    }),
    tratamiento: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] }),
    observaciones: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] })
  });

  guardar(): void {
    this.formulario.markAllAsTouched();
    if (this.guardando() || this.formulario.invalid) return;

    const valores = this.formulario.getRawValue();
    const datos: DatosAtencionTurno = { diagnostico: valores.diagnostico.trim() };
    const tratamiento = valores.tratamiento.trim();
    const observaciones = valores.observaciones.trim();
    if (tratamiento) datos.tratamiento = tratamiento;
    if (observaciones) datos.observaciones = observaciones;

    this.guardando.set(true);
    this.error.set('');
    this.dialogRef.disableClose = true;
    this.formulario.disable({ emitEvent: false });
    // La atención guarda el historial y el estado en una única operación del backend.
    this.turnosApi.atender(this.turno.id, datos).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.guardando.set(false);
        this.dialogRef.disableClose = false;
        this.formulario.enable({ emitEvent: false });
        this.error.set(mensajeErrorApi(error, 'No se pudo registrar la atención. Revisá la conexión y reintentá.'));
      }
    });
  }
}
