import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
	{ path: '', loadComponent: () => import('../home/inicio.component').then((module) => module.InicioComponent), title: 'Administración | Clínica Virtual' },
	{ path: 'usuarios', loadComponent: () => import('./usuarios/usuarios.component').then((module) => module.UsuariosComponent), title: 'Usuarios | Clínica Virtual' },
	{ path: 'sedes', loadComponent: () => import('./sedes/sedes.component').then((module) => module.SedesComponent), title: 'Sedes | Clínica Virtual' },
	{ path: 'especialidades', loadComponent: () => import('./especialidades/especialidades.component').then((module) => module.EspecialidadesComponent), title: 'Especialidades | Clínica Virtual' },
	{ path: 'coberturas', loadComponent: () => import('./coberturas/coberturas.component').then((module) => module.CoberturasComponent), title: 'Coberturas | Clínica Virtual' },
	{ path: 'reportes', loadComponent: () => import('./reportes/reportes.component').then((module) => module.ReportesComponent), title: 'Reportes | Clínica Virtual' },
	{ path: 'auditoria', loadComponent: () => import('./auditoria/auditoria.component').then((module) => module.AuditoriaComponent), title: 'Auditoría | Clínica Virtual' }
];
