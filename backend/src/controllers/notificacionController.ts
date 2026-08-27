import { Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { AuthRequest } from '../types/auth';
import { responder } from '../utils/respuesta';

const obtenerIdParam = (req: AuthRequest, res: Response): number | null => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    responder(res, 400, 'El id debe ser numerico');
    return null;
  }

  return id;
};

export const listarNotificaciones = async (req: AuthRequest, res: Response): Promise<void> => {
  const [notificaciones] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM notificacion WHERE id_usuario = ? ORDER BY fecha DESC',
    [req.usuario?.id]
  );

  responder(res, 200, 'ok', notificaciones);
};

export const marcarNotificacionComoLeida = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const [notificaciones] = await pool.query<RowDataPacket[]>('SELECT * FROM notificacion WHERE id = ?', [id]);
  const notificacion = notificaciones[0];

  if (!notificacion) {
    responder(res, 404, 'Notificacion no encontrada');
    return;
  }

  if (notificacion.id_usuario !== req.usuario?.id) {
    responder(res, 403, 'Solo puede marcar como leidas sus propias notificaciones');
    return;
  }

  await pool.query<ResultSetHeader>('UPDATE notificacion SET leida = ? WHERE id = ?', [1, id]);

  const [notificacionesActualizadas] = await pool.query<RowDataPacket[]>('SELECT * FROM notificacion WHERE id = ?', [
    id
  ]);

  responder(res, 200, 'ok', notificacionesActualizadas[0]);
};
