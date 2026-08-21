import { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { AuthRequest } from '../types/auth';
import { responder } from '../utils/respuesta';

interface AgendaBody {
  hora_entrada: string;
  hora_salida: string;
  fecha: string;
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
}

const obtenerIdParam = (req: Request, res: Response): number | null => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    responder(res, 400, 'El id debe ser numerico');
    return null;
  }

  return id;
};

const camposAgendaCompletos = (body: AgendaBody): boolean => {
  return Boolean(
    body.hora_entrada &&
      body.hora_salida &&
      body.fecha &&
      body.id_medico &&
      body.id_especialidad &&
      body.id_sede
  );
};

const validarRelacionesAgenda = async (body: AgendaBody, res: Response): Promise<boolean> => {
  const [medicos] = await pool.query<RowDataPacket[]>('SELECT id FROM usuario WHERE id = ? AND rol = ?', [
    body.id_medico,
    'medico'
  ]);

  if (medicos.length === 0) {
    responder(res, 400, 'El medico indicado no existe o no tiene rol medico');
    return false;
  }

  const [especialidades] = await pool.query<RowDataPacket[]>('SELECT id FROM especialidad WHERE id = ?', [
    body.id_especialidad
  ]);

  if (especialidades.length === 0) {
    responder(res, 400, 'La especialidad indicada no existe');
    return false;
  }

  const [sedes] = await pool.query<RowDataPacket[]>('SELECT id FROM sede WHERE id = ?', [body.id_sede]);

  if (sedes.length === 0) {
    responder(res, 400, 'La sede indicada no existe');
    return false;
  }

  return true;
};

const validarAgendaPropia = (req: AuthRequest, res: Response, idMedico: number): boolean => {
  if (req.usuario?.rol === 'medico' && req.usuario.id !== idMedico) {
    responder(res, 403, 'El medico solo puede gestionar su propia agenda');
    return false;
  }

  return true;
};

const obtenerAgendaExistente = async (id: number): Promise<RowDataPacket | null> => {
  const [agendas] = await pool.query<RowDataPacket[]>('SELECT * FROM agenda WHERE id = ?', [id]);
  return agendas[0] ?? null;
};

const agregarFiltro = (condiciones: string[], valores: unknown[], campo: string, valor: unknown): void => {
  if (valor) {
    condiciones.push(`${campo} = ?`);
    valores.push(valor);
  }
};

export const listarAgendas = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id_medico, id_sede, fecha } = req.query;
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (req.usuario?.rol === 'medico') {
    condiciones.push('id_medico = ?');
    valores.push(req.usuario.id);
  } else {
    agregarFiltro(condiciones, valores, 'id_medico', id_medico);
  }

  agregarFiltro(condiciones, valores, 'id_sede', id_sede);
  agregarFiltro(condiciones, valores, 'fecha', fecha);

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [agendas] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM agenda ${where} ORDER BY fecha, hora_entrada`,
    valores
  );

  responder(res, 200, 'ok', agendas);
};

export const obtenerAgendaPorId = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const agenda = await obtenerAgendaExistente(id);

  if (!agenda) {
    responder(res, 404, 'Agenda no encontrada');
    return;
  }

  if (!validarAgendaPropia(req, res, Number(agenda.id_medico))) {
    return;
  }

  responder(res, 200, 'ok', agenda);
};

export const crearAgenda = async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body as AgendaBody;
  const { hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede } = body;

  if (!camposAgendaCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  if (!validarAgendaPropia(req, res, id_medico)) {
    return;
  }

  const relacionesValidas = await validarRelacionesAgenda(body, res);

  if (!relacionesValidas) {
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO agenda (hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede]
  );

  const [agendas] = await pool.query<RowDataPacket[]>('SELECT * FROM agenda WHERE id = ?', [resultado.insertId]);

  responder(res, 201, 'ok', agendas[0]);
};

export const actualizarAgenda = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const agendaExistente = await obtenerAgendaExistente(id);

  if (!agendaExistente) {
    responder(res, 404, 'Agenda no encontrada');
    return;
  }

  if (!validarAgendaPropia(req, res, Number(agendaExistente.id_medico))) {
    return;
  }

  const body = req.body as AgendaBody;
  const { hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede } = body;

  if (!camposAgendaCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  if (!validarAgendaPropia(req, res, id_medico)) {
    return;
  }

  const relacionesValidas = await validarRelacionesAgenda(body, res);

  if (!relacionesValidas) {
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>(
    `UPDATE agenda
     SET hora_entrada = ?, hora_salida = ?, fecha = ?, id_medico = ?, id_especialidad = ?, id_sede = ?
     WHERE id = ?`,
    [hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede, id]
  );

  const [agendas] = await pool.query<RowDataPacket[]>('SELECT * FROM agenda WHERE id = ?', [id]);

  responder(res, 200, 'ok', agendas[0]);
};

export const eliminarAgenda = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const agendaExistente = await obtenerAgendaExistente(id);

  if (!agendaExistente) {
    responder(res, 404, 'Agenda no encontrada');
    return;
  }

  if (!validarAgendaPropia(req, res, Number(agendaExistente.id_medico))) {
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('DELETE FROM agenda WHERE id = ?', [id]);

  responder(res, 200, 'ok', null);
};
