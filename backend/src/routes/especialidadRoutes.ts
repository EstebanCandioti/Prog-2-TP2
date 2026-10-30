import { Router } from 'express';
import {
  actualizarEspecialidad,
  crearEspecialidad,
  eliminarEspecialidad,
  listarEspecialidades,
  obtenerEspecialidadPorId
} from '../controllers/especialidadController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const especialidadRoutes = Router();

especialidadRoutes.get('/especialidades', verificarToken, asyncHandler(listarEspecialidades));
especialidadRoutes.get('/especialidades/:id', verificarToken, verificarRol('admin'), asyncHandler(obtenerEspecialidadPorId));
especialidadRoutes.post('/especialidades', verificarToken, verificarRol('admin'), asyncHandler(crearEspecialidad));
especialidadRoutes.put('/especialidades/:id', verificarToken, verificarRol('admin'), asyncHandler(actualizarEspecialidad));
especialidadRoutes.delete('/especialidades/:id', verificarToken, verificarRol('admin'), asyncHandler(eliminarEspecialidad));
