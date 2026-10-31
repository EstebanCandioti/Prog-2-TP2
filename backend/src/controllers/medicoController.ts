import { Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { validarFechaAgenda } from '../services/agendaService';
import { obtenerBloquesTurno } from '../services/disponibilidadService';
import { AuthRequest } from '../types/auth';
import { responder } from '../utils/respuesta';

const mensajeSedeOperador = 'Solo podés realizar esta operación en tu sede asignada. Si tu asignación cambió recientemente, cerrá sesión y volvé a ingresar para actualizarla.';

const leerId = (valor: unknown): number | null => {
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const parametrosDisponibilidad = async (req: AuthRequest, res: Response, requiereFecha: boolean): Promise<{
  idMedico: number;
  idEspecialidad: number;
  idSede: number;
  fecha?: string;
} | null> => {
  const idMedico = leerId(req.params.id);
  const idEspecialidad = leerId(req.query.id_especialidad);
  const idSede = leerId(req.query.id_sede);
  if (idMedico === null || idEspecialidad === null || idSede === null) {
    responder(res, 400, 'Los IDs de médico, especialidad y sede deben ser enteros positivos');
    return null;
  }

  let fecha: string | undefined;
  if (requiereFecha) {
    const errorFecha = validarFechaAgenda(req.query.fecha);
    if (errorFecha) {
      responder(res, 400, errorFecha);
      return null;
    }
    fecha = req.query.fecha as string;
  }

  if (req.usuario?.rol === 'operador') {
    const sedeAsignada = req.usuario.id_sede;
    if (typeof sedeAsignada !== 'number' || !Number.isSafeInteger(sedeAsignada) || sedeAsignada <= 0) {
      responder(res, 403, 'El operador no tiene una sede valida asignada');
      return null;
    }
    if (sedeAsignada !== idSede) {
      responder(res, 403, mensajeSedeOperador);
      return null;
    }
  }

  const [medicos] = await pool.query<RowDataPacket[]>('SELECT id FROM usuario WHERE id = ? AND rol = ?', [idMedico, 'medico']);
  if (medicos.length === 0) {
    responder(res, 404, 'Médico no encontrado');
    return null;
  }
  return { idMedico, idEspecialidad, idSede, fecha };
};

export const listarFechasDisponibles = async (req: AuthRequest, res: Response): Promise<void> => {
  const parametros = await parametrosDisponibilidad(req, res, false);
  if (!parametros) return;
  const { idMedico, idEspecialidad, idSede } = parametros;
  const [fechas] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha FROM agenda
     WHERE id_medico = ? AND id_especialidad = ? AND id_sede = ? ORDER BY fecha ASC`,
    [idMedico, idEspecialidad, idSede]
  );
  responder(res, 200, 'ok', fechas.map((fila) => fila.fecha));
};

export const listarTurnosDisponibles = async (req: AuthRequest, res: Response): Promise<void> => {
  const parametros = await parametrosDisponibilidad(req, res, true);
  if (!parametros || !parametros.fecha) return;
  const { idMedico, idEspecialidad, idSede, fecha } = parametros;
  const { disponibles } = await obtenerBloquesTurno(idMedico, idEspecialidad, idSede, fecha);
  responder(res, 200, 'ok', disponibles);
};
