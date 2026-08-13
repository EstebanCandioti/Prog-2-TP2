export interface ApiResponse<T = unknown> {
  codigo: number;
  estado: string;
  datos: T | null;
}
