import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
	{ path: '', loadComponent: () => import('../home/inicio.component').then((module) => module.InicioComponent), title: 'Administración | Clínica Virtual' },
	{ path: 'usuarios', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Usuarios', description: 'La administración de usuarios estará disponible próximamente.', icon: 'group' } },
	{ path: 'coberturas', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Coberturas', description: 'La gestión de coberturas estará disponible próximamente.', icon: 'health_and_safety' } },
	{ path: 'reportes', loadComponent: () => import('./reportes/reportes.component').then((module) => module.ReportesComponent), title: 'Reportes | Clínica Virtual' },
	{ path: 'auditoria', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Auditoría', description: 'La auditoría estará disponible próximamente.', icon: 'fact_check' } }
];
