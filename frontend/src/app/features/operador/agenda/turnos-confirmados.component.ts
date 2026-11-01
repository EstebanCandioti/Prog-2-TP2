import { Component, DestroyRef, inject, Input, OnChanges, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, EMPTY, finalize, map, of, startWith, Subject, switchMap } from 'rxjs';

import { AgendaListado } from '../../../core/models/agenda.model';
import { TurnoMedico } from '../../../core/models/turno.model';
import { SessionService } from '../../../core/services/session.service';
import { TurnoService } from '../../../core/services/turno.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { fechaCalendario, leerFechaCalendario } from '../../shared/agenda/agenda-form.utils';
import { CancelarTurnoDialogComponent } from '../../shared/turnos/cancelar-turno-dialog.component';

interface TurnosPorRango {
  idAgenda: number;
  especialidad: string;
  entrada: string;
  salida: string | null;
  turnos: TurnoMedico[];
}

@Component({
  selector: 'app-turnos-confirmados',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule],
  templateUrl: './turnos-confirmados.component.html',
  styleUrl: './turnos-confirmados.component.css'
})
export class TurnosConfirmadosComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) fecha!: string;
  @Input({ required: true }) idSede!: number;
  @Input({ required: true }) idMedico!: number;
  @Input({ required: true }) rangos!: AgendaListado[];
  @Input() actualizacion = 0;

  private readonly turnosApi = inject(TurnoService);
  private readonly session = inject(SessionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recarga = new Subject<void>();
  private confirmacion?: MatDialogRef<CancelarTurnoDialogComponent, boolean>;

  readonly grupos = signal<TurnosPorRango[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly notaVisible = signal<number | null>(null);
  readonly cancelacionAbierta = signal(false);

  ngOnInit(): void {
    this.recarga.pipe(
      startWith(undefined),
      switchMap(() => {
        this.grupos.set([]);
        this.notaVisible.set(null);
        this.error.set('');
        if (!this.puedeConsultar() || !Number.isSafeInteger(this.idMedico) || this.idMedico <= 0 ||
            fechaCalendario(leerFechaCalendario(this.fecha)) !== this.fecha) {
          this.error.set('Solo podés consultar los turnos de tu sede con una fecha y un médico válidos.');
          this.cargando.set(false);
          return EMPTY;
        }
        this.cargando.set(true);
        return this.turnosApi.listarConfirmadosSede(this.fecha, this.idMedico).pipe(
          map((respuesta) => {
            if (!Array.isArray(respuesta.datos)) throw new Error('Respuesta de turnos inválida');
            return respuesta.datos.filter((turno) => turno.estado === 'confirmado' &&
              turno.id_medico === this.idMedico && turno.id_sede === this.idSede)
              .sort((a, b) => a.hora.localeCompare(b.hora) || a.id - b.id);
          }),
          catchError((error: unknown) => {
            this.error.set(mensajeErrorApi(error, 'No se pudieron cargar los turnos confirmados. Reintentá la consulta.'));
            return of<TurnoMedico[]>([]);
          }),
          finalize(() => this.cargando.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((turnos) => this.grupos.set(this.agrupar(turnos)));
  }

  ngOnChanges(): void {
    this.confirmacion?.close();
    this.recargar();
  }

  ngOnDestroy(): void {
    this.confirmacion?.close();
  }

  recargar(): void {
    this.recarga.next();
  }

  alternarNota(turno: TurnoMedico): void {
    this.notaVisible.update((id) => id === turno.id ? null : turno.id);
  }

  cancelar(turno: TurnoMedico): void {
    if (this.cancelacionAbierta() || !this.puedeConsultar() || turno.estado !== 'confirmado' || turno.id_sede !== this.idSede) return;
    this.cancelacionAbierta.set(true);
    const referencia = this.dialog.open<CancelarTurnoDialogComponent, TurnoMedico, boolean>(
      CancelarTurnoDialogComponent,
      { width: '480px', maxWidth: 'calc(100vw - 24px)', maxHeight: '90vh', data: turno }
    );
    this.confirmacion = referencia;
    referencia.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((cancelado) => {
      this.cancelacionAbierta.set(false);
      this.confirmacion = undefined;
      if (!cancelado) return;
      this.snackBar.open('Turno cancelado correctamente.', 'Cerrar', {
        duration: 4000, panelClass: ['app-snackbar', 'app-snackbar-success']
      });
      this.recargar();
    });
  }

  private puedeConsultar(): boolean {
    const usuario = this.session.obtenerUsuario();
    return usuario?.rol === 'operador' && Number.isSafeInteger(usuario.id_sede) &&
      this.idSede > 0 && usuario.id_sede === this.idSede;
  }

  private agrupar(turnos: TurnoMedico[]): TurnosPorRango[] {
    const grupos = new Map<number, TurnosPorRango>();
    for (const turno of turnos) {
      let grupo = grupos.get(turno.id_agenda);
      if (!grupo) {
        const rango = this.rangos.find((agenda) => agenda.id === turno.id_agenda);
        grupo = {
          idAgenda: turno.id_agenda, especialidad: turno.especialidad_descripcion,
          entrada: rango?.hora_entrada ?? turno.hora, salida: rango?.hora_salida ?? null, turnos: []
        };
        grupos.set(grupo.idAgenda, grupo);
      }
      grupo.turnos.push(turno);
    }
    return [...grupos.values()].sort((a, b) => a.entrada.localeCompare(b.entrada) || a.idAgenda - b.idAgenda);
  }
}
