import { Router } from 'express';
import { login, perfil, registro } from '../controllers/authController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const authRoutes = Router();

authRoutes.post('/registro', asyncHandler(registro));
authRoutes.post('/login', asyncHandler(login));
authRoutes.get('/perfil', verificarToken, asyncHandler(perfil));
authRoutes.get('/perfil-paciente', verificarToken, verificarRol('paciente'), asyncHandler(perfil));
authRoutes.get('/perfil-admin', verificarToken, verificarRol('admin'), asyncHandler(perfil));
