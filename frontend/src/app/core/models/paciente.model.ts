export interface PacienteListado {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string;
  id_cobertura: number | null;
  cobertura_nombre: string | null;
}

export interface ListadoPacientes {
  items: PacienteListado[];
  total: number;
  pagina: number;
  limite: number;
}

export interface FiltrosPacientes {
  busqueda?: string;
  dni?: string;
  pagina?: number;
}
