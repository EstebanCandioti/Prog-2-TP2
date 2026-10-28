import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  FiltroReportes,
  RankingMedicoApi,
  ReporteEspecialidadApi,
  ReporteSedeApi,
  TasaCancelacionApi
} from '../models/reporte.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reportes`;

  turnosPorEspecialidad(filtro: FiltroReportes): Observable<ApiResponse<ReporteEspecialidadApi[]>> {
    return this.http.get<ApiResponse<ReporteEspecialidadApi[]>>(
      `${this.baseUrl}/turnos-por-especialidad`,
      { params: this.crearParametros(filtro) }
    );
  }

  turnosPorSede(filtro: FiltroReportes): Observable<ApiResponse<ReporteSedeApi[]>> {
    return this.http.get<ApiResponse<ReporteSedeApi[]>>(
      `${this.baseUrl}/turnos-por-sede`,
      { params: this.crearParametros(filtro) }
    );
  }

  rankingMedicos(filtro: FiltroReportes): Observable<ApiResponse<RankingMedicoApi[]>> {
    return this.http.get<ApiResponse<RankingMedicoApi[]>>(
      `${this.baseUrl}/ranking-medicos`,
      { params: this.crearParametros(filtro) }
    );
  }

  tasaCancelacion(filtro: FiltroReportes): Observable<ApiResponse<TasaCancelacionApi>> {
    return this.http.get<ApiResponse<TasaCancelacionApi>>(
      `${this.baseUrl}/tasa-cancelacion`,
      { params: this.crearParametros(filtro) }
    );
  }

  private crearParametros(filtro: FiltroReportes): HttpParams {
    let params = new HttpParams();

    if (filtro.fechaDesde) params = params.set('fecha_desde', filtro.fechaDesde);
    if (filtro.fechaHasta) params = params.set('fecha_hasta', filtro.fechaHasta);

    return params;
  }
}
