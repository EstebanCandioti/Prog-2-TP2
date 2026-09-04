import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { responder } from '../utils/respuesta';

const armarFiltrosReportes = (req: Request, incluirEstado = true): { where: string; valores: unknown[] } => {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  const filtros = [
    { valor: req.query.fecha_desde, condicion: 'turno.fecha >= ?' },
    { valor: req.query.fecha_hasta, condicion: 'turno.fecha <= ?' },
    { valor: incluirEstado ? req.query.estado : null, condicion: 'turno.estado = ?' },
    { valor: req.query.id_sede, condicion: 'agenda.id_sede = ?' },
    { valor: req.query.id_especialidad, condicion: 'agenda.id_especialidad = ?' },
    { valor: req.query.id_medico, condicion: 'agenda.id_medico = ?' }
  ];

  for (const filtro of filtros) {
    if (filtro.valor) {
      condiciones.push(filtro.condicion);
      valores.push(filtro.valor);
    }
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  return { where, valores };
};

export const turnosPorEspecialidad = async (req: Request, res: Response): Promise<void> => {
  const { where, valores } = armarFiltrosReportes(req);

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
  const { where, valores } = armarFiltrosReportes(req);

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
  const { where, valores } = armarFiltrosReportes(req, false);
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
  const { where, valores } = armarFiltrosReportes(req, false);

  const [reporte] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total_turnos,
       COALESCE(SUM(CASE WHEN turno.estado = 'cancelado' THEN 1 ELSE 0 END), 0) AS turnos_cancelados,
       CASE
         WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(SUM(CASE WHEN turno.estado = 'cancelado' THEN 1 ELSE 0 END) * 100 / COUNT(*), 2)
       END AS tasa_cancelacion
     FROM turno
     INNER JOIN agenda ON agenda.id = turno.id_agenda
     ${where}`,
    valores
  );

  responder(res, 200, 'ok', reporte[0]);
};
