import { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { validarDatosAgenda } from '../services/agendaService';
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

const mensajeSedeOperador = 'Solo podés realizar esta operación en tu sede asignada. Si tu asignación cambió recientemente, cerrá sesión y volvé a ingresar para actualizarla.';

const obtenerIdParam = (req: Request, res: Response): number | null => {
  const valor = req.params.id;
  const id = Number(valor);

  if (typeof valor !== 'string' || !/^\d+$/.test(valor) || !Number.isSafeInteger(id) || id <= 0) {
    responder(res, 400, 'El id debe ser un entero positivo');
    return null;
  }

  return id;
};

const idValido = (valor: unknown): valor is number => typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0;

const validarSedeOperador = (req: AuthRequest, res: Response, idSede?: number): boolean => {
  if (req.usuario?.rol !== 'operador') return true;
  if (!idValido(req.usuario.id_sede)) {
    responder(res, 403, 'El operador no tiene una sede valida asignada');
    return false;
  }
  if (idSede !== undefined && req.usuario.id_sede !== idSede) {
    responder(res, 403, mensajeSedeOperador);
    return false;
  }
  return true;
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

  const [especialidades] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM medico_especialidad
     WHERE id_medico = ? AND id_especialidad = ? LIMIT 1`,
    [body.id_medico, body.id_especialidad]
  );

  if (especialidades.length === 0) {
    responder(res, 400, 'La especialidad indicada no está asignada al médico.');
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

const agendaSelect = `
  agenda.*,
  medico.nombre AS medico_nombre,
  medico.apellido AS medico_apellido,
  especialidad.descripcion AS especialidad_descripcion,
  sede.nombre AS sede_nombre
`;

const agendaFrom = `
  FROM agenda
  INNER JOIN usuario medico ON medico.id = agenda.id_medico
  INNER JOIN especialidad ON especialidad.id = agenda.id_especialidad
  INNER JOIN sede ON sede.id = agenda.id_sede
`;

const obtenerAgendaExistente = async (id: number): Promise<RowDataPacket | null> => {
  const [agendas] = await pool.query<RowDataPacket[]>(
    `SELECT ${agendaSelect} ${agendaFrom} WHERE agenda.id = ?`, [id]
  );
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
    condiciones.push('agenda.id_medico = ?');
    valores.push(req.usuario.id);
  } else {
    agregarFiltro(condiciones, valores, 'agenda.id_medico', id_medico);
  }

  agregarFiltro(condiciones, valores, 'agenda.id_sede', id_sede);
  agregarFiltro(condiciones, valores, 'agenda.fecha', fecha);

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [agendas] = await pool.query<RowDataPacket[]>(
    `SELECT ${agendaSelect} ${agendaFrom} ${where} ORDER BY agenda.fecha, agenda.hora_entrada`,
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
  if (!validarSedeOperador(req, res)) return;
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    responder(res, 400, 'El cuerpo debe ser un objeto');
    return;
  }
  const body = req.body as AgendaBody;
  const { hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede } = body;

  if (!camposAgendaCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  if (!idValido(id_medico) || !idValido(id_especialidad) || !idValido(id_sede)) {
    responder(res, 400, 'Los IDs de medico, especialidad y sede deben ser enteros positivos');
    return;
  }

  if (!validarSedeOperador(req, res, id_sede)) return;

  if (!validarAgendaPropia(req, res, id_medico)) {
    return;
  }

  const errorDatos = validarDatosAgenda(fecha, hora_entrada, hora_salida);
  if (errorDatos) {
    responder(res, 400, errorDatos);
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

  if (!validarSedeOperador(req, res, Number(agendaExistente.id_sede))) return;

  if (!validarAgendaPropia(req, res, Number(agendaExistente.id_medico))) {
    return;
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    responder(res, 400, 'El cuerpo debe ser un objeto');
    return;
  }
  const body = req.body as AgendaBody;
  const { hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede } = body;

  if (!camposAgendaCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  if (!idValido(id_medico) || !idValido(id_especialidad) || !idValido(id_sede)) {
    responder(res, 400, 'Los IDs de medico, especialidad y sede deben ser enteros positivos');
    return;
  }

  if (!validarSedeOperador(req, res, id_sede)) return;

  if (!validarAgendaPropia(req, res, id_medico)) {
    return;
  }

  const errorDatos = validarDatosAgenda(fecha, hora_entrada, hora_salida);
  if (errorDatos) {
    responder(res, 400, errorDatos);
    return;
  }

  const [confirmados] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM turno WHERE id_agenda = ? AND estado = ? LIMIT 1', [id, 'confirmado']
  );
  if (confirmados.length > 0) {
    if (Number(agendaExistente.id_medico) !== id_medico ||
        Number(agendaExistente.id_especialidad) !== id_especialidad ||
        Number(agendaExistente.id_sede) !== id_sede) {
      responder(res, 409, 'La agenda tiene turnos confirmados: no se puede cambiar médico, especialidad ni sede');
      return;
    }
    const [fueraDelRango] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM turno WHERE id_agenda = ? AND estado = ?
       AND (fecha IS NULL OR fecha <> ? OR hora IS NULL OR hora < ? OR hora >= ?) LIMIT 1`,
      [id, 'confirmado', fecha, hora_entrada, hora_salida]
    );
    if (fueraDelRango.length > 0) {
      responder(res, 409, 'El nuevo rango dejaría turnos confirmados fuera de la agenda');
      return;
    }
  }

  const relacionesValidas = await validarRelacionesAgenda(body, res);
  if (!relacionesValidas) return;

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

  if (!validarSedeOperador(req, res, Number(agendaExistente.id_sede))) return;

  if (!validarAgendaPropia(req, res, Number(agendaExistente.id_medico))) {
    return;
  }

  const [confirmados] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM turno WHERE id_agenda = ? AND estado = ? LIMIT 1', [id, 'confirmado']
  );
  if (confirmados.length > 0) {
    responder(res, 409, 'No se puede eliminar la agenda porque tiene turnos confirmados');
    return;
  }
  const [turnos] = await pool.query<RowDataPacket[]>('SELECT id FROM turno WHERE id_agenda = ? LIMIT 1', [id]);
  if (turnos.length > 0) {
    responder(res, 409, 'No se puede eliminar la agenda porque tiene turnos asociados');
    return;
  }

  try {
    await pool.query<ResultSetHeader>('DELETE FROM agenda WHERE id = ?', [id]);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_ROW_IS_REFERENCED_2') {
      responder(res, 409, 'No se puede eliminar la agenda porque tiene registros asociados');
      return;
    }
    throw error;
  }

  responder(res, 200, 'ok', null);
};
