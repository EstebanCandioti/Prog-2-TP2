import { Router } from 'express';
import {
  actualizarSede,
  crearSede,
  eliminarSede,
  listarSedes,
  obtenerSedePorId
} from '../controllers/sedeController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const sedeRoutes = Router();

sedeRoutes.get('/sedes', verificarToken, asyncHandler(listarSedes));
sedeRoutes.get('/sedes/:id', verificarToken, verificarRol('admin'), asyncHandler(obtenerSedePorId));
sedeRoutes.post('/sedes', verificarToken, verificarRol('admin'), asyncHandler(crearSede));
sedeRoutes.put('/sedes/:id', verificarToken, verificarRol('admin'), asyncHandler(actualizarSede));
sedeRoutes.delete('/sedes/:id', verificarToken, verificarRol('admin'), asyncHandler(eliminarSede));
