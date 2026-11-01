import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { FiltrosPacientes, ListadoPacientes } from '../models/paciente.model';

@Injectable({ providedIn: 'root' })
export class PacienteService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosPacientes): Observable<ApiResponse<ListadoPacientes>> {
    let params = new HttpParams().set('pagina', filtros.pagina ?? 1);
    if (filtros.dni !== undefined) params = params.set('dni', filtros.dni);
    if (filtros.busqueda !== undefined) params = params.set('busqueda', filtros.busqueda);
    return this.http.get<ApiResponse<ListadoPacientes>>(`${environment.apiUrl}/pacientes`, { params });
  }
}
