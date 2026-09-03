import { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { registrarAuditoria } from '../services/auditoriaService';
import { AuthRequest } from '../types/auth';
import { responder } from '../utils/respuesta';

interface SedeBody {
  nombre: string;
  direccion: string;
  telefono: string;
}

const obtenerIdParam = (req: Request, res: Response): number | null => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    responder(res, 400, 'El id debe ser numerico');
    return null;
  }

  return id;
};

const camposSedeCompletos = (body: SedeBody): boolean => {
  return Boolean(body.nombre && body.direccion && body.telefono);
};

export const listarSedes = async (_req: Request, res: Response): Promise<void> => {
  const [sedes] = await pool.query<RowDataPacket[]>('SELECT * FROM sede ORDER BY nombre');
  responder(res, 200, 'ok', sedes);
};

export const obtenerSedePorId = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const [sedes] = await pool.query<RowDataPacket[]>('SELECT * FROM sede WHERE id = ?', [id]);

  if (sedes.length === 0) {
    responder(res, 404, 'Sede no encontrada');
    return;
  }

  responder(res, 200, 'ok', sedes[0]);
};

export const crearSede = async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body as SedeBody;
  const { nombre, direccion, telefono } = body;

  if (!req.usuario) {
    responder(res, 401, 'Token no verificado');
    return;
  }

  if (!camposSedeCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>(
    'INSERT INTO sede (nombre, direccion, telefono) VALUES (?, ?, ?)',
    [nombre, direccion, telefono]
  );

  const [sedes] = await pool.query<RowDataPacket[]>('SELECT * FROM sede WHERE id = ?', [resultado.insertId]);

  await registrarAuditoria(req.usuario.id, 'ALTA', 'sede', resultado.insertId, `Alta de sede ${nombre}`);

  responder(res, 201, 'ok', sedes[0]);
};

export const actualizarSede = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const body = req.body as SedeBody;
  const { nombre, direccion, telefono } = body;

  if (!req.usuario) {
    responder(res, 401, 'Token no verificado');
    return;
  }

  if (!camposSedeCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>(
    'UPDATE sede SET nombre = ?, direccion = ?, telefono = ? WHERE id = ?',
    [nombre, direccion, telefono, id]
  );

  if (resultado.affectedRows === 0) {
    responder(res, 404, 'Sede no encontrada');
    return;
  }

  const [sedes] = await pool.query<RowDataPacket[]>('SELECT * FROM sede WHERE id = ?', [id]);

  await registrarAuditoria(req.usuario.id, 'MODIFICACION', 'sede', id, `Modificacion de sede ${id}`);

  responder(res, 200, 'ok', sedes[0]);
};

export const eliminarSede = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  if (!req.usuario) {
    responder(res, 401, 'Token no verificado');
    return;
  }

  const [usuarios] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM usuario WHERE id_sede = ? AND rol IN (?, ?) LIMIT 1',
    [id, 'medico', 'operador']
  );

  if (usuarios.length > 0) {
    responder(res, 409, 'No se puede eliminar la sede porque tiene medicos u operadores asociados');
    return;
  }

  const [agendas] = await pool.query<RowDataPacket[]>('SELECT id FROM agenda WHERE id_sede = ? LIMIT 1', [id]);

  if (agendas.length > 0) {
    responder(res, 409, 'No se puede eliminar la sede porque tiene agenda asociada');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('DELETE FROM sede WHERE id = ?', [id]);

  if (resultado.affectedRows === 0) {
    responder(res, 404, 'Sede no encontrada');
    return;
  }

  await registrarAuditoria(req.usuario.id, 'BAJA', 'sede', id, `Baja de sede ${id}`);

  responder(res, 200, 'ok', null);
};
