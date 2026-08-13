import { Request } from 'express';

export interface JwtPayload {
  id: number;
  rol: string;
  id_sede: number | null;
}

export interface AuthRequest extends Request {
  usuario?: JwtPayload;
}
