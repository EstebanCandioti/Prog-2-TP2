import { ErrorRequestHandler } from 'express';
import { responder } from '../utils/respuesta';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const mensaje = err instanceof Error ? err.message : 'Error interno del servidor';
  const estado = process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : mensaje;

  responder(res, 500, estado);
};
