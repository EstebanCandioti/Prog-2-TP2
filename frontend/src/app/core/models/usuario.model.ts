export type RolUsuario = 'admin' | 'medico' | 'operador' | 'paciente';

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  fecha_nacimiento: string;
  id_cobertura: number | null;
  id_sede: number | null;
  rol: RolUsuario;
}
