import { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { responder } from '../utils/respuesta';

interface UsuarioBody {
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  rol: string;
  email: string;
  telefono: string;
  id_sede: number | null;
  id_cobertura: number | null;
}

const usuarioPublicoSelect = `
  id,
  apellido,
  nombre,
  fecha_nacimiento,
  rol,
  email,
  telefono,
  dni,
  id_sede,
  id_cobertura
`;

const obtenerIdParam = (req: Request, res: Response): number | null => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    responder(res, 400, 'El id debe ser numerico');
    return null;
  }

  return id;
};

const camposUsuarioCompletos = (body: UsuarioBody): boolean => {
  return Boolean(
    body.nombre &&
      body.apellido &&
      body.fecha_nacimiento &&
      body.rol &&
      body.email &&
      body.telefono
  );
};

export const listarUsuarios = async (_req: Request, res: Response): Promise<void> => {
  const [usuarios] = await pool.query<RowDataPacket[]>(`SELECT ${usuarioPublicoSelect} FROM usuario ORDER BY apellido`);
  responder(res, 200, 'ok', usuarios);
};

export const obtenerUsuarioPorId = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const [usuarios] = await pool.query<RowDataPacket[]>(`SELECT ${usuarioPublicoSelect} FROM usuario WHERE id = ?`, [id]);

  if (usuarios.length === 0) {
    responder(res, 404, 'Usuario no encontrado');
    return;
  }

  responder(res, 200, 'ok', usuarios[0]);
};

export const actualizarUsuario = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const body = req.body as UsuarioBody;
  const { nombre, apellido, fecha_nacimiento, rol, email, telefono, id_sede, id_cobertura } = body;

  if (!camposUsuarioCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  const [usuariosDuplicados] = await pool.query<RowDataPacket[]>('SELECT id FROM usuario WHERE email = ? AND id <> ?', [
    email,
    id
  ]);

  if (usuariosDuplicados.length > 0) {
    responder(res, 409, 'El email ya se encuentra registrado');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>(
    `UPDATE usuario
     SET nombre = ?, apellido = ?, fecha_nacimiento = ?, rol = ?, email = ?, telefono = ?, id_sede = ?, id_cobertura = ?
     WHERE id = ?`,
    [nombre, apellido, fecha_nacimiento, rol, email, telefono, id_sede, id_cobertura, id]
  );

  if (resultado.affectedRows === 0) {
    responder(res, 404, 'Usuario no encontrado');
    return;
  }

  const [usuarios] = await pool.query<RowDataPacket[]>(`SELECT ${usuarioPublicoSelect} FROM usuario WHERE id = ?`, [id]);

  responder(res, 200, 'ok', usuarios[0]);
};

export const eliminarUsuario = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('DELETE FROM usuario WHERE id = ?', [id]);

  if (resultado.affectedRows === 0) {
    responder(res, 404, 'Usuario no encontrado');
    return;
  }

  responder(res, 200, 'ok', null);
};
