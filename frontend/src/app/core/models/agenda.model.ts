export interface AgendaPayload {
  fecha: string;
  hora_entrada: string;
  hora_salida: string;
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
}

export interface Agenda extends AgendaPayload {
  id: number;
}

export interface AgendaListado extends Agenda {
  medico_nombre: string;
  medico_apellido: string;
  especialidad_descripcion: string;
  sede_nombre: string;
}

export interface FiltrosAgenda {
  id_sede?: number;
  id_medico?: number;
}
