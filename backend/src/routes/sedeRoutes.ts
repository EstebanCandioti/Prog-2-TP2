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

sedeRoutes.use('/sedes', verificarToken, verificarRol('admin'));

sedeRoutes.get('/sedes', asyncHandler(listarSedes));
sedeRoutes.get('/sedes/:id', asyncHandler(obtenerSedePorId));
sedeRoutes.post('/sedes', asyncHandler(crearSede));
sedeRoutes.put('/sedes/:id', asyncHandler(actualizarSede));
sedeRoutes.delete('/sedes/:id', asyncHandler(eliminarSede));
