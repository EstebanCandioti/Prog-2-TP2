import { Routes } from '@angular/router';

export const operadorRoutes: Routes = [
	{ path: '', loadComponent: () => import('../home/inicio.component').then((module) => module.InicioComponent), title: 'Operaciones | Clínica Virtual' },
	{ path: 'registro', loadComponent: () => import('../auth/registro/registro.component').then((module) => module.RegistroComponent), data: { modo: 'operador' }, title: 'Registrar paciente | Clínica Virtual' },
	{ path: 'agenda', loadComponent: () => import('./agenda/agenda-operador.component').then((module) => module.AgendaOperadorComponent), title: 'Agenda por sede | Clínica Virtual' },
	{ path: 'turnos', loadComponent: () => import('./turnos/turnos-operador.component').then((module) => module.TurnosOperadorComponent), title: 'Turnos | Clínica Virtual' }
];
