import { Router } from 'express';
import {
  rankingMedicos,
  tasaCancelacion,
  turnosPorEspecialidad,
  turnosPorSede
} from '../controllers/reporteController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const reporteRoutes = Router();

reporteRoutes.use('/reportes', verificarToken, verificarRol('admin'));

reporteRoutes.get('/reportes/turnos-por-especialidad', asyncHandler(turnosPorEspecialidad));
reporteRoutes.get('/reportes/turnos-por-sede', asyncHandler(turnosPorSede));
reporteRoutes.get('/reportes/ranking-medicos', asyncHandler(rankingMedicos));
reporteRoutes.get('/reportes/tasa-cancelacion', asyncHandler(tasaCancelacion));
