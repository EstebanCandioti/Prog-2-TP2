import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';

export const DURACION_TURNO_MINUTOS = 20;

export interface BloqueTurno {
  id_agenda: number;
  hora: string;
}

interface AgendaRango extends RowDataPacket {
  id: number;
  hora_entrada: string;
  hora_salida: string;
}

interface TurnoConfirmado extends RowDataPacket {
  hora: string;
}

const aMinutos = (hora: string): number => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const aHora = (minutos: number): string => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

export const obtenerBloquesTurno = async (
  idMedico: number,
  idEspecialidad: number,
  idSede: number,
  fecha: string
): Promise<{ bloques: BloqueTurno[]; disponibles: BloqueTurno[] }> => {
  const [agendas] = await pool.query<AgendaRango[]>(
    `SELECT id, hora_entrada, hora_salida FROM agenda
     WHERE id_medico = ? AND id_especialidad = ? AND id_sede = ? AND fecha = ?`,
    [idMedico, idEspecialidad, idSede, fecha]
  );
  const [confirmados] = await pool.query<TurnoConfirmado[]>(
    `SELECT turno.hora FROM turno
     INNER JOIN agenda ON agenda.id = turno.id_agenda
     WHERE agenda.id_medico = ? AND turno.fecha = ? AND turno.estado = 'confirmado'`,
    [idMedico, fecha]
  );

  const ocupados = confirmados.map((turno) => aMinutos(turno.hora));
  const bloques: BloqueTurno[] = [];
  const disponibles: BloqueTurno[] = [];

  for (const agenda of agendas) {
    for (let inicio = aMinutos(agenda.hora_entrada); inicio + DURACION_TURNO_MINUTOS <= aMinutos(agenda.hora_salida); inicio += DURACION_TURNO_MINUTOS) {
      const bloque = { id_agenda: agenda.id, hora: aHora(inicio) };
      bloques.push(bloque);
      if (!ocupados.some((ocupado) => inicio < ocupado + DURACION_TURNO_MINUTOS && ocupado < inicio + DURACION_TURNO_MINUTOS)) {
        disponibles.push(bloque);
      }
    }
  }

  const ordenar = (a: BloqueTurno, b: BloqueTurno): number => a.hora.localeCompare(b.hora) || a.id_agenda - b.id_agenda;
  bloques.sort(ordenar);
  disponibles.sort(ordenar);
  return { bloques, disponibles };
};
