export const validarFechaAgenda = (fecha: unknown): string | null => {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return 'La fecha debe tener el formato YYYY-MM-DD';
  }

  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (anio < 1000 || anio > 9999) {
    return 'El año de la fecha debe estar entre 1000 y 9999';
  }
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const diasPorMes = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasPorMes[mes - 1]) {
    return 'La fecha debe corresponder a un día existente';
  }

  return null;
};

export const horaValidaAgenda = (valor: unknown): valor is string => {
  if (typeof valor !== 'string' || !/^\d{2}:\d{2}$/.test(valor)) return false;
  const [horas, minutos] = valor.split(':').map(Number);
  return horas <= 23 && minutos <= 59;
};

export const validarDatosAgenda = (fecha: unknown, horaEntrada: unknown, horaSalida: unknown): string | null => {
  const errorFecha = validarFechaAgenda(fecha);
  if (errorFecha) return errorFecha;
  if (!horaValidaAgenda(horaEntrada)) return 'La hora de entrada debe tener formato HH:mm y ser válida';
  if (!horaValidaAgenda(horaSalida)) return 'La hora de salida debe tener formato HH:mm y ser válida';

  const minutos = (hora: string): number => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
  if (minutos(horaSalida) <= minutos(horaEntrada)) {
    return 'La hora de salida debe ser posterior a la hora de entrada, sin cruzar medianoche';
  }
  return null;
};
