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

especialidadRoutes.use('/especialidades', verificarToken, verificarRol('admin', 'administrador'));

especialidadRoutes.get('/especialidades', asyncHandler(listarEspecialidades));
especialidadRoutes.get('/especialidades/:id', asyncHandler(obtenerEspecialidadPorId));
especialidadRoutes.post('/especialidades', asyncHandler(crearEspecialidad));
especialidadRoutes.put('/especialidades/:id', asyncHandler(actualizarEspecialidad));
especialidadRoutes.delete('/especialidades/:id', asyncHandler(eliminarEspecialidad));
