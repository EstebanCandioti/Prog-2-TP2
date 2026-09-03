import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';
import { requireJwtSecret } from '../config/env';
import { registrarAuditoria } from '../services/auditoriaService';
import { AuthRequest, JwtPayload } from '../types/auth';
import { UsuarioRow } from '../types/usuario';
import { responder } from '../utils/respuesta';

interface RegistroBody {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono?: string;
  password: string;
  fecha_nacimiento: string;
  id_cobertura: number;
}

interface LoginBody {
  dni: string;
  password: string;
}

const usuarioPublicoSelect = `
  id,
  nombre,
  apellido,
  dni,
  email,
  telefono,
  fecha_nacimiento,
  id_cobertura,
  id_sede,
  rol
`;

const camposRegistroCompletos = (body: RegistroBody): boolean => {
  return Boolean(
    body.nombre &&
      body.apellido &&
      body.dni &&
      body.email &&
      body.password &&
      body.fecha_nacimiento &&
      body.id_cobertura
  );
};

export const registro = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as RegistroBody;
  const { nombre, apellido, dni, email, telefono, password, fecha_nacimiento, id_cobertura } = body;

  if (!camposRegistroCompletos(body)) {
    responder(res, 400, 'Faltan campos obligatorios');
    return;
  }

  const [usuariosExistentes] = await pool.query<UsuarioRow[]>(
    'SELECT dni, email FROM usuario WHERE dni = ? OR email = ? LIMIT 1',
    [dni, email]
  );

  if (usuariosExistentes.length > 0) {
    responder(res, 409, 'El DNI o email ya se encuentra registrado');
    return;
  }

  const hash = await bcrypt.hash(password, 10);

  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO usuario
      (nombre, apellido, dni, email, telefono, password, fecha_nacimiento, id_cobertura, id_sede, rol)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'paciente')`,
    [nombre, apellido, dni, email, telefono ?? '', hash, fecha_nacimiento, id_cobertura]
  );

  const [usuarios] = await pool.query<UsuarioRow[]>(
    `SELECT ${usuarioPublicoSelect} FROM usuario WHERE id = ? LIMIT 1`,
    [resultado.insertId]
  );

  await registrarAuditoria(resultado.insertId, 'ALTA', 'usuario', resultado.insertId, `Alta del usuario ${resultado.insertId}`);

  responder(res, 201, 'ok', usuarios[0]);
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { dni, password } = req.body as LoginBody;

  if (!dni || !password) {
    responder(res, 400, 'DNI y password son obligatorios');
    return;
  }

  const [usuarios] = await pool.query<UsuarioRow[]>(
    `SELECT id, password, rol, id_sede
     FROM usuario
     WHERE dni = ?
     LIMIT 1`,
    [dni]
  );

  const usuario = usuarios[0];

  if (!usuario) {
    responder(res, 401, 'Credenciales invalidas');
    return;
  }

  const passwordValida = await bcrypt.compare(password, usuario.password ?? '');

  if (!passwordValida) {
    responder(res, 401, 'Credenciales invalidas');
    return;
  }

  const payload: JwtPayload = {
    id: Number(usuario.id),
    rol: usuario.rol,
    id_sede: usuario.id_sede ?? null
  };

  const token = jwt.sign(payload, requireJwtSecret(), { expiresIn: '1h' });

  responder(res, 200, 'ok', { token, usuario: payload });
};

export const perfil = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.usuario?.id;

  if (!id) {
    responder(res, 401, 'Token no verificado');
    return;
  }

  const [usuarios] = await pool.query<UsuarioRow[]>(
    `SELECT ${usuarioPublicoSelect} FROM usuario WHERE id = ? LIMIT 1`,
    [id]
  );

  if (usuarios.length === 0) {
    responder(res, 404, 'Usuario no encontrado');
    return;
  }

  responder(res, 200, 'ok', usuarios[0]);
};
