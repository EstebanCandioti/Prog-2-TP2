import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AgendaListado } from '../../../core/models/agenda.model';
import { AgendaService } from '../../../core/services/agenda.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { leerFechaCalendario } from './agenda-form.utils';

@Component({
  selector: 'app-eliminar-agenda-dialog',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>Eliminar horario</h2>
    <mat-dialog-content>
      <p>¿Querés eliminar este rango de tu agenda?</p>
      <p class="horario"><strong>{{ fecha | date:'dd/MM/yyyy' }} · {{ agenda.hora_entrada }}–{{ agenda.hora_salida }}</strong></p>
      <p>{{ agenda.especialidad_descripcion }} · {{ agenda.sede_nombre }}</p>
      @if (error()) {
        <p class="error-message" role="alert">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close [disabled]="eliminando()">Cancelar</button>
      <button mat-flat-button class="delete-button" type="button" (click)="eliminar()" [disabled]="eliminando()">
        @if (eliminando()) { <mat-spinner diameter="18"></mat-spinner> }
        {{ eliminando() ? 'Eliminando…' : 'Eliminar horario' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content { color: var(--ink-soft); overflow-wrap: anywhere; }
    .horario { color: var(--ink); }
    .error-message { padding: 12px; border-left: 4px solid #8c1d18; border-radius: 6px; background: #fff4f2; color: #8c1d18; }
    .delete-button:not(:disabled) { background: #8c1d18; color: #fff; }
    mat-dialog-actions { gap: 8px; padding: 12px 24px 20px; }
    mat-spinner { display: inline-block; margin-right: 8px; vertical-align: middle; }
  `
})
export class EliminarAgendaDialogComponent {
  readonly agenda = inject<AgendaListado>(MAT_DIALOG_DATA);
  readonly fecha = leerFechaCalendario(this.agenda.fecha);
  readonly eliminando = signal(false);
  readonly error = signal('');
  private readonly dialogRef = inject<MatDialogRef<EliminarAgendaDialogComponent, boolean>>(MatDialogRef);
  private readonly agendasApi = inject(AgendaService);
  private readonly destroyRef = inject(DestroyRef);

  eliminar(): void {
    if (this.eliminando()) return;
    this.eliminando.set(true);
    this.error.set('');
    this.dialogRef.disableClose = true;
    this.agendasApi.eliminar(this.agenda.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.eliminando.set(false);
        this.dialogRef.disableClose = false;
        this.error.set(mensajeErrorApi(error, 'No se pudo eliminar el horario. Revisá la conexión y reintentá.'));
      }
    });
  }
}
