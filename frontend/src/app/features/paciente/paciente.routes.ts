import { Routes } from '@angular/router';

export const pacienteRoutes: Routes = [
	{ path: '', loadComponent: () => import('../home/inicio.component').then((module) => module.InicioComponent), title: 'Área de paciente | Clínica Virtual' },
	{ path: 'turnos', loadComponent: () => import('./turnos/mis-turnos.component').then((module) => module.MisTurnosComponent), title: 'Mis turnos | Clínica Virtual' }
];
