import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import {
  CrearTurnoRequest,
  DatosClinicosRequest,
  TurnoMedico,
  TurnoPaciente
} from '../models/turno.model';

@Injectable({ providedIn: 'root' })
export class TurnoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/turnos`;

  listarMisTurnos(): Observable<ApiResponse<TurnoPaciente[]>> {
    return this.http.get<ApiResponse<TurnoPaciente[]>>(`${this.url}/mis-turnos`);
  }

  listarTurnosMedico(fecha: string, idSede?: number): Observable<ApiResponse<TurnoMedico[]>> {
    let params = new HttpParams().set('fecha', fecha);
    if (idSede !== undefined) params = params.set('id_sede', idSede);
    return this.http.get<ApiResponse<TurnoMedico[]>>(`${this.url}/medico`, { params });
  }

  listarTurnosOperador(
    fecha: string,
    idMedico?: number,
    estado?: string
  ): Observable<ApiResponse<TurnoMedico[]>> {
    let params = new HttpParams().set('fecha', fecha);
    if (idMedico !== undefined) params = params.set('id_medico', idMedico);
    if (estado) params = params.set('estado', estado);
    return this.http.get<ApiResponse<TurnoMedico[]>>(`${this.url}/sede`, { params });
  }

  crear(datos: CrearTurnoRequest): Observable<ApiResponse<TurnoPaciente>> {
    return this.http.post<ApiResponse<TurnoPaciente>>(this.url, datos);
  }

  cancelar(id: number): Observable<ApiResponse<TurnoPaciente>> {
    return this.http.patch<ApiResponse<TurnoPaciente>>(`${this.url}/${id}/cancelar`, {});
  }

  atender(id: number, datos: DatosClinicosRequest): Observable<ApiResponse<TurnoPaciente>> {
    return this.http.patch<ApiResponse<TurnoPaciente>>(`${this.url}/${id}/atender`, datos);
  }
}
