import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Especialidad } from '../models/especialidad.model';

@Injectable({ providedIn: 'root' })
export class EspecialidadService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/especialidades`;

  listar(): Observable<ApiResponse<Especialidad[]>> {
    return this.http.get<ApiResponse<Especialidad[]>>(this.url);
  }

  crear(especialidad: Omit<Especialidad, 'id'>): Observable<ApiResponse<Especialidad>> {
    return this.http.post<ApiResponse<Especialidad>>(this.url, especialidad);
  }

  actualizar(id: number, especialidad: Omit<Especialidad, 'id'>): Observable<ApiResponse<Especialidad>> {
    return this.http.put<ApiResponse<Especialidad>>(`${this.url}/${id}`, especialidad);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`);
  }
}
