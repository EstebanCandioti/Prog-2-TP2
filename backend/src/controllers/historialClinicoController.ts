import { Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { validarDatosClinicos } from '../services/historialClinicoService';
import { AuthRequest } from '../types/auth';
import { responder } from '../utils/respuesta';

const obtenerIdPacienteParam = (req: AuthRequest, res: Response): number | null => {
  const idPaciente = Number(req.params.id_paciente);

  if (Number.isNaN(idPaciente)) {
    responder(res, 400, 'El id_paciente debe ser numerico');
    return null;
  }

  return idPaciente;
};

export const crearHistorialClinico = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.usuario) {
    responder(res, 401, 'Token no verificado');
    return;
  }

  const validacion = validarDatosClinicos(req.body);
  if (validacion.error !== null) {
    responder(res, 400, validacion.error);
    return;
  }

  const idTurno = (req.body as Record<string, unknown>).id_turno;
  if (typeof idTurno !== 'number' || !Number.isSafeInteger(idTurno) || idTurno <= 0) {
    responder(res, 400, 'El id_turno debe ser un entero positivo');
    return;
  }

  const { diagnostico, tratamiento, observaciones } = validacion.datos;

  const [turnos] = await pool.query<RowDataPacket[]>(
    `SELECT turno.id, turno.estado, turno.id_paciente, agenda.id_medico
     FROM turno
     INNER JOIN agenda ON agenda.id = turno.id_agenda
     WHERE turno.id = ?`,
    [idTurno]
  );
  const turno = turnos[0];

  if (!turno) {
    responder(res, 404, 'Turno no encontrado');
    return;
  }

  if (turno.estado !== 'atendido') {
    responder(res, 409, 'El historial clinico solo puede cargarse para turnos atendidos');
    return;
  }

  if (req.usuario.id !== turno.id_medico) {
    responder(res, 403, 'El medico solo puede cargar historial de sus propios turnos');
    return;
  }

  const [historialesExistentes] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM historial_clinico WHERE id_turno = ?',
    [idTurno]
  );

  if (historialesExistentes.length > 0) {
    responder(res, 409, 'El turno ya tiene historial clinico cargado');
    return;
  }

  let resultado: ResultSetHeader;
  try {
    [resultado] = await pool.query<ResultSetHeader>(
      `INSERT INTO historial_clinico
        (id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idTurno, req.usuario.id, turno.id_paciente, diagnostico, tratamiento ?? null, observaciones ?? null]
    );
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      responder(res, 409, 'El turno ya tiene historial clinico cargado');
      return;
    }
    throw error;
  }

  const [historiales] = await pool.query<RowDataPacket[]>('SELECT * FROM historial_clinico WHERE id = ?', [
    resultado.insertId
  ]);

  responder(res, 201, 'ok', historiales[0]);
};

export const listarHistorialClinicoPaciente = async (req: AuthRequest, res: Response): Promise<void> => {
  const idPaciente = obtenerIdPacienteParam(req, res);

  if (idPaciente === null) {
    return;
  }

  if (req.usuario?.rol === 'paciente' && req.usuario.id !== idPaciente) {
    responder(res, 403, 'El paciente solo puede consultar su propio historial clinico');
    return;
  }

  if (req.usuario?.rol === 'medico') {
    const [historiales] = await pool.query<RowDataPacket[]>(
      `SELECT *
       FROM historial_clinico
       WHERE id_paciente = ?
         AND id_medico = ?
       ORDER BY fecha_registro DESC`,
      [idPaciente, req.usuario.id]
    );

    responder(res, 200, 'ok', historiales);
    return;
  }

  const [historiales] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM historial_clinico WHERE id_paciente = ? ORDER BY fecha_registro DESC',
    [idPaciente]
  );

  responder(res, 200, 'ok', historiales);
};
