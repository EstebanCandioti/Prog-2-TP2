import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmacionDialogData {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
}

@Component({
  selector: 'app-confirmacion-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content>{{ data.mensaje }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancelar()">Cancelar</button>
      <button mat-flat-button class="confirm-button" type="button" (click)="confirmar()">
        {{ data.textoConfirmar ?? 'Eliminar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content { color: var(--ink-soft); overflow-wrap: anywhere; }
    .confirm-button { background: #8c1d18; color: #fff; }
    mat-dialog-actions { gap: 8px; padding: 12px 24px 20px; }
  `
})
export class ConfirmacionDialogComponent {
  readonly data = inject<ConfirmacionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ConfirmacionDialogComponent, boolean>>(MatDialogRef);

  confirmar(): void {
    this.dialogRef.close(true);
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
