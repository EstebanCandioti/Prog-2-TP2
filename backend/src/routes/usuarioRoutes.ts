import { Router } from 'express';
import {
  actualizarUsuario,
  actualizarMiPerfil,
  crearUsuario,
  eliminarUsuario,
  listarPacientes,
  listarUsuarios,
  obtenerUsuarioPorId
} from '../controllers/usuarioController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const usuarioRoutes = Router();

usuarioRoutes.get('/usuarios', verificarToken, verificarRol('admin'), asyncHandler(listarUsuarios));
usuarioRoutes.get('/pacientes', verificarToken, verificarRol('admin', 'operador', 'medico'), asyncHandler(listarPacientes));
usuarioRoutes.patch('/usuarios/mi-perfil', verificarToken, verificarRol('paciente'), asyncHandler(actualizarMiPerfil));
usuarioRoutes.get('/usuarios/:id', verificarToken, verificarRol('admin'), asyncHandler(obtenerUsuarioPorId));
usuarioRoutes.post('/usuarios', verificarToken, verificarRol('admin'), asyncHandler(crearUsuario));
usuarioRoutes.put('/usuarios/:id', verificarToken, verificarRol('admin'), asyncHandler(actualizarUsuario));
usuarioRoutes.delete('/usuarios/:id', verificarToken, verificarRol('admin'), asyncHandler(eliminarUsuario));
