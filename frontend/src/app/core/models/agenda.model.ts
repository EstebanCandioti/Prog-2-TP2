export interface Agenda {
  id: number;
  hora_entrada: string;
  hora_salida: string;
  fecha: string;
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
  medico_nombre?: string;
  medico_apellido?: string;
  especialidad_descripcion?: string;
  sede_nombre?: string;
}

export type AgendaRequest = Omit<Agenda, 'id' | 'especialidad_descripcion' | 'sede_nombre'>;
