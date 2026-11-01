import { Routes } from '@angular/router';

export const medicoRoutes: Routes = [
	{ path: '', loadComponent: () => import('../home/inicio.component').then((module) => module.InicioComponent), title: 'Área médica | Clínica Virtual' },
	{ path: 'agenda', loadComponent: () => import('./agenda/agenda-medico.component').then((module) => module.AgendaMedicoComponent), title: 'Mi agenda | Clínica Virtual' },
	{ path: 'turnos', loadComponent: () => import('./turnos/turnos-medico.component').then((module) => module.TurnosMedicoComponent), title: 'Turnos del día | Clínica Virtual' },
	{ path: 'historial', loadComponent: () => import('./historial/historial-medico.component').then((module) => module.HistorialMedicoComponent), title: 'Historial clínico | Clínica Virtual' }
];