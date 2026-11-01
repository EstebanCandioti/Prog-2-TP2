import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Agenda, AgendaRequest } from '../models/agenda.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/agendas`;

  listarPropia(fecha?: string): Observable<ApiResponse<Agenda[]>> {
    let params = new HttpParams();
    if (fecha) params = params.set('fecha', fecha);
    return this.http.get<ApiResponse<Agenda[]>>(this.url, { params });
  }

  listarOperador(): Observable<ApiResponse<Agenda[]>> {
    return this.http.get<ApiResponse<Agenda[]>>(this.url);
  }

  crear(agenda: AgendaRequest): Observable<ApiResponse<Agenda>> {
    return this.http.post<ApiResponse<Agenda>>(this.url, agenda);
  }

  actualizar(id: number, agenda: AgendaRequest): Observable<ApiResponse<Agenda>> {
    return this.http.put<ApiResponse<Agenda>>(`${this.url}/${id}`, agenda);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`);
  }
}
