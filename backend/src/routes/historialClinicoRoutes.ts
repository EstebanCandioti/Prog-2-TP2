import { Router } from 'express';
import {
  crearHistorialClinico,
  listarHistorialClinicoPaciente
} from '../controllers/historialClinicoController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const historialClinicoRoutes = Router();

historialClinicoRoutes.post(
  '/historial-clinico',
  verificarToken,
  verificarRol('medico'),
  asyncHandler(crearHistorialClinico)
);

historialClinicoRoutes.get(
  '/historial-clinico/paciente/:id_paciente',
  verificarToken,
  verificarRol('paciente', 'medico'),
  asyncHandler(listarHistorialClinicoPaciente)
);
