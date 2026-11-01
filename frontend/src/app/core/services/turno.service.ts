import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { DatosAtencionTurno, HistorialClinico, ListadoTurnosPaciente, SolicitudTurno, SolicitudTurnoOperador, TipoListadoTurnos, Turno, TurnoMedico } from '../models/turno.model';

@Injectable({ providedIn: 'root' })
export class TurnoService {
  private readonly http = inject(HttpClient);

  crear(solicitud: SolicitudTurno | SolicitudTurnoOperador): Observable<ApiResponse<Turno>> {
    return this.http.post<ApiResponse<Turno>>(`${environment.apiUrl}/turnos`, solicitud);
  }

  listarMedico(fecha: string, idSede?: number): Observable<ApiResponse<TurnoMedico[]>> {
    let params = new HttpParams().set('fecha', fecha);
    if (idSede !== undefined) params = params.set('id_sede', idSede);
    return this.http.get<ApiResponse<TurnoMedico[]>>(`${environment.apiUrl}/turnos/medico`, { params });
  }

  listarMisTurnos(tipo: TipoListadoTurnos = 'todos', pagina = 1): Observable<ApiResponse<ListadoTurnosPaciente>> {
    const params = new HttpParams().set('tipo', tipo).set('pagina', pagina);
    return this.http.get<ApiResponse<ListadoTurnosPaciente>>(`${environment.apiUrl}/turnos/mis-turnos`, { params });
  }

  obtenerHistorial(id: number): Observable<ApiResponse<HistorialClinico>> {
    return this.http.get<ApiResponse<HistorialClinico>>(`${environment.apiUrl}/turnos/${id}/historial`);
  }

  listarTurnosMedico(fecha: string, idSede?: number): Observable<ApiResponse<TurnoMedico[]>> {
    return this.listarMedico(fecha, idSede);
  }

  listarTurnosOperador(fecha: string, idMedico?: number, estado?: string): Observable<ApiResponse<TurnoMedico[]>> {
    let params = new HttpParams().set('fecha', fecha);
    if (idMedico !== undefined) params = params.set('id_medico', idMedico);
    if (estado) params = params.set('estado', estado);
    return this.http.get<ApiResponse<TurnoMedico[]>>(`${environment.apiUrl}/turnos/sede`, { params });
  }

  listarConfirmadosSede(fecha: string, idMedico: number): Observable<ApiResponse<TurnoMedico[]>> {
    // La sede se determina desde el token; este endpoint no permite elegir otra.
    const params = new HttpParams().set('fecha', fecha).set('id_medico', idMedico).set('estado', 'confirmado');
    return this.http.get<ApiResponse<TurnoMedico[]>>(`${environment.apiUrl}/turnos/sede`, { params });
  }

  atender(id: number, datos: DatosAtencionTurno): Observable<ApiResponse<Turno>> {
    return this.http.patch<ApiResponse<Turno>>(`${environment.apiUrl}/turnos/${id}/atender`, datos);
  }

  cancelar(id: number): Observable<ApiResponse<Turno>> {
    return this.http.patch<ApiResponse<Turno>>(`${environment.apiUrl}/turnos/${id}/cancelar`, {});
  }
}
