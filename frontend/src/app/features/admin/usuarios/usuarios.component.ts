import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ApiResponse } from '../../../core/models/api-response.model';
import { Cobertura } from '../../../core/models/cobertura.model';
import { Especialidad } from '../../../core/models/especialidad.model';
import {
  ActualizarUsuarioAdmin,
  CrearUsuarioAdmin,
  ListadoUsuarios,
  UsuarioAdmin
} from '../../../core/models/usuario-admin.model';
import { RolUsuario } from '../../../core/models/usuario.model';
import { CoberturaService } from '../../../core/services/cobertura.service';
import { EspecialidadService } from '../../../core/services/especialidad.service';
import { SedeService } from '../../../core/services/sede.service';
import { UsuarioAdminService } from '../../../core/services/usuario-admin.service';
import { mensajeErrorApi } from '../../../core/utils/mensaje-error-api';
import { Sede } from '../../../core/models/sede.model';
import { ConfirmacionDialogComponent } from '../../shared/confirmacion-dialog.component';

const TAMANO_PAGINA = 20;
const ROLES: Array<{ valor: RolUsuario; nombre: string }> = [
  { valor: 'admin', nombre: 'Administrador' },
  { valor: 'operador', nombre: 'Operador' },
  { valor: 'medico', nombre: 'Médico' },
  { valor: 'paciente', nombre: 'Paciente' }
];
const ROLES_DE_ALTA: Array<{ valor: Exclude<RolUsuario, 'paciente'>; nombre: string }> = [
  { valor: 'admin', nombre: 'Administrador' },
  { valor: 'operador', nombre: 'Operador' },
  { valor: 'medico', nombre: 'Médico' }
];

const fechaNacimientoValida = (valor: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return (
    anio >= 1000 &&
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia &&
    fecha <= hoyLocal
  );
};

const validarFechaNacimiento = (control: { value: unknown }) =>
  typeof control.value === 'string' && fechaNacimientoValida(control.value)
    ? null
    : { fechaNacimiento: true };

const validarEspecialidades = (control: { value: unknown }) =>
  Array.isArray(control.value) && control.value.length > 0 ? null : { required: true };

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSelectModule,
    MatTableModule,
    MatSnackBarModule,
    ReactiveFormsModule
  ],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css'
})
export class UsuariosComponent implements OnInit {
  private readonly usuariosApi = inject(UsuarioAdminService);
  private readonly sedesApi = inject(SedeService);
  private readonly especialidadesApi = inject(EspecialidadService);
  private readonly coberturasApi = inject(CoberturaService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly usuarios = signal<UsuarioAdmin[]>([]);
  readonly sedes = signal<Sede[]>([]);
  readonly especialidades = signal<Especialidad[]>([]);
  readonly coberturas = signal<Cobertura[]>([]);
  readonly roles = ROLES;
  readonly rolesDeAlta = ROLES_DE_ALTA;
  readonly cargando = signal(true);
  readonly cargandoCatalogos = signal(true);
  readonly cargandoDetalleId = signal<number | null>(null);
  readonly eliminandoId = signal<number | null>(null);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly errorCatalogos = signal('');
  readonly formularioVisible = signal(false);
  readonly usuarioEnEdicion = signal<UsuarioAdmin | null>(null);
  readonly pagina = signal(1);
  readonly totalUsuarios = signal(0);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.totalUsuarios() / TAMANO_PAGINA)));
  readonly fechaMaxima = new Date().toISOString().slice(0, 10);
  readonly columnas = ['usuario', 'dni', 'email', 'rol', 'asignacion', 'acciones'];

  readonly filtros = this.formBuilder.nonNullable.group({
    busqueda: [''],
    rol: this.formBuilder.nonNullable.control<RolUsuario | ''>(''),
    idSede: this.formBuilder.control<number | null>(null)
  });

  readonly formulario = this.formBuilder.group({
    nombre: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(30)
    ]),
    apellido: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(30)
    ]),
    dni: this.formBuilder.nonNullable.control('', [Validators.required, Validators.pattern(/^\d{7,8}$/)]),
    fechaNacimiento: this.formBuilder.nonNullable.control('', [
      Validators.required,
      validarFechaNacimiento
    ]),
    email: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.email,
      Validators.maxLength(30)
    ]),
    telefono: this.formBuilder.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^\d{7,10}$/)
    ]),
    rol: this.formBuilder.nonNullable.control<RolUsuario>('operador', Validators.required),
    idSede: this.formBuilder.control<number | null>(null),
    idCobertura: this.formBuilder.control<number | null>(null),
    idsEspecialidades: this.formBuilder.nonNullable.control<number[]>([]),
    password: this.formBuilder.nonNullable.control('')
  });

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarUsuarios();
  }

  filtrarBusqueda(event: Event): void {
    const input = event.target as HTMLInputElement;
    const busqueda = input.value.replace(/[^\p{L}\p{M} '\u2019-]/gu, '');
    if (input.value !== busqueda) {
      input.value = busqueda;
      this.filtros.controls.busqueda.setValue(busqueda);
    }
  }

  cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);
    this.errorCatalogos.set('');
    forkJoin({
      sedes: this.sedesApi.listar(),
      especialidades: this.especialidadesApi.listar(),
      coberturas: this.coberturasApi.listar()
    }).subscribe({
      next: ({ sedes, especialidades, coberturas }) => {
        if (!sedes.datos || !especialidades.datos || !coberturas.datos) {
          this.errorCatalogos.set('La respuesta del servidor no contiene todos los catálogos.');
        } else {
          this.sedes.set(sedes.datos);
          this.especialidades.set(especialidades.datos);
          this.coberturas.set(coberturas.datos);
        }
        this.cargandoCatalogos.set(false);
      },
      error: (error: unknown) => {
        this.errorCatalogos.set(
          mensajeErrorApi(error, 'No se pudieron cargar sedes, especialidades y coberturas.')
        );
        this.cargandoCatalogos.set(false);
      }
    });
  }

  cargarUsuarios(): void {
    this.cargando.set(true);
    this.error.set('');
    const valores = this.filtros.getRawValue();
    const idSede = valores.idSede;
    this.usuariosApi
      .listar({
        busqueda: valores.busqueda.trim() || undefined,
        rol: valores.rol || undefined,
        idSede: idSede ?? undefined,
        pagina: this.pagina()
      })
      .subscribe({
        next: (respuesta: ApiResponse<ListadoUsuarios>) => {
          if (!respuesta.datos || !Array.isArray(respuesta.datos.items)) {
            this.error.set('La respuesta del servidor no contiene el listado de usuarios.');
            this.cargando.set(false);
            return;
          }
          this.usuarios.set(respuesta.datos.items);
          this.totalUsuarios.set(respuesta.datos.total);
          this.pagina.set(respuesta.datos.pagina);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeErrorApi(error, 'No se pudieron cargar los usuarios.'));
          this.cargando.set(false);
        }
      });
  }

  aplicarFiltros(): void {
    this.pagina.set(1);
    this.cargarUsuarios();
  }

  limpiarFiltros(): void {
    this.filtros.reset({ busqueda: '', rol: '', idSede: null });
    this.aplicarFiltros();
  }

  paginaAnterior(): void {
    if (this.pagina() <= 1) return;
    this.pagina.update((pagina) => pagina - 1);
    this.cargarUsuarios();
  }

  paginaSiguiente(): void {
    if (this.pagina() >= this.totalPaginas()) return;
    this.pagina.update((pagina) => pagina + 1);
    this.cargarUsuarios();
  }

  nuevoUsuario(): void {
    this.usuarioEnEdicion.set(null);
    this.formulario.reset({
      nombre: '',
      apellido: '',
      dni: '',
      fechaNacimiento: '',
      email: '',
      telefono: '',
      rol: 'operador',
      idSede: null,
      idCobertura: null,
      idsEspecialidades: [],
      password: ''
    });
    this.configurarValidadores('alta');
    this.formularioVisible.set(true);
  }

  editarUsuario(usuario: UsuarioAdmin): void {
    this.cargandoDetalleId.set(usuario.id);
    this.usuariosApi.obtener(usuario.id).subscribe({
      next: (respuesta) => {
        if (!respuesta.datos) {
          this.snackBar.open('La respuesta del servidor no contiene el usuario solicitado.', 'Cerrar', {
            duration: 5000
          });
          this.cargandoDetalleId.set(null);
          return;
        }
        const detalle = respuesta.datos;
        this.usuarioEnEdicion.set(detalle);
        this.formulario.reset({
          nombre: detalle.nombre,
          apellido: detalle.apellido,
          dni: detalle.dni,
          fechaNacimiento: detalle.fecha_nacimiento.slice(0, 10),
          email: detalle.email,
          telefono: detalle.telefono,
          rol: detalle.rol,
          idSede: detalle.id_sede,
          idCobertura: detalle.id_cobertura,
          idsEspecialidades: detalle.especialidades.map((especialidad) => especialidad.id),
          password: ''
        });
        this.configurarValidadores('edicion');
        this.formularioVisible.set(true);
        this.cargandoDetalleId.set(null);
      },
      error: (error: unknown) => {
        this.cargandoDetalleId.set(null);
        this.snackBar.open(mensajeErrorApi(error, 'No se pudo cargar el usuario.'), 'Cerrar', {
          duration: 5000
        });
      }
    });
  }

  eliminarUsuario(usuario: UsuarioAdmin): void {
    if (this.eliminandoId() !== null || this.formularioVisible()) return;

    this.dialog.open<ConfirmacionDialogComponent, { titulo: string; mensaje: string }, boolean>(
      ConfirmacionDialogComponent,
      {
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
        data: {
          titulo: 'Eliminar usuario',
          mensaje: `¿Está seguro de eliminar al usuario "${usuario.nombre} ${usuario.apellido}"?`
        }
      }
    ).afterClosed().subscribe((confirmada) => {
      if (!confirmada) return;
      this.eliminandoId.set(usuario.id);
      this.usuariosApi.eliminar(usuario.id).subscribe({
        next: () => {
          this.eliminandoId.set(null);
          this.snackBar.open('Usuario eliminado correctamente.', 'Cerrar', { duration: 3500 });
          if (this.usuarios().length === 1 && this.pagina() > 1) {
            this.pagina.update((pagina) => pagina - 1);
          }
          this.cargarUsuarios();
        },
        error: (error: unknown) => {
          this.eliminandoId.set(null);
          this.snackBar.open(mensajeErrorApi(error, 'No se pudo eliminar el usuario.'), 'Cerrar', {
            duration: 6000
          });
        }
      });
    });
  }

  cancelarFormulario(): void {
    this.formularioVisible.set(false);
    this.usuarioEnEdicion.set(null);
    this.formulario.reset();
  }

  cambiarRol(): void {
    this.configurarValidadores(this.usuarioEnEdicion() ? 'edicion' : 'alta');
  }

  guardarUsuario(): void {
    if (this.formulario.invalid || this.guardando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();
    const rol = valores.rol;
    const usuarioActual = this.usuarioEnEdicion();
    this.guardando.set(true);

    if (usuarioActual) {
      const datos: ActualizarUsuarioAdmin = {
        nombre: valores.nombre.trim(),
        apellido: valores.apellido.trim(),
        fecha_nacimiento: valores.fechaNacimiento,
        rol,
        email: valores.email.trim(),
        telefono: valores.telefono.trim(),
        id_sede: rol === 'operador' || rol === 'medico' ? valores.idSede : null,
        id_cobertura: rol === 'paciente' ? valores.idCobertura : null,
        ids_especialidades: rol === 'medico' ? valores.idsEspecialidades : []
      };
      this.usuariosApi.actualizar(usuarioActual.id, datos).subscribe({
        next: () => this.finalizarGuardado('Usuario actualizado correctamente.'),
        error: (error: unknown) => this.errorGuardado(error, 'No se pudo actualizar el usuario.')
      });
      return;
    }

    if (rol === 'paciente') {
      this.guardando.set(false);
      return;
    }
    const datos: CrearUsuarioAdmin = {
      nombre: valores.nombre.trim(),
      apellido: valores.apellido.trim(),
      dni: valores.dni.trim(),
      email: valores.email.trim(),
      telefono: valores.telefono.trim(),
      fecha_nacimiento: valores.fechaNacimiento,
      password: valores.password,
      rol,
      id_sede: rol === 'operador' || rol === 'medico' ? valores.idSede : null,
      id_cobertura: null,
      ids_especialidades: rol === 'medico' ? valores.idsEspecialidades : []
    };
    this.usuariosApi.crear(datos).subscribe({
      next: () => this.finalizarGuardado('Usuario creado correctamente.'),
      error: (error: unknown) => this.errorGuardado(error, 'No se pudo crear el usuario.')
    });
  }

  nombreSede(id: number | null): string {
    if (id === null) return '—';
    return this.sedes().find((sede) => sede.id === id)?.nombre ?? `Sede ${id}`;
  }

  nombreCobertura(id: number | null): string {
    if (id === null) return '—';
    return this.coberturas().find((cobertura) => cobertura.id === id)?.nombre ?? `Cobertura ${id}`;
  }

  nombreRol(rol: RolUsuario): string {
    return this.roles.find((opcion) => opcion.valor === rol)?.nombre ?? rol;
  }

  private configurarValidadores(modo: 'alta' | 'edicion'): void {
    const rol = this.formulario.controls.rol.value;
    const requiereSede = rol === 'operador' || rol === 'medico';
    const requiereCobertura = rol === 'paciente';
    const requiereEspecialidades = rol === 'medico';

    this.formulario.controls.idSede.setValidators(requiereSede ? Validators.required : []);
    this.formulario.controls.idCobertura.setValidators(requiereCobertura ? Validators.required : []);
    this.formulario.controls.idsEspecialidades.setValidators(
      requiereEspecialidades ? validarEspecialidades : []
    );
    this.formulario.controls.password.setValidators(
      modo === 'alta'
        ? [Validators.required, Validators.minLength(8), Validators.maxLength(72)]
        : []
    );
    this.formulario.controls.dni.setValidators(
      modo === 'alta' ? [Validators.required, Validators.pattern(/^\d{7,8}$/)] : []
    );
    for (const control of [
      this.formulario.controls.idSede,
      this.formulario.controls.idCobertura,
      this.formulario.controls.idsEspecialidades,
      this.formulario.controls.password,
      this.formulario.controls.dni
    ]) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private finalizarGuardado(mensaje: string): void {
    this.guardando.set(false);
    this.cancelarFormulario();
    this.snackBar.open(mensaje, 'Cerrar', { duration: 3500 });
    this.cargarUsuarios();
  }

  private errorGuardado(error: unknown, fallback: string): void {
    this.guardando.set(false);
    this.snackBar.open(mensajeErrorApi(error, fallback), 'Cerrar', { duration: 6000 });
  }
}
