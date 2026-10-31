import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { Cobertura } from '../models/cobertura.model';

@Injectable({ providedIn: 'root' })
export class CoberturaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/coberturas`;
  private readonly urlDisponibles = `${environment.apiUrl}/coberturas-disponibles`;

  listarDisponibles(): Observable<ApiResponse<Cobertura[]>> {
    return this.http.get<ApiResponse<Cobertura[]>>(this.urlDisponibles);
  }

  listar(): Observable<ApiResponse<Cobertura[]>> {
    return this.http.get<ApiResponse<Cobertura[]>>(this.url);
  }

  crear(cobertura: Omit<Cobertura, 'id'>): Observable<ApiResponse<Cobertura>> {
    return this.http.post<ApiResponse<Cobertura>>(this.url, cobertura);
  }

  actualizar(id: number, cobertura: Omit<Cobertura, 'id'>): Observable<ApiResponse<Cobertura>> {
    return this.http.put<ApiResponse<Cobertura>>(`${this.url}/${id}`, cobertura);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`);
  }
}