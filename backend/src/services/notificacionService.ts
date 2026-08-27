import { pool } from '../config/db';

export const crearNotificacion = async (id_usuario: number, tipo: string, mensaje: string): Promise<void> => {
  await pool.query('INSERT INTO notificacion (id_usuario, tipo, mensaje, leida) VALUES (?, ?, ?, ?)', [
    id_usuario,
    tipo,
    mensaje,
    0
  ]);
};
