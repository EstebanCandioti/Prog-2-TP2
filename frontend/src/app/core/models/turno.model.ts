export type EstadoTurno = 'confirmado' | 'cancelado' | 'atendido';

export interface TurnoPaciente {
  id: number;
  nota: string | null;
  fecha: string;
  hora: string;
  estado: EstadoTurno;
  id_paciente: number;
  id_cobertura: number;
  id_agenda: number;
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
  medico_nombre: string;
  medico_apellido: string;
  sede_nombre: string;
  especialidad_descripcion: string;
}

export interface TurnoMedico extends TurnoPaciente {
  paciente_nombre: string;
  paciente_apellido: string;
  paciente_fecha_nacimiento: string;
}

export interface DatosClinicosRequest {
  diagnostico: string;
  tratamiento?: string;
  observaciones?: string;
}

export interface CrearTurnoRequest {
  id_paciente?: number;
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
  fecha: string;
  hora: string;
  nota: string;
}

export interface BloqueDisponible {
  id_agenda: number;
  hora: string;
}

export interface HistorialClinico {
  id: number;
  id_turno: number;
  id_medico: number;
  id_paciente: number;
  diagnostico: string;
  tratamiento: string | null;
  observaciones: string | null;
  fecha_registro: string;
}
