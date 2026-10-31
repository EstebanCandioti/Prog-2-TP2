import { pool } from '../config/db';

type AccionAuditoria = 'ALTA' | 'BAJA' | 'MODIFICACION';

export const registrarAuditoria = async (
  id_usuario: number,
  accion: AccionAuditoria,
  entidad: string,
  id_entidad: number | null,
  detalle: string
): Promise<void> => {
  const sql = 'INSERT INTO log_auditoria (id_usuario, accion, entidad, id_entidad, detalle) VALUES (?, ?, ?, ?, ?)';
  const valores = [id_usuario, accion, entidad, id_entidad, detalle];
  await pool.query(sql, valores);
};
