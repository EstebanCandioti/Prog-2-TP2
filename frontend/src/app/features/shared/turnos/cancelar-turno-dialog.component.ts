import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TurnoMedico } from '../../../core/models/turno.model';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { leerFechaCalendario } from '../agenda/agenda-form.utils';

@Component({
  selector: 'app-cancelar-turno-dialog',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>Cancelar turno</h2>
    <mat-dialog-content [attr.aria-busy]="cancelando()">
      <p>¿Querés cancelar el turno de este paciente?</p>
      <p class="patient"><strong>{{ turno.paciente_apellido }}, {{ turno.paciente_nombre }}</strong></p>
      <p>{{ fecha | date:'dd/MM/yyyy' }} · {{ turno.hora.slice(0, 5) }}</p>
      <p>{{ turno.id_sede }}. {{ turno.sede_nombre }}</p>
      @if (error()) { <p class="error-message" role="alert">{{ error() }}</p> }
      @if (cancelando()) {
        <div class="status" role="status" aria-live="polite"><mat-spinner diameter="24"></mat-spinner><span>Cancelando turno…</span></div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close [disabled]="cancelando()">Volver</button>
      <button mat-flat-button class="cancel-button" type="button" (click)="confirmar()" [disabled]="cancelando()">{{ cancelando() ? 'Cancelando…' : 'Confirmar cancelación' }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content { color: var(--ink-soft); overflow-wrap: anywhere; }
    .patient { color: var(--ink); }
    .error-message { padding: 12px; border-left: 4px solid #8c1d18; border-radius: 6px; background: #fff4f2; color: #8c1d18; }
    .cancel-button:not(:disabled) { background: #8c1d18; color: #fff; }
    .status { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
    .status mat-spinner { flex-shrink: 0; }
    mat-dialog-actions { gap: 8px; padding: 12px 24px 20px; }
  `
})
export class CancelarTurnoDialogComponent {
  readonly turno = inject<TurnoMedico>(MAT_DIALOG_DATA);
  readonly fecha = leerFechaCalendario(this.turno.fecha);
  readonly cancelando = signal(false);
  readonly error = signal('');
  private readonly dialogRef = inject<MatDialogRef<CancelarTurnoDialogComponent, boolean>>(MatDialogRef);
  private readonly turnosApi = inject(TurnoService);
  private readonly destroyRef = inject(DestroyRef);

  confirmar(): void {
    if (this.cancelando()) return;
    this.cancelando.set(true);
    this.error.set('');
    this.dialogRef.disableClose = true;
    this.turnosApi.cancelar(this.turno.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.cancelando.set(false);
        this.dialogRef.disableClose = false;
        this.error.set(mensajeErrorApi(error, 'No se pudo cancelar el turno. Revisá la conexión y reintentá.'));
      }
    });
  }
}
