import { Router } from 'express';
import {
  actualizarCobertura,
  crearCobertura,
  eliminarCobertura,
  listarCoberturas,
  obtenerCoberturaPorId
} from '../controllers/coberturaController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const coberturaRoutes = Router();

coberturaRoutes.get('/coberturas-disponibles', asyncHandler(listarCoberturas));
coberturaRoutes.get('/coberturas', verificarToken, verificarRol('admin'), asyncHandler(listarCoberturas));
coberturaRoutes.get(
  '/coberturas/:id',
  verificarToken,
  verificarRol('admin'),
  asyncHandler(obtenerCoberturaPorId)
);
coberturaRoutes.post('/coberturas', verificarToken, verificarRol('admin'), asyncHandler(crearCobertura));
coberturaRoutes.put(
  '/coberturas/:id',
  verificarToken,
  verificarRol('admin'),
  asyncHandler(actualizarCobertura)
);
coberturaRoutes.delete(
  '/coberturas/:id',
  verificarToken,
  verificarRol('admin'),
  asyncHandler(eliminarCobertura)
);
