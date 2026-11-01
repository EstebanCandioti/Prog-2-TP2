import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { FiltrosMedicos, HorarioDisponible, Medico } from '../models/medico.model';

@Injectable({ providedIn: 'root' })
export class MedicoService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosMedicos = {}): Observable<ApiResponse<Medico[]>> {
    let params = new HttpParams();
    if (filtros.id_especialidad !== undefined) params = params.set('id_especialidad', filtros.id_especialidad);
    if (filtros.id_sede !== undefined) params = params.set('id_sede', filtros.id_sede);
    return this.http.get<ApiResponse<Medico[]>>(`${environment.apiUrl}/medicos`, { params });
  }

  listarFechasDisponibles(idMedico: number, idEspecialidad: number, idSede: number): Observable<ApiResponse<string[]>> {
    const params = new HttpParams().set('id_especialidad', idEspecialidad).set('id_sede', idSede);
    return this.http.get<ApiResponse<string[]>>(`${environment.apiUrl}/medicos/${idMedico}/fechas-disponibles`, { params });
  }

  listarHorariosDisponibles(idMedico: number, idEspecialidad: number, idSede: number, fecha: string): Observable<ApiResponse<HorarioDisponible[]>> {
    const params = new HttpParams().set('id_especialidad', idEspecialidad).set('id_sede', idSede).set('fecha', fecha);
    return this.http.get<ApiResponse<HorarioDisponible[]>>(`${environment.apiUrl}/medicos/${idMedico}/turnos-disponibles`, { params });
  }
}
