import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types/auth';
import { responder } from '../utils/respuesta';

export const verificarRol = (...rolesPermitidos: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      responder(res, 401, 'Token no verificado');
      return;
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      responder(res, 403, 'No tiene permisos para acceder al recurso');
      return;
    }

    next();
  };
};
