import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';

import { SessionService } from '../services/session.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const sessionServiceMock = {
    tieneSesion: vi.fn()
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

  it('permite acceder cuando existe una sesion', () => {
    sessionServiceMock.tieneSesion.mockReturnValue(true);

    const resultado = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot)
    );

    expect(resultado).toBe(true);
  });

  it('redirige al login cuando no existe una sesion', () => {
    sessionServiceMock.tieneSesion.mockReturnValue(false);
    const router = TestBed.inject(Router);

    const resultado = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot)
    );

    expect(router.serializeUrl(resultado as UrlTree)).toBe('/login?returnUrl=%2Fadmin');
  });
});
