import { Routes } from '@angular/router';

export const pacienteRoutes: Routes = [
	{ path: '', loadComponent: () => import('../home/inicio.component').then((module) => module.InicioComponent), title: 'Área de paciente | Clínica Virtual' },
	{ path: 'turnos', loadComponent: () => import('../shared/estado-page.component').then((module) => module.EstadoPageComponent), data: { title: 'Mis turnos', description: 'La consulta y gestión de turnos estará disponible próximamente.', icon: 'event' } }
];
