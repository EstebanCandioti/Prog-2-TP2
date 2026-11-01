export interface Notificacion {
  id: number;
  id_usuario: number;
  tipo: string;
  mensaje: string;
  leida: 0 | 1;
  fecha: string;
}

export interface MarcadoMasivoNotificaciones {
  cantidad_actualizada: number;
}
