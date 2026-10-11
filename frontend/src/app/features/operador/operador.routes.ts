import { Routes } from '@angular/router';

export const operadorRoutes: Routes = [
	{ path: '', loadComponent: () => import('../home/inicio.component').then((module) => module.InicioComponent), title: 'Operaciones | Clínica Virtual' },
	{ path: 'agenda', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Agenda', description: 'La agenda estará disponible próximamente.', icon: 'calendar_month' } },
	{ path: 'turnos', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Turnos', description: 'La gestión de turnos estará disponible próximamente.', icon: 'event' } }
];
