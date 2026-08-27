import { Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { AuthRequest } from '../types/auth';
import { responder } from '../utils/respuesta';

interface TurnoBody {
  id_paciente?: number;
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
  fecha: string;
  hora: string;
  nota: string;
}

const obtenerIdParam = (req: AuthRequest, res: Response): number | null => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    responder(res, 400, 'El id debe ser numerico');
    return null;
  }

  return id;
};

const camposCrearTurnoCompletos = (body: TurnoBody): boolean => {
  return Boolean(body.id_medico && body.id_especialidad && body.id_sede && body.fecha && body.hora && body.nota);
};

const obtenerTurnoConAgenda = async (id: number): Promise<RowDataPacket | null> => {
  const [turnos] = await pool.query<RowDataPacket[]>(
    `SELECT turno.*, agenda.id_medico, agenda.id_sede
     FROM turno
     INNER JOIN agenda ON agenda.id = turno.id_agenda
     WHERE turno.id = ?`,
    [id]
  );

  return turnos[0] ?? null;
};

const turnoListadoSelect = `
  turno.id,
  turno.nota,
  turno.fecha,
  turno.hora,
  turno.estado,
  turno.id_paciente,
  turno.id_cobertura,
  agenda.id AS id_agenda,
  agenda.id_medico,
  agenda.id_especialidad,
  agenda.id_sede,
  medico.nombre AS medico_nombre,
  medico.apellido AS medico_apellido,
  sede.nombre AS sede_nombre,
  especialidad.descripcion AS especialidad_descripcion
`;

const turnoListadoFrom = `
  FROM turno
  INNER JOIN agenda ON agenda.id = turno.id_agenda
  INNER JOIN usuario medico ON medico.id = agenda.id_medico
  INNER JOIN sede ON sede.id = agenda.id_sede
  INNER JOIN especialidad ON especialidad.id = agenda.id_especialidad
`;

const puedeGestionarTurno = (req: AuthRequest, turno: RowDataPacket): boolean => {
  if (req.usuario?.rol === 'paciente') {
    return req.usuario.id === turno.id_paciente;
  }

  if (req.usuario?.rol === 'medico') {
    return req.usuario.id === turno.id_medico && req.usuario.id_sede === turno.id_sede;
  }

  if (req.usuario?.rol === 'operador') {
    return req.usuario.id_sede === turno.id_sede;
  }

  return false;
};

export const crearTurno = async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body as TurnoBody;
  const { id_medico, id_especialidad, id_sede, fecha, hora, nota } = body;

  if (!camposCrearTurnoCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  const idPaciente = req.usuario?.rol === 'paciente' ? req.usuario.id : body.id_paciente;

  if (!idPaciente) {
    responder(res, 400, 'El id_paciente es obligatorio para el operador');
    return;
  }

  if (req.usuario?.rol === 'operador' && req.usuario.id_sede !== id_sede) {
    responder(res, 403, 'El operador solo puede crear turnos de su propia sede');
    return;
  }

  const [pacientes] = await pool.query<RowDataPacket[]>('SELECT id, id_cobertura FROM usuario WHERE id = ? AND rol = ?', [
    idPaciente,
    'paciente'
  ]);
  const paciente = pacientes[0];

  if (!paciente) {
    responder(res, 400, 'El paciente indicado no existe');
    return;
  }

  if (!paciente.id_cobertura) {
    responder(res, 400, 'El paciente no tiene cobertura registrada');
    return;
  }

  const [agendas] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM agenda
     WHERE id_medico = ?
       AND id_especialidad = ?
       AND id_sede = ?
       AND fecha = ?
       AND hora_entrada <= ?
       AND hora_salida > ?`,
    [id_medico, id_especialidad, id_sede, fecha, hora, hora]
  );
  const agenda = agendas[0];

  if (!agenda) {
    responder(res, 400, 'El horario solicitado no esta disponible en la agenda del medico');
    return;
  }

  const [turnosConfirmados] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM turno
     WHERE id_agenda = ?
       AND fecha = ?
       AND hora = ?
       AND estado = ?`,
    [agenda.id, fecha, hora, 'confirmado']
  );

  if (turnosConfirmados.length > 0) {
    responder(res, 409, 'El horario solicitado ya tiene un turno confirmado');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO turno (nota, id_agenda, fecha, hora, id_paciente, id_cobertura, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nota, agenda.id, fecha, hora, idPaciente, paciente.id_cobertura, 'confirmado']
  );

  const mensaje = `Tu turno del ${fecha} a las ${hora} fue confirmado.`;

  await pool.query(
    'INSERT INTO notificacion (id_usuario, tipo, mensaje, leida) VALUES (?, ?, ?, ?)',
    [idPaciente, 'turno_confirmado', mensaje, 0]
  );

  const [turnos] = await pool.query<RowDataPacket[]>('SELECT * FROM turno WHERE id = ?', [resultado.insertId]);

  responder(res, 201, 'ok', turnos[0]);
};

export const cancelarTurno = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const turno = await obtenerTurnoConAgenda(id);

  if (!turno) {
    responder(res, 404, 'Turno no encontrado');
    return;
  }

  if (!puedeGestionarTurno(req, turno)) {
    responder(res, 403, 'No tiene permisos para cancelar este turno');
    return;
  }

  if (turno.estado !== 'confirmado') {
    responder(res, 409, 'Solo se pueden cancelar turnos confirmados');
    return;
  }

  await pool.query('UPDATE turno SET estado = ? WHERE id = ?', ['cancelado', id]);

  const mensaje = `Tu turno del ${turno.fecha} a las ${turno.hora} fue cancelado.`;

  await pool.query('INSERT INTO notificacion (id_usuario, tipo, mensaje, leida) VALUES (?, ?, ?, ?)', [
    turno.id_paciente,
    'turno_cancelado',
    mensaje,
    0
  ]);

  const [turnos] = await pool.query<RowDataPacket[]>('SELECT * FROM turno WHERE id = ?', [id]);

  responder(res, 200, 'ok', turnos[0]);
};

export const atenderTurno = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const turno = await obtenerTurnoConAgenda(id);

  if (!turno) {
    responder(res, 404, 'Turno no encontrado');
    return;
  }

  if (!puedeGestionarTurno(req, turno)) {
    responder(res, 403, 'No tiene permisos para atender este turno');
    return;
  }

  if (turno.estado !== 'confirmado') {
    responder(res, 409, 'Solo se pueden atender turnos confirmados');
    return;
  }

  await pool.query('UPDATE turno SET estado = ? WHERE id = ?', ['atendido', id]);

  const mensaje = `Tu turno del ${turno.fecha} a las ${turno.hora} fue atendido.`;

  await pool.query('INSERT INTO notificacion (id_usuario, tipo, mensaje, leida) VALUES (?, ?, ?, ?)', [
    turno.id_paciente,
    'turno_atendido',
    mensaje,
    0
  ]);

  const [turnos] = await pool.query<RowDataPacket[]>('SELECT * FROM turno WHERE id = ?', [id]);

  responder(res, 200, 'ok', turnos[0]);
};

export const listarMisTurnos = async (req: AuthRequest, res: Response): Promise<void> => {
  const [turnos] = await pool.query<RowDataPacket[]>(
    `SELECT ${turnoListadoSelect}
     ${turnoListadoFrom}
     WHERE turno.id_paciente = ?
     ORDER BY turno.fecha ASC, turno.hora ASC`,
    [req.usuario?.id]
  );

  responder(res, 200, 'ok', turnos);
};

export const listarTurnosMedico = async (req: AuthRequest, res: Response): Promise<void> => {
  const fecha = req.query.fecha;

  if (!fecha) {
    responder(res, 400, 'La fecha es obligatoria');
    return;
  }

  const [turnos] = await pool.query<RowDataPacket[]>(
    `SELECT ${turnoListadoSelect}
     ${turnoListadoFrom}
     WHERE agenda.id_medico = ?
       AND turno.fecha = ?
     ORDER BY turno.hora ASC`,
    [req.usuario?.id, fecha]
  );

  responder(res, 200, 'ok', turnos);
};

export const listarTurnosSede = async (req: AuthRequest, res: Response): Promise<void> => {
  const fecha = req.query.fecha;

  if (!fecha) {
    responder(res, 400, 'La fecha es obligatoria');
    return;
  }

  const [turnos] = await pool.query<RowDataPacket[]>(
    `SELECT ${turnoListadoSelect}
     ${turnoListadoFrom}
     WHERE agenda.id_sede = ?
       AND turno.fecha = ?
     ORDER BY turno.hora ASC`,
    [req.usuario?.id_sede, fecha]
  );

  responder(res, 200, 'ok', turnos);
};
