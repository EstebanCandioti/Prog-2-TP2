import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { DatosAtencionTurno, SolicitudTurno, SolicitudTurnoOperador, Turno, TurnoMedico } from '../models/turno.model';

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
