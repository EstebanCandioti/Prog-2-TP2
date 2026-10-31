import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { FiltroAuditoria, RegistroAuditoria } from '../models/auditoria.model';

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/auditoria`;

  listar(filtro: FiltroAuditoria = {}): Observable<ApiResponse<RegistroAuditoria[]>> {
    let params = new HttpParams();

    if (filtro.idUsuario !== undefined) params = params.set('id_usuario', filtro.idUsuario);
    if (filtro.entidad) params = params.set('entidad', filtro.entidad);
    if (filtro.fechaDesde) params = params.set('fecha_desde', filtro.fechaDesde);
    if (filtro.fechaHasta) params = params.set('fecha_hasta', `${filtro.fechaHasta} 23:59:59`);

    return this.http.get<ApiResponse<RegistroAuditoria[]>>(this.url, { params });
  }
}
