import { Routes } from '@angular/router';

export const medicoRoutes: Routes = [
	{ path: '', loadComponent: () => import('../home/inicio.component').then((module) => module.InicioComponent), title: 'Área médica | Clínica Virtual' },
	{ path: 'agenda', loadComponent: () => import('./agenda/mi-agenda.component').then((module) => module.MiAgendaComponent), title: 'Mi agenda | Clínica Virtual' },
	{ path: 'turnos', loadComponent: () => import('./turnos/turnos-programados.component').then((module) => module.TurnosProgramadosComponent), title: 'Turnos programados | Clínica Virtual' },
	{ path: 'historial', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Historial clínico', description: 'El historial clínico estará disponible próximamente.', icon: 'description' } }
];
