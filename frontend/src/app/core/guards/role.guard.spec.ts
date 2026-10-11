import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';

import { SessionService } from '../services/session.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const sessionServiceMock = {
    tieneSesion: vi.fn(),
    obtenerUsuario: vi.fn()
  };

  beforeEach(() => {
    vi.resetAllMocks();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: sessionServiceMock }
      ]
    });
  });

  it('permite acceder cuando el usuario tiene un rol permitido', () => {
    sessionServiceMock.tieneSesion.mockReturnValue(true);
    sessionServiceMock.obtenerUsuario.mockReturnValue({
      id: 1,
      rol: 'admin',
      id_sede: null
    });

    const route = { data: { roles: ['admin'] } } as unknown as ActivatedRouteSnapshot;
    const resultado = TestBed.runInInjectionContext(() =>
      roleGuard(route, { url: '/admin' } as RouterStateSnapshot)
    );

    expect(resultado).toBe(true);
  });

  it('redirige cuando el usuario no tiene un rol permitido', () => {
    sessionServiceMock.tieneSesion.mockReturnValue(true);
    sessionServiceMock.obtenerUsuario.mockReturnValue({
      id: 2,
      rol: 'paciente',
      id_sede: null
    });
    const router = TestBed.inject(Router);

    const route = { data: { roles: ['admin'] } } as unknown as ActivatedRouteSnapshot;
    const resultado = TestBed.runInInjectionContext(() =>
      roleGuard(route, { url: '/admin' } as RouterStateSnapshot)
    );

    expect(router.serializeUrl(resultado as UrlTree)).toBe('/acceso-denegado');
  });

  it('redirige al login cuando no existe una sesion', () => {
    sessionServiceMock.tieneSesion.mockReturnValue(false);
    sessionServiceMock.obtenerUsuario.mockReturnValue(null);
    const router = TestBed.inject(Router);

    const route = { data: { roles: ['admin'] } } as unknown as ActivatedRouteSnapshot;
    const resultado = TestBed.runInInjectionContext(() =>
      roleGuard(route, { url: '/admin' } as RouterStateSnapshot)
    );

    expect(router.serializeUrl(resultado as UrlTree)).toBe('/login?returnUrl=%2Fadmin');
  });
});
