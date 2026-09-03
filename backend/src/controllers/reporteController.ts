import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { responder } from '../utils/respuesta';

const agregarFiltroFechas = (condiciones: string[], valores: unknown[], fechaDesde: unknown, fechaHasta: unknown): void => {
  if (fechaDesde) {
    condiciones.push('turno.fecha >= ?');
    valores.push(fechaDesde);
  }

  if (fechaHasta) {
    condiciones.push('turno.fecha <= ?');
    valores.push(fechaHasta);
  }
};

const armarWhereFechas = (req: Request): { where: string; valores: unknown[] } => {
  const { fecha_desde, fecha_hasta } = req.query;
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  agregarFiltroFechas(condiciones, valores, fecha_desde, fecha_hasta);

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  return { where, valores };
};

export const turnosPorEspecialidad = async (req: Request, res: Response): Promise<void> => {
  const { where, valores } = armarWhereFechas(req);

  const [reporte] = await pool.query<RowDataPacket[]>(
    `SELECT especialidad.id, especialidad.descripcion, COUNT(turno.id) AS cantidad_turnos
     FROM turno
     INNER JOIN agenda ON agenda.id = turno.id_agenda
     INNER JOIN especialidad ON especialidad.id = agenda.id_especialidad
     ${where}
     GROUP BY especialidad.id, especialidad.descripcion
     ORDER BY cantidad_turnos DESC`,
    valores
  );

  responder(res, 200, 'ok', reporte);
};

export const turnosPorSede = async (req: Request, res: Response): Promise<void> => {
  const { where, valores } = armarWhereFechas(req);

  const [reporte] = await pool.query<RowDataPacket[]>(
    `SELECT sede.id, sede.nombre, COUNT(turno.id) AS cantidad_turnos
     FROM turno
     INNER JOIN agenda ON agenda.id = turno.id_agenda
     INNER JOIN sede ON sede.id = agenda.id_sede
     ${where}
     GROUP BY sede.id, sede.nombre
     ORDER BY cantidad_turnos DESC`,
    valores
  );

  responder(res, 200, 'ok', reporte);
};

export const rankingMedicos = async (req: Request, res: Response): Promise<void> => {
  const { where, valores } = armarWhereFechas(req);
  const whereConAtendidos = where ? `${where} AND turno.estado = ?` : 'WHERE turno.estado = ?';

  const [reporte] = await pool.query<RowDataPacket[]>(
    `SELECT medico.id, medico.nombre, medico.apellido, COUNT(turno.id) AS turnos_atendidos
     FROM turno
     INNER JOIN agenda ON agenda.id = turno.id_agenda
     INNER JOIN usuario medico ON medico.id = agenda.id_medico
     ${whereConAtendidos}
     GROUP BY medico.id, medico.nombre, medico.apellido
     ORDER BY turnos_atendidos DESC`,
    [...valores, 'atendido']
  );

  responder(res, 200, 'ok', reporte);
};

export const tasaCancelacion = async (req: Request, res: Response): Promise<void> => {
  const { where, valores } = armarWhereFechas(req);

  const [reporte] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total_turnos,
       SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) AS turnos_cancelados,
       ROUND(SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) * 100 / COUNT(*), 2) AS tasa_cancelacion
     FROM turno
     ${where}`,
    valores
  );

  responder(res, 200, 'ok', reporte[0]);
};
