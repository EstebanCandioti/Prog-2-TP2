import { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { responder } from '../utils/respuesta';

interface CoberturaBody {
  nombre: string;
}

const obtenerIdParam = (req: Request, res: Response): number | null => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    responder(res, 400, 'El id debe ser numerico');
    return null;
  }

  return id;
};

export const listarCoberturas = async (_req: Request, res: Response): Promise<void> => {
  const [coberturas] = await pool.query<RowDataPacket[]>('SELECT * FROM cobertura ORDER BY nombre');
  responder(res, 200, 'ok', coberturas);
};

export const obtenerCoberturaPorId = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const [coberturas] = await pool.query<RowDataPacket[]>('SELECT * FROM cobertura WHERE id = ?', [id]);

  if (coberturas.length === 0) {
    responder(res, 404, 'Cobertura no encontrada');
    return;
  }

  responder(res, 200, 'ok', coberturas[0]);
};

export const crearCobertura = async (req: Request, res: Response): Promise<void> => {
  const { nombre } = req.body as CoberturaBody;

  if (!nombre) {
    responder(res, 400, 'El nombre es obligatorio');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('INSERT INTO cobertura (nombre) VALUES (?)', [nombre]);

  const [coberturas] = await pool.query<RowDataPacket[]>('SELECT * FROM cobertura WHERE id = ?', [resultado.insertId]);

  responder(res, 201, 'ok', coberturas[0]);
};

export const actualizarCobertura = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const { nombre } = req.body as CoberturaBody;

  if (!nombre) {
    responder(res, 400, 'El nombre es obligatorio');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('UPDATE cobertura SET nombre = ? WHERE id = ?', [nombre, id]);

  if (resultado.affectedRows === 0) {
    responder(res, 404, 'Cobertura no encontrada');
    return;
  }

  const [coberturas] = await pool.query<RowDataPacket[]>('SELECT * FROM cobertura WHERE id = ?', [id]);

  responder(res, 200, 'ok', coberturas[0]);
};

export const eliminarCobertura = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const [usuarios] = await pool.query<RowDataPacket[]>('SELECT id FROM usuario WHERE id_cobertura = ? LIMIT 1', [id]);

  if (usuarios.length > 0) {
    responder(res, 409, 'No se puede eliminar la cobertura porque tiene usuarios asociados');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('DELETE FROM cobertura WHERE id = ?', [id]);

  if (resultado.affectedRows === 0) {
    responder(res, 404, 'Cobertura no encontrada');
    return;
  }

  responder(res, 200, 'ok', null);
};
