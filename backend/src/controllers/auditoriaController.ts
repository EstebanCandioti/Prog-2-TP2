import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { responder } from '../utils/respuesta';

const ENTIDADES_AUDITORIA = ['sede', 'usuario', 'cobertura', 'especialidad'];

const armarFiltrosAuditoria = (req: Request, res: Response): { where: string; valores: unknown[] } | null => {
  const accionFiltro = req.query.accion || req.query.estado;
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (req.query.entidad !== undefined && req.query.entidad !== '') {
    if (typeof req.query.entidad !== 'string' || !ENTIDADES_AUDITORIA.includes(req.query.entidad)) {
      responder(res, 400, 'La entidad debe ser sede, usuario, cobertura o especialidad');
      return null;
    }
    condiciones.push('entidad = ?');
    valores.push(req.query.entidad);
  }

  if (req.query.id_entidad !== undefined) {
    const idEntidad = req.query.id_entidad;
    if (
      typeof idEntidad !== 'string' ||
      !/^[1-9]\d*$/.test(idEntidad) ||
      !Number.isSafeInteger(Number(idEntidad))
    ) {
      responder(res, 400, 'El id_entidad debe ser un entero positivo');
      return null;
    }
    condiciones.push('id_entidad = ?');
    valores.push(Number(idEntidad));
  }

  const filtros = [
    { valor: req.query.id_usuario, condicion: 'id_usuario = ?' },
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
