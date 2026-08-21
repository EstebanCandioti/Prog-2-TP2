import { Router } from 'express';
import {
  actualizarAgenda,
  crearAgenda,
  eliminarAgenda,
  listarAgendas,
  obtenerAgendaPorId
} from '../controllers/agendaController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const agendaRoutes = Router();

agendaRoutes.use('/agendas', verificarToken, verificarRol('medico', 'operador'));

agendaRoutes.get('/agendas', asyncHandler(listarAgendas));
agendaRoutes.get('/agendas/:id', asyncHandler(obtenerAgendaPorId));
agendaRoutes.post('/agendas', asyncHandler(crearAgenda));
agendaRoutes.put('/agendas/:id', asyncHandler(actualizarAgenda));
agendaRoutes.delete('/agendas/:id', asyncHandler(eliminarAgenda));
