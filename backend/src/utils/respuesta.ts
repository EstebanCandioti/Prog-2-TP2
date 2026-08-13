import { Response } from 'express';
import { ApiResponse } from '../types/api';

export const responder = <T>(
  res: Response,
  codigo: number,
  estado: string,
  datos: T | null = null
): Response<ApiResponse<T>> => {
  return res.status(codigo).json({ codigo, estado, datos });
};
