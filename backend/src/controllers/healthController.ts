import { Request, Response } from 'express';
import { probarConexion } from '../config/db';
import { responder } from '../utils/respuesta';

export const health = async (_req: Request, res: Response): Promise<void> => {
  await probarConexion();
  responder(res, 200, 'ok', { database: 'conectada' });
};
