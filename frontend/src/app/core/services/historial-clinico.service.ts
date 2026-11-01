import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { HistorialClinico } from '../models/turno.model';

@Injectable({ providedIn: 'root' })
export class HistorialClinicoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/historial-clinico`;

  listarDelPaciente(idPaciente: number): Observable<ApiResponse<HistorialClinico[]>> {
    return this.http.get<ApiResponse<HistorialClinico[]>>(`${this.url}/paciente/${idPaciente}`);
  }
}
