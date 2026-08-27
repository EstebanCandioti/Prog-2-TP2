import { Router } from 'express';
import {
  atenderTurno,
  cancelarTurno,
  crearTurno,
  listarMisTurnos,
  listarTurnosMedico,
  listarTurnosSede
} from '../controllers/turnoController';
import { verificarRol } from '../middlewares/verificarRol';
import { verificarToken } from '../middlewares/verificarToken';
import { asyncHandler } from '../utils/asyncHandler';

export const turnoRoutes = Router();

turnoRoutes.post('/turnos', verificarToken, verificarRol('paciente', 'operador'), asyncHandler(crearTurno));
turnoRoutes.patch(
  '/turnos/:id/cancelar',
  verificarToken,
  verificarRol('paciente', 'operador', 'medico'),
  asyncHandler(cancelarTurno)
);
turnoRoutes.patch('/turnos/:id/atender', verificarToken, verificarRol('medico'), asyncHandler(atenderTurno));

turnoRoutes.get('/turnos/mis-turnos', verificarToken, verificarRol('paciente'), asyncHandler(listarMisTurnos));
turnoRoutes.get('/turnos/medico', verificarToken, verificarRol('medico'), asyncHandler(listarTurnosMedico));
turnoRoutes.get('/turnos/sede', verificarToken, verificarRol('operador'), asyncHandler(listarTurnosSede));
