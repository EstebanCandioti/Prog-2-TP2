import { Usuario, RolUsuario } from './usuario.model';

export interface LoginRequest {
  dni: string;
  password: string;
}

export interface UsuarioAutenticado {
  id: number;
  rol: RolUsuario;
  id_sede: number | null;
}

export interface LoginResponse {
  token: string;
  usuario: UsuarioAutenticado;
}

export type Sesion = LoginResponse;

export interface RegistroRequest {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono?: string;
  password: string;
  fecha_nacimiento: string;
  id_cobertura: number;
}

export type RegistroResponse = Usuario;
export type PerfilResponse = Usuario;
