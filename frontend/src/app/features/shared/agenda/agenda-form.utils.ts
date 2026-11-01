import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { MatDateFormats } from '@angular/material/core';

export const FORMATOS_FECHA_AGENDA: MatDateFormats = {
  parse: { dateInput: null },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'long', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' }
  }
};

// Usar componentes locales de calendario; no convertir a UTC.
export const fechaCalendario = (fecha: Date | null): string | null => {
  if (!(fecha instanceof Date) || !Number.isFinite(fecha.getTime())) return null;
  const anio = fecha.getFullYear();
  if (anio < 1000 || anio > 9999) return null;
  return `${anio}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};

export const leerFechaCalendario = (valor: string): Date | null => {
  // La API puede serializar el DATE de MySQL con una parte horaria.
  const dia = valor.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const [anio, mes, numeroDia] = dia.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, numeroDia);
  return fechaCalendario(fecha) === dia ? fecha : null;
};

export const fechaAgendaValida: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (control.value === null || control.value === '') return null;
  return fechaCalendario(control.value) ? null : { fechaInvalida: true };
};

const minutosHora = (valor: unknown): number | null => {
  if (typeof valor !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return null;
  const [hora, minutos] = valor.split(':').map(Number);
  return hora * 60 + minutos;
};

export const horaAgendaValida: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (!control.value) return null;
  return minutosHora(control.value) !== null ? null : { horaInvalida: true };
};

export const ordenHorasAgenda: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const entrada = minutosHora(control.get('hora_entrada')?.value);
  const salida = minutosHora(control.get('hora_salida')?.value);
  return entrada !== null && salida !== null && salida <= entrada ? { ordenHoras: true } : null;
};

export const opcionDisponible = (opciones: () => ReadonlyArray<{ id: number }>): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    if (control.value === null || control.value === '') return null;
    return opciones().some((opcion) => opcion.id === control.value) ? null : { opcionInvalida: true };
  };
