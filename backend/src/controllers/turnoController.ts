import { Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { crearNotificacion } from '../services/notificacionService';
import { horaValidaAgenda, validarFechaAgenda } from '../services/agendaService';
import { obtenerBloquesTurno } from '../services/disponibilidadService';
import { validarDatosClinicos } from '../services/historialClinicoService';
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

const idQueryValido = (valor: unknown): valor is string =>
  typeof valor === 'string' && /^\d+$/.test(valor) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0;

const querySimple = (req: AuthRequest): boolean => Object.values(req.query).every((valor) => typeof valor === 'string');

const fechaListado = (req: AuthRequest, res: Response): string | null => {
  if (req.query.fecha === undefined) {
    responder(res, 400, 'La fecha es obligatoria');
    return null;
  }
  const errorFecha = validarFechaAgenda(req.query.fecha);
  if (errorFecha) {
    responder(res, 400, errorFecha);
    return null;
  }
  return req.query.fecha as string;
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

const turnoListadoConPacienteSelect = `${turnoListadoSelect},
  paciente.nombre AS paciente_nombre,
  paciente.apellido AS paciente_apellido,
  DATE_FORMAT(paciente.fecha_nacimiento, '%Y-%m-%d') AS paciente_fecha_nacimiento`;

const turnoListadoConPacienteFrom = `${turnoListadoFrom}
  INNER JOIN usuario paciente ON paciente.id = turno.id_paciente`;

const puedeGestionarTurno = (req: AuthRequest, turno: RowDataPacket): boolean => {
  if (req.usuario?.rol === 'paciente') {
    return req.usuario.id === turno.id_paciente;
  }

  if (req.usuario?.rol === 'medico') {
    return req.usuario.id === Number(turno.id_medico);
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

  const validacion = validarDatosClinicos(req.body);
  if (validacion.error !== null) {
    responder(res, 400, validacion.error);
    return;
  }

  const { diagnostico, tratamiento, observaciones } = validacion.datos;
  const connection = await pool.getConnection();
  let turno: RowDataPacket;
  let turnoActualizado: RowDataPacket;

  try {
    await connection.beginTransaction();

    const [turnos] = await connection.query<RowDataPacket[]>(
      `SELECT turno.*, agenda.id_medico, agenda.id_sede
       FROM turno
       INNER JOIN agenda ON agenda.id = turno.id_agenda
       WHERE turno.id = ?
       FOR UPDATE`,
      [id]
    );
    turno = turnos[0];

    if (!turno) {
      await connection.rollback();
      responder(res, 404, 'Turno no encontrado');
      return;
    }

    if (!puedeGestionarTurno(req, turno)) {
      await connection.rollback();
      responder(res, 403, 'No tiene permisos para atender este turno');
      return;
    }

    if (turno.estado !== 'confirmado') {
      await connection.rollback();
      responder(res, 409, 'Solo se pueden atender turnos confirmados');
      return;
    }

    const [historiales] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM historial_clinico WHERE id_turno = ?',
      [id]
    );
    if (historiales.length > 0) {
      await connection.rollback();
      responder(res, 409, 'El turno ya tiene historial clinico cargado');
      return;
    }

    await connection.query(
      `INSERT INTO historial_clinico
        (id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.usuario!.id, turno.id_paciente, diagnostico, tratamiento ?? null, observaciones ?? null]
    );
    await connection.query('UPDATE turno SET estado = ? WHERE id = ?', ['atendido', id]);

    const [turnosActualizados] = await connection.query<RowDataPacket[]>('SELECT * FROM turno WHERE id = ?', [id]);
    turnoActualizado = turnosActualizados[0];

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      responder(res, 409, 'El turno ya tiene historial clinico cargado');
      return;
    }
    throw error;
  } finally {
    connection.release();
  }

  const mensaje = `Tu turno del ${turno.fecha} a las ${turno.hora} fue atendido.`;

  await crearNotificacion(turno.id_paciente, 'turno_atendido', mensaje);

  responder(res, 200, 'ok', turnoActualizado);
};

export const listarMisTurnos = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!querySimple(req)) {
    responder(res, 400, 'Los parámetros deben ser valores simples');
    return;
  }
  if (Object.keys(req.query).some((clave) => clave !== 'tipo' && clave !== 'pagina')) {
    responder(res, 400, 'Solo se permiten los parámetros tipo y pagina');
    return;
  }

  const tipo = req.query.tipo ?? 'todos';
  if (tipo !== 'proximos' && tipo !== 'todos') {
    responder(res, 400, 'El tipo debe ser proximos o todos');
    return;
  }
  if (req.query.pagina !== undefined && !idQueryValido(req.query.pagina)) {
    responder(res, 400, 'pagina debe ser un entero positivo seguro');
    return;
  }

  const limite = 20;
  const pagina = Number(req.query.pagina ?? 1);
  const offset = (pagina - 1) * limite;
  if (!Number.isSafeInteger(offset)) {
    responder(res, 400, 'El desplazamiento de pagina debe ser un entero seguro');
    return;
  }

  const condiciones = ['turno.id_paciente = ?'];
  const valores: Array<string | number> = [req.usuario!.id];
  if (tipo === 'proximos') {
    // Compartir el mismo instante de MySQL entre el conteo y la página.
    const [reloj] = await pool.query<RowDataPacket[]>("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS ahora");
    condiciones.push('turno.estado = ?', 'TIMESTAMP(turno.fecha, turno.hora) >= ?');
    valores.push('confirmado', reloj[0].ahora);
  }

  const where = `WHERE ${condiciones.join(' AND ')}`;
  const orden = tipo === 'proximos' ? 'ASC' : 'DESC';
  const [totales] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total ${turnoListadoFrom} ${where}`,
    valores
  );
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT ${turnoListadoSelect}
     ${turnoListadoFrom}
     ${where}
     ORDER BY turno.fecha ${orden}, turno.hora ${orden}, turno.id ${orden}
     LIMIT ? OFFSET ?`,
    [...valores, limite, offset]
  );

  responder(res, 200, 'ok', { items, total: Number(totales[0].total), pagina, limite });
};

export const obtenerHistorialTurno = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);
  if (id === null) return;

  const [turnos] = await pool.query<RowDataPacket[]>(
    'SELECT id, id_paciente, estado FROM turno WHERE id = ? LIMIT 1',
    [id]
  );
  const turno = turnos[0];
  if (!turno) {
    responder(res, 404, 'Turno no encontrado');
    return;
  }
  if (Number(turno.id_paciente) !== req.usuario!.id) {
    responder(res, 403, 'El paciente solo puede consultar el historial de sus propios turnos');
    return;
  }
  if (turno.estado !== 'atendido') {
    responder(res, 409, 'El historial clinico solo puede consultarse para turnos atendidos');
    return;
  }

  const [historiales] = await pool.query<RowDataPacket[]>(
    `SELECT id, id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones, fecha_registro
     FROM historial_clinico WHERE id_turno = ? ORDER BY id ASC LIMIT 1`,
    [id]
  );
  if (historiales.length === 0) {
    responder(res, 404, 'El turno atendido todavia no tiene historial clinico cargado');
    return;
  }

  responder(res, 200, 'ok', historiales[0]);
};

export const listarTurnosMedico = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!querySimple(req)) {
    responder(res, 400, 'Los parámetros deben ser valores simples');
    return;
  }
  const fecha = fechaListado(req, res);
  if (fecha === null) return;

  const idSede = req.query.id_sede;
  if (idSede !== undefined && !idQueryValido(idSede)) {
    responder(res, 400, 'El id_sede debe ser un entero positivo');
    return;
  }

  // Un id_medico enviado por el cliente no reemplaza al médico autenticado.
  if (req.query.id_medico !== undefined && !idQueryValido(req.query.id_medico)) {
    responder(res, 400, 'El id_medico debe ser un entero positivo');
    return;
  }

  const parametros: Array<number | string> = [req.usuario!.id, fecha];
  let filtroSede = '';
  if (idSede !== undefined) {
    filtroSede = ' AND agenda.id_sede = ?';
    parametros.push(Number(idSede));
  }

  const [turnos] = await pool.query<RowDataPacket[]>(
    `SELECT ${turnoListadoConPacienteSelect}
     ${turnoListadoConPacienteFrom}
     WHERE agenda.id_medico = ?
       AND turno.fecha = ?${filtroSede}
     ORDER BY turno.hora ASC, turno.id ASC`,
    parametros
  );

  responder(res, 200, 'ok', turnos);
};

export const listarTurnosSede = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!idValido(req.usuario?.id_sede)) {
    responder(res, 403, 'El operador no tiene una sede valida asignada');
    return;
  }
  if (!querySimple(req)) {
    responder(res, 400, 'Los parámetros deben ser valores simples');
    return;
  }
  const fecha = fechaListado(req, res);
  if (fecha === null) return;

  const idMedico = req.query.id_medico;
  if (idMedico !== undefined && !idQueryValido(idMedico)) {
    responder(res, 400, 'El id_medico debe ser un entero positivo');
    return;
  }
  const estado = req.query.estado;
  if (estado !== undefined && !['confirmado', 'cancelado', 'atendido'].includes(estado as string)) {
    responder(res, 400, 'El estado debe ser confirmado, cancelado o atendido');
    return;
  }

  // id_sede no selecciona otra sede: la consulta siempre usa la del token actualizado.
  if (req.query.id_sede !== undefined && !idQueryValido(req.query.id_sede)) {
    responder(res, 400, 'El id_sede debe ser un entero positivo');
    return;
  }

  const parametros: Array<number | string> = [req.usuario!.id_sede!, fecha];
  let filtros = '';
  if (idMedico !== undefined) {
    filtros += ' AND agenda.id_medico = ?';
    parametros.push(Number(idMedico));
  }
  if (estado !== undefined) {
    filtros += ' AND turno.estado = ?';
    parametros.push(estado as string);
  }

  const [turnos] = await pool.query<RowDataPacket[]>(
    `SELECT ${turnoListadoConPacienteSelect}
     ${turnoListadoConPacienteFrom}
     WHERE agenda.id_sede = ?
       AND turno.fecha = ?${filtros}
     ORDER BY turno.hora ASC, turno.id ASC`,
    parametros
  );

  responder(res, 200, 'ok', turnos);
};
