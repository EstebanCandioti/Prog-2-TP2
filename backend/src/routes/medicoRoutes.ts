import { Router } from 'express';
import { listarFechasDisponibles, listarMedicos, listarTurnosDisponibles } from '../controllers/medicoController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const medicoRoutes = Router();

medicoRoutes.get('/medicos', verificarToken, verificarRol('admin', 'medico', 'operador', 'paciente'), asyncHandler(listarMedicos));

medicoRoutes.get('/medicos/:id/fechas-disponibles', verificarToken, verificarRol('paciente', 'operador'), asyncHandler(listarFechasDisponibles));
medicoRoutes.get('/medicos/:id/turnos-disponibles', verificarToken, verificarRol('paciente', 'operador'), asyncHandler(listarTurnosDisponibles));
