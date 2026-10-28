import { RolUsuario } from '../models/usuario.model';

export interface NavigationItem {
  label: string;
  path: string;
  icon: string;
}

export const navigationByRole: Record<RolUsuario, NavigationItem[]> = {
  admin: [
    { label: 'Usuarios', path: '/admin/usuarios', icon: 'group' },
    { label: 'Coberturas', path: '/admin/coberturas', icon: 'health_and_safety' },
    { label: 'Reportes', path: '/admin/reportes', icon: 'analytics' },
    { label: 'Auditoría', path: '/admin/auditoria', icon: 'fact_check' }
  ],
  medico: [
    { label: 'Agenda', path: '/medico/agenda', icon: 'calendar_month' },
    { label: 'Turnos', path: '/medico/turnos', icon: 'event' },
    { label: 'Historial clínico', path: '/medico/historial', icon: 'description' }
  ],
  operador: [
    { label: 'Registrar paciente', path: '/operador/registro', icon: 'person_add' },
    { label: 'Agenda', path: '/operador/agenda', icon: 'calendar_month' },
    { label: 'Turnos', path: '/operador/turnos', icon: 'event' }
  ],
  paciente: [
    { label: 'Mis turnos', path: '/paciente/turnos', icon: 'event' },
    { label: 'Mi perfil', path: '/perfil', icon: 'account_circle' }
  ]
};
