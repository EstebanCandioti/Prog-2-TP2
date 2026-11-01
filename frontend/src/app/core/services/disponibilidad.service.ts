import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { BloqueDisponible } from '../models/turno.model';

@Injectable({ providedIn: 'root' })
export class DisponibilidadService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/medicos`;

  listarFechas(
    idMedico: number,
    idEspecialidad: number,
    idSede: number
  ): Observable<ApiResponse<string[]>> {
    const params = new HttpParams()
      .set('id_especialidad', idEspecialidad)
      .set('id_sede', idSede);
    return this.http.get<ApiResponse<string[]>>(
      `${this.url}/${idMedico}/fechas-disponibles`,
      { params }
    );
  }

  listarHorarios(
    idMedico: number,
    idEspecialidad: number,
    idSede: number,
    fecha: string
  ): Observable<ApiResponse<BloqueDisponible[]>> {
    const params = new HttpParams()
      .set('id_especialidad', idEspecialidad)
      .set('id_sede', idSede)
      .set('fecha', fecha);
    return this.http.get<ApiResponse<BloqueDisponible[]>>(
      `${this.url}/${idMedico}/turnos-disponibles`,
      { params }
    );
  }
}
