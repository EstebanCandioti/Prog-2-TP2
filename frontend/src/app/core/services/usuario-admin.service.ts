import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import {
  ActualizarUsuarioAdmin,
  CrearUsuarioAdmin,
  ListadoPacientes,
  ListadoUsuarios,
  PacienteBusqueda,
  UsuarioAdmin
} from '../models/usuario-admin.model';
import { RolUsuario } from '../models/usuario.model';

export interface FiltroUsuariosAdmin {
  busqueda?: string;
  rol?: RolUsuario;
  idSede?: number;
  pagina: number;
}

@Injectable({ providedIn: 'root' })
export class UsuarioAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/usuarios`;

  listar(filtro: FiltroUsuariosAdmin): Observable<ApiResponse<ListadoUsuarios>> {
    let params = new HttpParams().set('pagina', filtro.pagina);
    if (filtro.busqueda) params = params.set('busqueda', filtro.busqueda);
    if (filtro.rol) params = params.set('rol', filtro.rol);
    if (filtro.idSede !== undefined) params = params.set('id_sede', filtro.idSede);
    return this.http.get<ApiResponse<ListadoUsuarios>>(this.url, { params });
  }

  listarPacientes(filtro: { busqueda?: string; dni?: string; pagina: number }): Observable<ApiResponse<ListadoPacientes>> {
    let params = new HttpParams().set('pagina', filtro.pagina);
    if (filtro.busqueda) params = params.set('busqueda', filtro.busqueda);
    if (filtro.dni) params = params.set('dni', filtro.dni);
    return this.http.get<ApiResponse<ListadoPacientes>>(`${environment.apiUrl}/pacientes`, { params });
  }

  obtener(id: number): Observable<ApiResponse<UsuarioAdmin>> {
    return this.http.get<ApiResponse<UsuarioAdmin>>(`${this.url}/${id}`);
  }

  crear(usuario: CrearUsuarioAdmin): Observable<ApiResponse<UsuarioAdmin>> {
    return this.http.post<ApiResponse<UsuarioAdmin>>(this.url, usuario);
  }

  actualizar(id: number, usuario: ActualizarUsuarioAdmin): Observable<ApiResponse<UsuarioAdmin>> {
    return this.http.put<ApiResponse<UsuarioAdmin>>(`${this.url}/${id}`, usuario);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/${id}`);
  }
}
