import { Cobertura } from './cobertura.model';

export interface SolicitudTurno {
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
  fecha: string;
  hora: string;
  nota: string;
}

export interface SolicitudTurnoOperador extends SolicitudTurno {
  id_paciente: number;
}

export interface Turno {
  id: number;
  nota: string | null;
  id_agenda: number;
  fecha: string;
  hora: string;
  id_paciente: number;
  id_cobertura: number;
  estado: 'confirmado' | 'cancelado' | 'atendido';
}

export interface TurnoMedico extends Turno {
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
  medico_nombre: string;
  medico_apellido: string;
  especialidad_descripcion: string;
  sede_nombre: string;
  paciente_nombre: string;
  paciente_apellido: string;
  paciente_fecha_nacimiento: string | null;
}

export interface DatosAtencionTurno {
  diagnostico: string;
  tratamiento?: string;
  observaciones?: string;
}

export interface PacienteReserva {
  id: number;
  nombre: string;
  apellido: string;
  cobertura: Cobertura;
}

export interface ResumenReserva {
  especialidad: string;
  sede: string;
  medico: string;
  fecha: string;
  hora: string;
  cobertura: string;
  nota: string;
}
