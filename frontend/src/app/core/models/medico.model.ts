import { Especialidad } from './especialidad.model';

export interface Medico {
  id: number;
  nombre: string;
  apellido: string;
  especialidades: Especialidad[];
}

export interface FiltrosMedicos {
  id_especialidad?: number;
  id_sede?: number;
}

export interface HorarioDisponible {
  id_agenda: number;
  hora: string;
}
