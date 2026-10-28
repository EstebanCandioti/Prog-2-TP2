import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { Usuario } from '../../../core/models/usuario.model';

interface PacienteRegistradoDialogData {
  paciente: Usuario;
  coberturaNombre: string;
}

@Component({
  selector: 'app-paciente-registrado-dialog',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './paciente-registrado-dialog.component.html',
  styleUrl: './paciente-registrado-dialog.component.css'
})
export class PacienteRegistradoDialogComponent {
  readonly data = inject<PacienteRegistradoDialogData>(MAT_DIALOG_DATA);
}
