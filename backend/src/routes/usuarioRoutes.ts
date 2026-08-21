import { Router } from 'express';
import {
  actualizarUsuario,
  eliminarUsuario,
  listarUsuarios,
  obtenerUsuarioPorId
} from '../controllers/usuarioController';
import { asyncHandler } from '../utils/asyncHandler';

export const usuarioRoutes = Router();

usuarioRoutes.get('/usuarios', asyncHandler(listarUsuarios));
usuarioRoutes.get('/usuarios/:id', asyncHandler(obtenerUsuarioPorId));
usuarioRoutes.put('/usuarios/:id', asyncHandler(actualizarUsuario));
usuarioRoutes.delete('/usuarios/:id', asyncHandler(eliminarUsuario));
