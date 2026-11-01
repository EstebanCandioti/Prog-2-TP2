import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, effect, EffectRef, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, EMPTY, finalize, fromEvent, map, startWith, Subscription, switchMap, timer } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { MarcadoMasivoNotificaciones, Notificacion } from '../models/notificacion.model';
import { mensajeErrorApi } from '../utils/mensaje-error-api';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly url = `${environment.apiUrl}/notificaciones`;
  private readonly datos = signal<Notificacion[]>([]);
  private readonly claveEstado = signal<string | null>(null);
  private readonly cargandoDatos = signal(false);
  private readonly datosCargados = signal(false);
  private readonly errorConsulta = signal('');
  private readonly lecturasPendientes = signal<ReadonlySet<number>>(new Set());
  private readonly erroresLectura = signal<ReadonlyMap<number, string>>(new Map());
  private readonly lecturas = new Map<number, Subscription>();
  private readonly faseMasiva = signal<'inactiva' | 'marcando' | 'sincronizando'>('inactiva');
  private readonly errorLecturaMasiva = signal('');
  private readonly sincronizacionMasivaPendiente = signal(false);
  private solicitudMasiva?: Subscription;
  private seguimiento?: EffectRef;
  private consultaActual?: Subscription;
  private iniciado = false;
  private destruido = false;
  private generacion = 0;
  private versionConsulta = 0;
  private actualizacionProgramada = false;
  private actualizacionPendiente = false;

  // La vista no expone datos de otra sesión, ni siquiera antes de ejecutarse el effect.
  readonly lista = computed<readonly Notificacion[]>(() => this.estadoDeSesionActual() ? this.datos() : []);
  readonly noLeidas = computed(() => this.lista().filter((notificacion) => notificacion.leida === 0).length);
  readonly recientesSinLeer = computed(() => this.lista().filter((notificacion) => notificacion.leida === 0).slice(0, 10));
  readonly cargando = computed(() => this.estadoDeSesionActual() && this.cargandoDatos());
  readonly cargado = computed(() => this.estadoDeSesionActual() && this.datosCargados());
  readonly error = computed(() => this.estadoDeSesionActual() ? this.errorConsulta() : '');
  readonly marcando = computed<ReadonlySet<number>>(() => this.estadoDeSesionActual() ? this.lecturasPendientes() : new Set());
  readonly erroresMarcado = computed<ReadonlyMap<number, string>>(() => this.estadoDeSesionActual() ? this.erroresLectura() : new Map());
  readonly marcandoTodas = computed(() => this.estadoDeSesionActual() && this.faseMasiva() !== 'inactiva');
  readonly sincronizacionPendiente = computed(() => this.estadoDeSesionActual() && this.sincronizacionMasivaPendiente());
  readonly bloqueoMarcado = computed(() => this.marcandoTodas() || this.sincronizacionPendiente());
  readonly puedeMarcarTodas = computed(() => this.cargado() && this.noLeidas() > 0 && !this.bloqueoMarcado() && this.marcando().size === 0);
  readonly errorMasivo = computed(() => this.estadoDeSesionActual() ? this.errorLecturaMasiva() : '');

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destruido = true;
      this.seguimiento?.destroy();
      this.sincronizarSesion(null);
    });
  }

  iniciarSeguimiento(): void {
    if (this.iniciado || this.destruido) return;
    this.iniciado = true;
    this.seguimiento = effect((onCleanup) => {
      const clave = this.claveSesionActual();
      untracked(() => this.sincronizarSesion(clave));
      if (!clave) return;

      const seguimiento = fromEvent(this.document, 'visibilitychange').pipe(
        startWith(null),
        map(() => this.document.visibilityState === 'visible'),
        distinctUntilChanged(),
        switchMap((visible) => visible ? timer(0, 120000) : EMPTY),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => this.actualizar());
      onCleanup(() => seguimiento.unsubscribe());
    }, { injector: this.injector });
  }

  actualizar(): void {
    if (this.destruido) return;
    this.sincronizarSesion(this.claveSesionActual());
    if (!this.claveEstado() || this.document.visibilityState !== 'visible') return;
    if (this.lecturas.size > 0 || this.faseMasiva() === 'marcando') {
      this.actualizacionPendiente = true;
      return;
    }
    if (this.consultaActual || this.actualizacionProgramada) return;

    if (this.sincronizacionMasivaPendiente()) this.faseMasiva.set('sincronizando');
    this.actualizacionProgramada = true;
    this.cargandoDatos.set(true);
    const generacion = this.generacion;
    const versionConsulta = ++this.versionConsulta;
    // Agrupar disparadores coincidentes (campana, entrada a la ruta, visibilidad o intervalo).
    queueMicrotask(() => {
      if (!this.sesionVigente(generacion) || versionConsulta !== this.versionConsulta) return;
      this.actualizacionProgramada = false;
      if (this.document.visibilityState !== 'visible') {
        this.cargandoDatos.set(false);
        return;
      }
      if (this.lecturas.size > 0 || this.faseMasiva() === 'marcando') {
        this.actualizacionPendiente = true;
        this.cargandoDatos.set(false);
        return;
      }
      if (this.consultaActual) return;
      this.consultar(generacion);
    });
  }

  marcarComoLeida(id: number): void {
    if (this.destruido) return;
    this.sincronizarSesion(this.claveSesionActual());
    const usuario = this.session.obtenerUsuario();
    const notificacion = this.lista().find((item) => item.id === id);
    if (!this.claveEstado() || !usuario || this.bloqueoMarcado() || !Number.isSafeInteger(id) || id <= 0 ||
        !notificacion || notificacion.leida === 1 || this.lecturas.has(id)) return;

    const generacion = this.generacion;
    const solicitud = new Subscription();
    this.lecturas.set(id, solicitud);
    this.lecturasPendientes.update((ids) => new Set([...ids, id]));
    this.erroresLectura.update((errores) => {
      const actualizados = new Map(errores);
      actualizados.delete(id);
      return actualizados;
    });

    // No dejar que un GET iniciado antes del PATCH vuelva a mostrar la notificación sin leer.
    if (this.consultaActual || this.actualizacionProgramada) this.actualizacionPendiente = true;
    this.consultaActual?.unsubscribe();
    solicitud.add(this.http.patch<ApiResponse<Notificacion>>(`${this.url}/${id}/leida`, {}).pipe(
      map((respuesta) => {
        const actualizada = respuesta.datos;
        if (!actualizada || !this.notificacionValida(actualizada, usuario.id) || actualizada.id !== id || actualizada.leida !== 1) {
          throw new Error('Respuesta de marcado inválida');
        }
        return actualizada;
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (!this.sesionVigente(generacion) || this.lecturas.get(id) !== solicitud) return;
        this.lecturas.delete(id);
        this.lecturasPendientes.update((ids) => {
          const pendientes = new Set(ids);
          pendientes.delete(id);
          return pendientes;
        });
        if (this.lecturas.size === 0 && this.actualizacionPendiente) {
          this.actualizacionPendiente = false;
          this.actualizar();
        }
      })
    ).subscribe({
      next: (actualizada) => {
        if (!this.sesionVigente(generacion)) return;
        this.datos.update((lista) => this.ordenar(lista.map((item) => item.id === id ? actualizada : item)));
      },
      error: (error: unknown) => {
        if (!this.sesionVigente(generacion)) return;
        this.erroresLectura.update((errores) => new Map(errores).set(
          id, mensajeErrorApi(error, 'No se pudo marcar la notificación como leída. Reintentá la acción.')
        ));
      }
    }));
  }

  marcarTodasComoLeidas(): void {
    if (this.destruido) return;
    this.sincronizarSesion(this.claveSesionActual());
    if (!this.puedeMarcarTodas()) return;

    const generacion = this.generacion;
    const solicitud = new Subscription();
    this.solicitudMasiva = solicitud;
    this.faseMasiva.set('marcando');
    this.errorLecturaMasiva.set('');
    if (this.consultaActual || this.actualizacionProgramada) this.actualizacionPendiente = true;
    this.consultaActual?.unsubscribe();

    // Invalidar también el GET todavía encolado: el PATCH tendrá su propia sincronización.
    this.versionConsulta++;
    this.actualizacionProgramada = false;
    this.cargandoDatos.set(false);

    solicitud.add(this.http.patch<ApiResponse<MarcadoMasivoNotificaciones>>(`${this.url}/leidas`, {}).pipe(
      map((respuesta) => {
        const cantidad = respuesta.datos?.cantidad_actualizada;
        if (typeof cantidad !== 'number' || !Number.isSafeInteger(cantidad) || cantidad < 0) {
          throw new Error('Respuesta de marcado masivo inválida');
        }
        return cantidad;
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (!this.sesionVigente(generacion) || this.solicitudMasiva !== solicitud) return;
        this.solicitudMasiva = undefined;
        if (this.faseMasiva() === 'marcando') {
          this.faseMasiva.set('inactiva');
          if (this.actualizacionPendiente) {
            this.actualizacionPendiente = false;
            this.actualizar();
          }
        }
      })
    ).subscribe({
      next: () => {
        if (!this.sesionVigente(generacion)) return;
        this.sincronizacionMasivaPendiente.set(true);
        this.faseMasiva.set('sincronizando');
        this.actualizacionPendiente = false;
        this.erroresLectura.set(new Map());
        // Este GET confirma el resultado de la escritura incluso si se ocultó la pestaña.
        this.cargandoDatos.set(true);
        this.consultar(generacion);
      },
      error: (error: unknown) => {
        if (!this.sesionVigente(generacion)) return;
        this.errorLecturaMasiva.set(mensajeErrorApi(error, 'No se pudieron marcar todas las notificaciones como leídas. Reintentá la acción.'));
      }
    }));
  }

  private consultar(generacion: number): void {
    const usuario = this.session.obtenerUsuario();
    if (!usuario || !this.sesionVigente(generacion)) return;
    const consulta = new Subscription();
    this.consultaActual = consulta;
    consulta.add(this.http.get<ApiResponse<Notificacion[]>>(this.url).pipe(
      map((respuesta) => {
        if (!Array.isArray(respuesta.datos) || !respuesta.datos.every((item) => this.notificacionValida(item, usuario.id))) {
          throw new Error('Respuesta de notificaciones inválida');
        }
        return this.ordenar(respuesta.datos);
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (!this.sesionVigente(generacion) || this.consultaActual !== consulta) return;
        this.consultaActual = undefined;
        this.cargandoDatos.set(false);
        if (this.faseMasiva() === 'sincronizando') this.faseMasiva.set('inactiva');
      })
    ).subscribe({
      next: (lista) => {
        if (!this.sesionVigente(generacion)) return;
        this.datos.set(lista);
        this.datosCargados.set(true);
        this.errorConsulta.set('');
        this.sincronizacionMasivaPendiente.set(false);
      },
      error: (error: unknown) => {
        if (!this.sesionVigente(generacion)) return;
        // Conservar los datos previos y el seguimiento; los errores se muestran solo en la pantalla.
        const detalle = mensajeErrorApi(error, 'No se pudieron actualizar las notificaciones. Revisá la conexión y reintentá.');
        this.errorConsulta.set(this.sincronizacionMasivaPendiente()
          ? `El marcado de todas como leídas se realizó, pero no se pudo actualizar la lista. Reintentá la consulta. ${detalle}`
          : detalle);
      }
    }));
  }

  private sincronizarSesion(clave: string | null): void {
    if (this.claveEstado() === clave) return;
    this.generacion++;
    this.consultaActual?.unsubscribe();
    this.consultaActual = undefined;
    this.solicitudMasiva?.unsubscribe();
    this.solicitudMasiva = undefined;
    for (const solicitud of this.lecturas.values()) solicitud.unsubscribe();
    this.lecturas.clear();
    this.actualizacionProgramada = false;
    this.actualizacionPendiente = false;
    this.datos.set([]);
    this.cargandoDatos.set(false);
    this.datosCargados.set(false);
    this.errorConsulta.set('');
    this.lecturasPendientes.set(new Set());
    this.erroresLectura.set(new Map());
    this.faseMasiva.set('inactiva');
    this.errorLecturaMasiva.set('');
    this.sincronizacionMasivaPendiente.set(false);
    this.claveEstado.set(clave);
  }

  private claveSesionActual(): string | null {
    const sesion = this.session.sesionActual();
    const id = sesion?.usuario?.id;
    if (!sesion || typeof sesion.token !== 'string' || !sesion.token.trim() || typeof id !== 'number' ||
        !Number.isSafeInteger(id) || id <= 0 || !['admin', 'medico', 'operador', 'paciente'].includes(sesion.usuario.rol)) return null;
    return `${id}:${sesion.usuario.rol}:${sesion.token}`;
  }

  private estadoDeSesionActual(): boolean {
    return this.claveEstado() !== null && this.claveEstado() === this.claveSesionActual();
  }

  private sesionVigente(generacion: number): boolean {
    return !this.destruido && this.generacion === generacion && this.estadoDeSesionActual();
  }

  private notificacionValida(notificacion: Notificacion, idUsuario: number): boolean {
    return !!notificacion && Number.isSafeInteger(notificacion.id) && notificacion.id > 0 &&
      notificacion.id_usuario === idUsuario && (notificacion.leida === 0 || notificacion.leida === 1) &&
      typeof notificacion.tipo === 'string' && typeof notificacion.mensaje === 'string' &&
      typeof notificacion.fecha === 'string' && Number.isFinite(Date.parse(notificacion.fecha));
  }

  private ordenar(lista: Notificacion[]): Notificacion[] {
    return [...lista].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha) || b.id - a.id);
  }
}
