import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { responder } from '../utils/respuesta';

export const listarCoberturas = async (_req: Request, res: Response): Promise<void> => {
  const [coberturas] = await pool.query<RowDataPacket[]>('SELECT * FROM cobertura ORDER BY nombre');
  responder(res, 200, 'ok', coberturas);
};
