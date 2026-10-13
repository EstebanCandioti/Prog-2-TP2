import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  LoginResponse,
  PerfilResponse,
  RegistroRequest,
  RegistroResponse
} from '../models/auth.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  login(credenciales: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(`${this.baseUrl}/login`, credenciales);
  }

  registrar(datos: RegistroRequest): Observable<ApiResponse<RegistroResponse>> {
    return this.http.post<ApiResponse<RegistroResponse>>(`${this.baseUrl}/registro`, datos);
  }

  obtenerPerfil(): Observable<ApiResponse<PerfilResponse>> {
    return this.http.get<ApiResponse<PerfilResponse>>(`${this.baseUrl}/perfil`);
  }
}
