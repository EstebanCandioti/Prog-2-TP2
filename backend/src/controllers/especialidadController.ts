import { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { responder } from '../utils/respuesta';

interface EspecialidadBody {
  descripcion: string;
}

const obtenerIdParam = (req: Request, res: Response): number | null => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    responder(res, 400, 'El id debe ser numerico');
    return null;
  }

  return id;
};

export const listarEspecialidades = async (_req: Request, res: Response): Promise<void> => {
  const [especialidades] = await pool.query<RowDataPacket[]>('SELECT * FROM especialidad ORDER BY descripcion');
  responder(res, 200, 'ok', especialidades);
};

export const obtenerEspecialidadPorId = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const [especialidades] = await pool.query<RowDataPacket[]>('SELECT * FROM especialidad WHERE id = ?', [id]);

  if (especialidades.length === 0) {
    responder(res, 404, 'Especialidad no encontrada');
    return;
  }

  responder(res, 200, 'ok', especialidades[0]);
};

export const crearEspecialidad = async (req: Request, res: Response): Promise<void> => {
  const { descripcion } = req.body as EspecialidadBody;

  if (!descripcion) {
    responder(res, 400, 'La descripcion es obligatoria');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('INSERT INTO especialidad (descripcion) VALUES (?)', [
    descripcion
  ]);

  const [especialidades] = await pool.query<RowDataPacket[]>('SELECT * FROM especialidad WHERE id = ?', [
    resultado.insertId
  ]);

  responder(res, 201, 'ok', especialidades[0]);
};

export const actualizarEspecialidad = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const { descripcion } = req.body as EspecialidadBody;

  if (!descripcion) {
    responder(res, 400, 'La descripcion es obligatoria');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('UPDATE especialidad SET descripcion = ? WHERE id = ?', [
    descripcion,
    id
  ]);

  if (resultado.affectedRows === 0) {
    responder(res, 404, 'Especialidad no encontrada');
    return;
  }

  const [especialidades] = await pool.query<RowDataPacket[]>('SELECT * FROM especialidad WHERE id = ?', [id]);

  responder(res, 200, 'ok', especialidades[0]);
};

export const eliminarEspecialidad = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const [medicosEspecialidad] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM medico_especialidad WHERE id_especialidad = ? LIMIT 1',
    [id]
  );

  if (medicosEspecialidad.length > 0) {
    responder(res, 409, 'No se puede eliminar la especialidad porque tiene medicos asociados');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('DELETE FROM especialidad WHERE id = ?', [id]);

  if (resultado.affectedRows === 0) {
    responder(res, 404, 'Especialidad no encontrada');
    return;
  }

  responder(res, 200, 'ok', null);
};
