import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { requireJwtSecret } from '../config/env';
import { AuthRequest, JwtPayload } from '../types/auth';
import { responder } from '../utils/respuesta';

interface UsuarioActualRow extends RowDataPacket, JwtPayload {}

export const verificarToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authorization = req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    responder(res, 401, 'Token ausente o mal formado');
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  let idUsuario: number;
  try {
    const payload = jwt.verify(token, requireJwtSecret()) as JwtPayload;
    if (!Number.isInteger(payload.id) || payload.id <= 0) throw new Error('ID invalido');
    idUsuario = payload.id;
  } catch {
    responder(res, 401, 'Token invalido o vencido');
    return;
  }

  pool.query<UsuarioActualRow[]>('SELECT id, rol, id_sede FROM usuario WHERE id = ? LIMIT 1', [idUsuario])
    .then(([usuarios]) => {
      if (usuarios.length === 0) {
        responder(res, 401, 'Usuario del token no encontrado');
        return;
      }
      const { id, rol, id_sede } = usuarios[0];
      req.usuario = { id, rol, id_sede };
      next();
    })
    .catch(next);
};
