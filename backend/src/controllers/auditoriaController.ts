import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { responder } from '../utils/respuesta';

const armarFiltrosAuditoria = (req: Request, res: Response): { where: string; valores: unknown[] } | null => {
  const accionFiltro = req.query.accion || req.query.estado;
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  const filtros = [
    { valor: req.query.id_usuario, condicion: 'id_usuario = ?' },
    { valor: req.query.entidad, condicion: 'entidad = ?' },
    { valor: req.query.fecha_desde, condicion: 'fecha >= ?' },
    { valor: req.query.fecha_hasta, condicion: 'fecha <= ?' }
  ];

  if (accionFiltro) {
    const accionesPermitidas = ['ALTA', 'BAJA', 'MODIFICACION'];

    // Solo se permiten las acciones que realmente se guardan en log_auditoria.
    if (!accionesPermitidas.includes(String(accionFiltro))) {
      responder(res, 400, 'La accion debe ser ALTA, BAJA o MODIFICACION');
      return null;
    }

    condiciones.push('accion = ?');
    valores.push(accionFiltro);
  }

  // Cada filtro recibido agrega una condicion al WHERE y su valor correspondiente al array de parametros.
  for (const filtro of filtros) {
    if (filtro.valor) {
      condiciones.push(filtro.condicion);
      valores.push(filtro.valor);
    }
  }

  // Si no vino ningun filtro, el WHERE queda vacio y se listan todos los logs.
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  return { where, valores };
};

export const listarAuditoria = async (req: Request, res: Response): Promise<void> => {
  const filtros = armarFiltrosAuditoria(req, res);

  if (!filtros) {
    return;
  }

  const [logs] = await pool.query<RowDataPacket[]>(
    `SELECT *
     FROM log_auditoria
     ${filtros.where}
     ORDER BY fecha DESC`,
    filtros.valores
  );

  responder(res, 200, 'ok', logs);
};
