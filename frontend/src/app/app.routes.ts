import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./features/home/inicio.component').then((module) => module.InicioComponent),
		pathMatch: 'full',
		title: 'Inicio | Clínica Virtual'
	},
	{
		path: 'login',
		loadComponent: () => import('./features/auth/login/login.component').then((module) => module.LoginComponent),
		title: 'Ingresar | Clínica Virtual'
	},
	{
		path: 'registro',
		loadComponent: () => import('./features/auth/registro/registro.component').then((module) => module.RegistroComponent),
		data: { modo: 'publico' },
		title: 'Registro | Clínica Virtual'
	},
	{
		path: 'perfil',
		loadComponent: () => import('./features/perfil/perfil.component').then((module) => module.PerfilComponent),
		canActivate: [authGuard],
		title: 'Mi perfil | Clínica Virtual'
	},
	{
		path: 'en-construccion',
		loadComponent: () => import('./features/shared/estado-page.component').then((module) => module.EstadoPageComponent),
		canActivate: [authGuard],
		data: { title: 'Notificaciones', description: 'Las notificaciones estarán disponibles próximamente.', icon: 'notifications' },
		title: 'Notificaciones | Clínica Virtual'
	},
	{
		path: 'admin',
		canActivate: [authGuard, roleGuard],
		data: { roles: ['admin'] },
		loadChildren: () => import('./features/admin/admin.routes').then((module) => module.adminRoutes)
	},
	{
		path: 'medico',
		canActivate: [authGuard, roleGuard],
		data: { roles: ['medico'] },
		loadChildren: () => import('./features/medico/medico.routes').then((module) => module.medicoRoutes)
	},
	{
		path: 'operador',
		canActivate: [authGuard, roleGuard],
		data: { roles: ['operador'] },
		loadChildren: () => import('./features/operador/operador.routes').then((module) => module.operadorRoutes)
	},
	{
		path: 'paciente',
		canActivate: [authGuard, roleGuard],
		data: { roles: ['paciente'] },
		loadChildren: () => import('./features/paciente/paciente.routes').then((module) => module.pacienteRoutes)
	},
	{
		path: 'acceso-denegado',
		loadComponent: () => import('./features/shared/estado-page.component').then((module) => module.EstadoPageComponent),
		data: { title: 'Acceso denegado', description: 'Tu cuenta no tiene permiso para entrar en esta sección.', icon: 'gpp_bad' },
		title: 'Acceso denegado | Clínica Virtual'
	},
	{
		path: 'no-encontrada',
		loadComponent: () => import('./features/shared/estado-page.component').then((module) => module.EstadoPageComponent),
		data: { title: 'Página no encontrada', description: 'La dirección que ingresaste no corresponde a una página disponible.', icon: 'search_off' },
		title: 'Página no encontrada | Clínica Virtual'
	},
	{ path: '**', redirectTo: 'no-encontrada' }
];
