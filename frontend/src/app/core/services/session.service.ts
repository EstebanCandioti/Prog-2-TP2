import { Injectable } from '@angular/core';

import { Sesion, UsuarioAutenticado } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly storageKey = 'clinica_sesion';

  guardarSesion(sesion: Sesion): void {
    localStorage.setItem(this.storageKey, JSON.stringify(sesion));
  }

  obtenerSesion(): Sesion | null {
    const sesionGuardada = localStorage.getItem(this.storageKey);

    if (!sesionGuardada) {
      return null;
    }

    try {
      return JSON.parse(sesionGuardada) as Sesion;
    } catch {
      this.cerrarSesion();
      return null;
    }
  }

  obtenerToken(): string | null {
    return this.obtenerSesion()?.token ?? null;
  }

  obtenerUsuario(): UsuarioAutenticado | null {
    return this.obtenerSesion()?.usuario ?? null;
  }

  tieneSesion(): boolean {
    return this.obtenerToken() !== null;
  }

  cerrarSesion(): void {
    localStorage.removeItem(this.storageKey);
  }
}
