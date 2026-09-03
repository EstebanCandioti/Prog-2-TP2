import { Router } from 'express';
import { listarAuditoria } from '../controllers/auditoriaController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const auditoriaRoutes = Router();

auditoriaRoutes.get('/auditoria', verificarToken, verificarRol('admin'), asyncHandler(listarAuditoria));
