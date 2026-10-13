import { Injectable, signal } from '@angular/core';

import { Sesion, UsuarioAutenticado } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly storageKey = 'clinica_sesion';
  readonly sesionActual = signal<Sesion | null>(this.leerSesion());

  guardarSesion(sesion: Sesion): void {
    localStorage.setItem(this.storageKey, JSON.stringify(sesion));
    this.sesionActual.set(sesion);
  }

  obtenerSesion(): Sesion | null {
    return this.sesionActual();
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
    this.sesionActual.set(null);
  }

  private leerSesion(): Sesion | null {
    const sesionGuardada = localStorage.getItem(this.storageKey);
    if (!sesionGuardada) return null;

    try {
      return JSON.parse(sesionGuardada) as Sesion;
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }
}
