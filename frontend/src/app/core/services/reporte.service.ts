import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  FiltroReportes,
  RankingMedicoApi,
  ReporteEspecialidadApi,
  ReporteSedeApi,
  RespuestasReportes,
  TasaCancelacionApi
} from '../models/reporte.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reportes`;

  cargarReportes(filtro: FiltroReportes): Observable<RespuestasReportes> {
    const params = this.crearParametros(filtro);

    return forkJoin({
      especialidades: this.http.get<ApiResponse<ReporteEspecialidadApi[]>>(
        `${this.baseUrl}/turnos-por-especialidad`,
        { params }
      ),
      sedes: this.http.get<ApiResponse<ReporteSedeApi[]>>(`${this.baseUrl}/turnos-por-sede`, { params }),
      ranking: this.http.get<ApiResponse<RankingMedicoApi[]>>(`${this.baseUrl}/ranking-medicos`, { params }),
      tasaCancelacion: this.http.get<ApiResponse<TasaCancelacionApi>>(`${this.baseUrl}/tasa-cancelacion`, {
        params
      })
    });
  }

  private crearParametros(filtro: FiltroReportes): HttpParams {
    let params = new HttpParams();

    if (filtro.fechaDesde) params = params.set('fecha_desde', filtro.fechaDesde);
    if (filtro.fechaHasta) params = params.set('fecha_hasta', filtro.fechaHasta);

    return params;
  }
}
