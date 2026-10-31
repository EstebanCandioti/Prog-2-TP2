import { Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { crearNotificacion } from '../services/notificacionService';
import { horaValidaAgenda, validarFechaAgenda } from '../services/agendaService';
import { obtenerBloquesTurno } from '../services/disponibilidadService';
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

const mensajeSedeOperador = 'Solo podés realizar esta operación en tu sede asignada. Si tu asignación cambió recientemente, cerrá sesión y volvé a ingresar para actualizarla.';

const obtenerIdParam = (req: AuthRequest, res: Response): number | null => {
  const valor = req.params.id;
  const id = Number(valor);

  if (typeof valor !== 'string' || !/^\d+$/.test(valor) || !Number.isSafeInteger(id) || id <= 0) {
    responder(res, 400, 'El id debe ser un entero positivo');
    return null;
  }

  return id;
};

const idValido = (valor: unknown): valor is number => typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0;

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
    return idValido(req.usuario.id_sede) && req.usuario.id_sede === Number(turno.id_sede);
  }

  return false;
};

export const crearTurno = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.usuario?.rol === 'operador' && !idValido(req.usuario.id_sede)) {
    responder(res, 403, 'El operador no tiene una sede valida asignada');
    return;
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    responder(res, 400, 'El cuerpo debe ser un objeto');
    return;
  }
  const body = req.body as TurnoBody;
  const { id_medico, id_especialidad, id_sede, fecha, hora, nota } = body;

  if (!camposCrearTurnoCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  if (!idValido(id_medico) || !idValido(id_especialidad) || !idValido(id_sede)) {
    responder(res, 400, 'Los IDs de medico, especialidad y sede deben ser enteros positivos');
    return;
  }

  const errorFecha = validarFechaAgenda(fecha);
  if (errorFecha) {
    responder(res, 400, errorFecha);
    return;
  }
  if (!horaValidaAgenda(hora)) {
    responder(res, 400, 'La hora debe tener formato HH:mm y ser válida');
    return;
  }

  const idPaciente = req.usuario?.rol === 'paciente' ? req.usuario.id : body.id_paciente;

  if (!idPaciente) {
    responder(res, 400, 'El id_paciente es obligatorio para el operador');
    return;
  }

  if (!idValido(idPaciente)) {
    responder(res, 400, 'El id_paciente debe ser un entero positivo');
    return;
  }

  if (req.usuario?.rol === 'operador' && req.usuario.id_sede !== id_sede) {
    responder(res, 403, mensajeSedeOperador);
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

  const { bloques, disponibles } = await obtenerBloquesTurno(id_medico, id_especialidad, id_sede, fecha);
  if (!bloques.some((bloque) => bloque.hora === hora)) {
    responder(res, 400, 'El horario solicitado no esta disponible en la agenda del medico');
    return;
  }
  const bloqueLibre = disponibles.find((bloque) => bloque.hora === hora);
  if (!bloqueLibre) {
    responder(res, 409, 'El horario solicitado ya tiene un turno confirmado');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO turno (nota, id_agenda, fecha, hora, id_paciente, id_cobertura, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nota, bloqueLibre.id_agenda, fecha, hora, idPaciente, paciente.id_cobertura, 'confirmado']
  );

  const mensaje = `Tu turno del ${fecha} a las ${hora} fue confirmado.`;

  await crearNotificacion(idPaciente, 'turno_confirmado', mensaje);

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
    if (req.usuario?.rol === 'operador') {
      responder(res, 403, idValido(req.usuario.id_sede) ? mensajeSedeOperador : 'El operador no tiene una sede valida asignada');
    } else {
      responder(res, 403, 'No tiene permisos para cancelar este turno');
    }
    return;
  }

  if (turno.estado !== 'confirmado') {
    responder(res, 409, 'Solo se pueden cancelar turnos confirmados');
    return;
  }

  await pool.query('UPDATE turno SET estado = ? WHERE id = ?', ['cancelado', id]);

  const mensaje = `Tu turno del ${turno.fecha} a las ${turno.hora} fue cancelado.`;

  await crearNotificacion(turno.id_paciente, 'turno_cancelado', mensaje);

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

  await crearNotificacion(turno.id_paciente, 'turno_atendido', mensaje);

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
  if (!idValido(req.usuario?.id_sede)) {
    responder(res, 403, 'El operador no tiene una sede valida asignada');
    return;
  }
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
