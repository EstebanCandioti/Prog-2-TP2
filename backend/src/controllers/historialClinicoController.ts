import { Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { AuthRequest } from '../types/auth';
import { responder } from '../utils/respuesta';

interface HistorialBody {
  id_turno: number;
  diagnostico: string;
  tratamiento?: string;
  observaciones?: string;
}

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

  const body = req.body as HistorialBody;
  const { id_turno, diagnostico, tratamiento, observaciones } = body;

  if (!id_turno || !diagnostico) {
    responder(res, 400, 'El turno y el diagnostico son obligatorios');
    return;
  }

  const [turnos] = await pool.query<RowDataPacket[]>(
    `SELECT turno.id, turno.estado, turno.id_paciente, agenda.id_medico
     FROM turno
     INNER JOIN agenda ON agenda.id = turno.id_agenda
     WHERE turno.id = ?`,
    [id_turno]
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
    [id_turno]
  );

  if (historialesExistentes.length > 0) {
    responder(res, 409, 'El turno ya tiene historial clinico cargado');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO historial_clinico
      (id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id_turno, req.usuario.id, turno.id_paciente, diagnostico, tratamiento ?? null, observaciones ?? null]
  );

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
