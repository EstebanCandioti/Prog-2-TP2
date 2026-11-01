export interface Notificacion {
  id: number;
  id_usuario: number;
  tipo: string;
  mensaje: string;
  leida: number | boolean;
  fecha: string;
}
