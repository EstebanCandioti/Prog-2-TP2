import { Router } from 'express';
import {
  listarNotificaciones,
  marcarNotificacionComoLeida,
  marcarTodasLasNotificacionesComoLeidas
} from '../controllers/notificacionController';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const notificacionRoutes = Router();

notificacionRoutes.get('/notificaciones', verificarToken, asyncHandler(listarNotificaciones));
notificacionRoutes.patch('/notificaciones/leidas', verificarToken, asyncHandler(marcarTodasLasNotificacionesComoLeidas));
notificacionRoutes.patch('/notificaciones/:id/leida', verificarToken, asyncHandler(marcarNotificacionComoLeida));
