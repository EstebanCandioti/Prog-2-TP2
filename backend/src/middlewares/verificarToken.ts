import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { requireJwtSecret } from '../config/env';
import { AuthRequest, JwtPayload } from '../types/auth';
import { responder } from '../utils/respuesta';

export const verificarToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authorization = req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    responder(res, 401, 'Token ausente o mal formado');
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    req.usuario = jwt.verify(token, requireJwtSecret()) as JwtPayload;
    next();
  } catch {
    responder(res, 401, 'Token invalido o vencido');
  }
};
