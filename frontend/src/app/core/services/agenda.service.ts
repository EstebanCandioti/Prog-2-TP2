import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Agenda, AgendaListado, AgendaPayload, FiltrosAgenda } from '../models/agenda.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/agendas`;

  listar(fecha: string, filtros: FiltrosAgenda = {}): Observable<ApiResponse<AgendaListado[]>> {
    let params = new HttpParams().set('fecha', fecha);
    if (filtros.id_sede !== undefined) params = params.set('id_sede', filtros.id_sede);
    if (filtros.id_medico !== undefined) params = params.set('id_medico', filtros.id_medico);
    return this.http.get<ApiResponse<AgendaListado[]>>(this.url, { params });
  }

  crear(agenda: AgendaPayload): Observable<ApiResponse<Agenda>> {
    return this.http.post<ApiResponse<Agenda>>(this.url, agenda);
  }

  actualizar(id: number, agenda: AgendaPayload): Observable<ApiResponse<Agenda>> {
    return this.http.put<ApiResponse<Agenda>>(`${this.url}/${id}`, agenda);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`);
  }
}
