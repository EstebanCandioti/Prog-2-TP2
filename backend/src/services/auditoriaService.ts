import { pool } from '../config/db';

type AccionAuditoria = 'ALTA' | 'BAJA' | 'MODIFICACION';

export const registrarAuditoria = async (
  id_usuario: number,
  accion: AccionAuditoria,
  entidad: string,
  id_entidad: number | null,
  detalle: string
): Promise<void> => {
  await pool.query(
    'INSERT INTO log_auditoria (id_usuario, accion, entidad, id_entidad, detalle) VALUES (?, ?, ?, ?, ?)',
    [id_usuario, accion, entidad, id_entidad, detalle]
  );
};
