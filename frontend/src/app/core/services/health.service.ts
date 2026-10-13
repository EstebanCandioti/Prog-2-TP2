import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { HealthResponse } from '../models/health.model';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/health`;

  verificarConexion(): Observable<ApiResponse<HealthResponse>> {
    return this.http.get<ApiResponse<HealthResponse>>(this.url);
  }
}
