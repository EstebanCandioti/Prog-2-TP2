import { ApiResponse } from './api-response.model';

export type NumeroApi = number | string;

export interface ReporteEspecialidadApi {
  id: NumeroApi;
  descripcion: string;
  cantidad_turnos: NumeroApi;
}

export interface ReporteSedeApi {
  id: NumeroApi;
  nombre: string;
  cantidad_turnos: NumeroApi;
}

export interface RankingMedicoApi {
  id: NumeroApi;
  nombre: string;
  apellido: string;
  turnos_atendidos: NumeroApi;
}

export interface TasaCancelacionApi {
  total_turnos: NumeroApi;
  turnos_cancelados: NumeroApi;
  tasa_cancelacion: NumeroApi;
}

export interface FiltroReportes {
  fechaDesde: string | null;
  fechaHasta: string | null;
}

export interface RespuestasReportes {
  especialidades: ApiResponse<ReporteEspecialidadApi[]>;
  sedes: ApiResponse<ReporteSedeApi[]>;
  ranking: ApiResponse<RankingMedicoApi[]>;
  tasaCancelacion: ApiResponse<TasaCancelacionApi>;
}

export interface CantidadPorNombre {
  id: number;
  nombre: string;
  cantidad: number;
}

export interface RankingMedico {
  id: number;
  nombreCompleto: string;
  turnosAtendidos: number;
}

export interface DashboardReportes {
  total: number;
  confirmados: number;
  atendidos: number;
  cancelados: number;
  finalizados: number;
  tasaCancelacion: number;
  especialidades: CantidadPorNombre[];
  sedes: CantidadPorNombre[];
  ranking: RankingMedico[];
}
