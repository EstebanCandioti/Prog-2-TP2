import { Routes } from '@angular/router';

export const medicoRoutes: Routes = [
	{ path: '', loadComponent: () => import('../home/inicio.component').then((module) => module.InicioComponent), title: 'Área médica | Clínica Virtual' },
	{ path: 'agenda', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Agenda', description: 'La agenda médica estará disponible próximamente.', icon: 'calendar_month' } },
	{ path: 'turnos', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Turnos', description: 'La gestión de turnos estará disponible próximamente.', icon: 'event' } },
	{ path: 'historial', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Historial clínico', description: 'El historial clínico estará disponible próximamente.', icon: 'description' } }
];
