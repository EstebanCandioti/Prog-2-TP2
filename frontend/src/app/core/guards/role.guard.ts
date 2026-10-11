import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { RolUsuario } from '../models/usuario.model';
import { SessionService } from '../services/session.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const usuario = sessionService.obtenerUsuario();

  if (!sessionService.tieneSesion() || !usuario) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  const rolesPermitidos = route.data['roles'] as RolUsuario[] | undefined;

  if (rolesPermitidos?.includes(usuario.rol)) {
    return true;
  }

  return router.createUrlTree(['/acceso-denegado']);
};
