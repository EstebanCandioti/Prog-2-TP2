export interface DatosClinicos {
  diagnostico: string;
  tratamiento?: string;
  observaciones?: string;
}

type ResultadoValidacion =
  | { datos: DatosClinicos; error: null }
  | { datos: null; error: string };

const LONGITUD_MAXIMA_CAMPO_CLINICO = 255;

export const validarDatosClinicos = (body: unknown): ResultadoValidacion => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { datos: null, error: 'El cuerpo debe ser un objeto' };
  }

  const { diagnostico, tratamiento, observaciones } = body as Record<string, unknown>;

  if (typeof diagnostico !== 'string') {
    return { datos: null, error: 'El diagnostico es obligatorio y debe ser texto' };
  }
  if (diagnostico.trim().length === 0) {
    return { datos: null, error: 'El diagnostico no puede estar vacio' };
  }
  if (diagnostico.length > LONGITUD_MAXIMA_CAMPO_CLINICO) {
    return { datos: null, error: `El diagnostico no puede superar los ${LONGITUD_MAXIMA_CAMPO_CLINICO} caracteres` };
  }

  for (const [nombre, valor] of [
    ['tratamiento', tratamiento],
    ['observaciones', observaciones]
  ] as const) {
    if (valor !== undefined && typeof valor !== 'string') {
      return { datos: null, error: `${nombre[0].toUpperCase()}${nombre.slice(1)} debe ser texto` };
    }
    if (typeof valor === 'string' && valor.length > LONGITUD_MAXIMA_CAMPO_CLINICO) {
      return {
        datos: null,
        error: `${nombre[0].toUpperCase()}${nombre.slice(1)} no puede superar los ${LONGITUD_MAXIMA_CAMPO_CLINICO} caracteres`
      };
    }
  }

  return {
    datos: {
      diagnostico,
      tratamiento: tratamiento as string | undefined,
      observaciones: observaciones as string | undefined
    },
    error: null
  };
};
