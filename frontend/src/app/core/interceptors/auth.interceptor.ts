import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { SessionService } from '../services/session.service';
import { throwError } from 'rxjs/internal/observable/throwError';
import { catchError } from 'rxjs/internal/operators/catchError';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionService = inject(SessionService);
  const token = sessionService.obtenerToken();
  const router = inject(Router);
  if (!token) {
    return next(request);
  }

  const requestConToken = request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  // Manejo de errores de autenticación, si es 401 mientras hay sesion activa, se cierra la sesión y se redirige al login
  return next(requestConToken).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        sessionService.tieneSesion() &&
        request.url.endsWith('/auth/login') === false &&
        request.url.endsWith('/auth/registro') === false
      ) {
        sessionService.cerrarSesion();
        void router.navigateByUrl('/login');
      }

      return throwError(() => error);
    })
  );
};
