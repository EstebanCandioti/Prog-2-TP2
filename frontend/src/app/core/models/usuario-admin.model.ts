import { RolUsuario, Usuario } from './usuario.model';

export type RolAltaAdmin = Exclude<RolUsuario, 'paciente'>;

export interface EspecialidadAsignada {
  id: number;
  descripcion: string;
}

export interface UsuarioAdmin extends Usuario {
  especialidades?: EspecialidadAsignada[];
}

export interface ListadoUsuarios {
  items: UsuarioAdmin[];
  total: number;
  pagina: number;
  limite: number;
}

export interface PacienteBusqueda {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string;
  id_cobertura: number | null;
  cobertura_nombre: string | null;
}

export interface ListadoPacientes {
  items: PacienteBusqueda[];
  total: number;
  pagina: number;
  limite: number;
}

export interface CrearUsuarioAdmin {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  fecha_nacimiento: string;
  password: string;
  rol: RolAltaAdmin;
  id_sede: number | null;
  id_cobertura: null;
  ids_especialidades: number[];
}

export interface ActualizarUsuarioAdmin {
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  rol: RolUsuario;
  email: string;
  telefono: string;
  id_sede: number | null;
  id_cobertura: number | null;
  ids_especialidades: number[];
}
