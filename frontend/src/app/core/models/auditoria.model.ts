export interface RegistroAuditoria {
  id: number;
  id_usuario: number;
  accion: string;
  entidad: string;
  id_entidad: number | null;
  detalle: string | null;
  fecha: string;
}

export interface FiltroAuditoria {
  idUsuario?: number;
  idEntidad?: number;
  entidad?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}
