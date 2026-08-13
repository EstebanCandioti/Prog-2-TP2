import { RowDataPacket } from 'mysql2';

export interface UsuarioRow extends RowDataPacket {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  password?: string;
  fecha_nacimiento: string;
  id_cobertura: number | null;
  id_sede: number | null;
  rol: string;
}
