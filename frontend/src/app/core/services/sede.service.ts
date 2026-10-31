import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Sede } from '../models/sede.model';

@Injectable({ providedIn: 'root' })
export class SedeService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/sedes`;

  listar(): Observable<ApiResponse<Sede[]>> {
    return this.http.get<ApiResponse<Sede[]>>(this.url);
  }

  crear(sede: Omit<Sede, 'id'>): Observable<ApiResponse<Sede>> {
    return this.http.post<ApiResponse<Sede>>(this.url, sede);
  }

  actualizar(id: number, sede: Omit<Sede, 'id'>): Observable<ApiResponse<Sede>> {
    return this.http.put<ApiResponse<Sede>>(`${this.url}/${id}`, sede);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`);
  }
}
