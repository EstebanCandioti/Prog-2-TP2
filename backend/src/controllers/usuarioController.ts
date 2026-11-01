import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { registrarAuditoria } from '../services/auditoriaService';
import { AuthRequest } from '../types/auth';
import { responder } from '../utils/respuesta';

type RolAlta = 'admin' | 'operador' | 'medico';
type RolUsuario = RolAlta | 'paciente';

interface AltaUsuarioBody {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  fecha_nacimiento: string;
  password: string;
  rol: RolAlta;
  id_sede: number | null;
  ids_especialidades: number[];
}

interface EspecialidadRow extends RowDataPacket {
  id: number;
  descripcion: string;
}

interface EdicionUsuarioBody {
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  rol: RolUsuario;
  email: string;
  telefono: string;
  id_sede: number | null;
  id_cobertura: number | null;
  ids_especialidades: number[];
}

const textoObligatorio = (valor: unknown, maximo: number): string | null => {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  return texto.length > 0 && texto.length <= maximo ? texto : null;
};

const idCatalogoValido = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor) && valor > 0 && valor <= 127;

const emailValido = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const telefonoValido = (telefono: string): boolean => /^\d{7,10}$/.test(telefono);
const passwordValida = (valor: unknown): valor is string =>
  typeof valor === 'string' && Boolean(valor.trim()) &&
  Buffer.byteLength(valor, 'utf8') >= 8 && Buffer.byteLength(valor, 'utf8') <= 72;

const fechaNacimientoValida = (valor: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  if (anio < 1000) return false;
  const fecha = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia && fecha <= hoyLocal;
};

const validarAltaUsuario = (entrada: unknown): AltaUsuarioBody | string => {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return 'El cuerpo debe ser un objeto.';
  const body = entrada as Record<string, unknown>;
  const nombre = textoObligatorio(body.nombre, 30);
  const apellido = textoObligatorio(body.apellido, 30);
  const dni = textoObligatorio(body.dni, 8);
  const email = textoObligatorio(body.email, 30);
  const telefono = textoObligatorio(body.telefono, 10);
  const fecha_nacimiento = textoObligatorio(body.fecha_nacimiento, 10);
  const password = body.password;
  const rol = body.rol;

  if (!nombre || !apellido || !dni || !email || !telefono || !fecha_nacimiento) {
    return 'Nombre, apellido, DNI, email, telefono y fecha de nacimiento son obligatorios y deben respetar las longitudes permitidas.';
  }
  if (!/^\d{7,8}$/.test(dni)) return 'El DNI debe tener 7 u 8 digitos.';
  if (!emailValido(email)) return 'El email no tiene un formato valido.';
  if (!telefonoValido(telefono)) return 'El telefono debe tener entre 7 y 10 digitos.';
  if (!fechaNacimientoValida(fecha_nacimiento)) return 'La fecha de nacimiento debe ser valida y no futura (AAAA-MM-DD).';
  if (!passwordValida(password)) {
    return 'La password debe tener entre 8 y 72 bytes y no estar vacia.';
  }
  if (rol !== 'admin' && rol !== 'operador' && rol !== 'medico') return 'El rol debe ser admin, operador o medico.';
  if (body.id_cobertura !== undefined && body.id_cobertura !== null) return 'No se puede asignar cobertura en esta alta.';

  let id_sede: number | null = null;
  if (rol === 'admin') {
    if (body.id_sede !== undefined && body.id_sede !== null) return 'Un admin no puede tener sede asignada.';
  } else {
    const sedeSolicitada = body.id_sede;
    if (!idCatalogoValido(sedeSolicitada)) return 'El operador o medico requiere un id_sede entero positivo valido.';
    id_sede = sedeSolicitada;
  }

  const ids = body.ids_especialidades === undefined ? [] : body.ids_especialidades;
  if (!Array.isArray(ids)) return 'ids_especialidades debe ser un arreglo.';
  if (rol === 'medico') {
    if (ids.length === 0 || ids.length > 127 || !ids.every(idCatalogoValido) || new Set(ids).size !== ids.length) {
      return 'El medico requiere una o mas especialidades con IDs enteros positivos, validos y sin duplicados.';
    }
  } else if (ids.length > 0) {
    return 'Admin y operador no pueden tener especialidades asignadas.';
  }

  return {
    nombre, apellido, dni, email, telefono, fecha_nacimiento,
    password, rol, id_sede, ids_especialidades: ids as number[]
  };
};

const validarEdicionUsuario = (entrada: unknown): EdicionUsuarioBody | string => {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return 'El cuerpo debe ser un objeto.';
  const body = entrada as Record<string, unknown>;
  const nombre = textoObligatorio(body.nombre, 30);
  const apellido = textoObligatorio(body.apellido, 30);
  const email = textoObligatorio(body.email, 30);
  const telefono = textoObligatorio(body.telefono, 10);
  const fecha_nacimiento = textoObligatorio(body.fecha_nacimiento, 10);
  const rol = body.rol;

  if (!nombre || !apellido || !email || !telefono || !fecha_nacimiento) {
    return 'Nombre, apellido, email, telefono y fecha de nacimiento son obligatorios y deben respetar las longitudes permitidas.';
  }
  if (!emailValido(email)) return 'El email no tiene un formato valido.';
  if (!telefonoValido(telefono)) return 'El telefono debe tener entre 7 y 10 digitos.';
  if (!fechaNacimientoValida(fecha_nacimiento)) return 'La fecha de nacimiento debe ser valida y no futura (AAAA-MM-DD).';
  if (rol !== 'admin' && rol !== 'operador' && rol !== 'medico' && rol !== 'paciente') {
    return 'El rol debe ser admin, operador, medico o paciente.';
  }

  let id_sede: number | null = null;
  let id_cobertura: number | null = null;
  if (rol === 'operador' || rol === 'medico') {
    if (!idCatalogoValido(body.id_sede)) return 'El operador o medico requiere un id_sede entero positivo valido.';
    id_sede = body.id_sede;
  } else if (body.id_sede !== undefined && body.id_sede !== null) {
    return 'Admin y paciente no pueden tener sede asignada.';
  }
  if (rol === 'paciente') {
    if (!idCatalogoValido(body.id_cobertura)) return 'El paciente requiere un id_cobertura entero positivo valido.';
    id_cobertura = body.id_cobertura;
  } else if (body.id_cobertura !== undefined && body.id_cobertura !== null) {
    return 'Admin, operador y medico no pueden tener cobertura asignada.';
  }

  const ids = body.ids_especialidades === undefined ? [] : body.ids_especialidades;
  if (!Array.isArray(ids)) return 'ids_especialidades debe ser un arreglo.';
  if (rol === 'medico') {
    if (ids.length === 0 || ids.length > 127 || !ids.every(idCatalogoValido) || new Set(ids).size !== ids.length) {
      return 'El medico requiere una o mas especialidades con IDs enteros positivos, validos y sin duplicados.';
    }
  } else if (ids.length > 0) {
    return 'Admin, operador y paciente no pueden tener especialidades asignadas.';
  }

  return { nombre, apellido, email, telefono, fecha_nacimiento, rol, id_sede, id_cobertura, ids_especialidades: ids as number[] };
};

const usuarioPublicoSelect = `
  id,
  apellido,
  nombre,
  fecha_nacimiento,
  rol,
  email,
  telefono,
  dni,
  id_sede,
  id_cobertura
`;

const limiteListado = 20;

const enteroPositivoQuery = (valor: unknown): number | null => {
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return null;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
};

const paginaQuery = (valor: unknown): { pagina: number; offset: number } | null => {
  const pagina = valor === undefined ? 1 : enteroPositivoQuery(valor);
  if (pagina === null) return null;
  const offset = (pagina - 1) * limiteListado;
  return Number.isSafeInteger(offset) ? { pagina, offset } : null;
};

const agregarBusqueda = (condiciones: string[], valores: Array<string | number>, busqueda: string): void => {
  if (!busqueda) return;
  condiciones.push("(u.nombre LIKE ? OR u.apellido LIKE ? OR CONCAT(u.nombre, ' ', u.apellido) LIKE ?)");
  const patron = `%${busqueda}%`;
  valores.push(patron, patron, patron);
};

const obtenerIdParam = (req: Request, res: Response): number | null => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    responder(res, 400, 'El id debe ser numerico');
    return null;
  }

  return id;
};

export const listarUsuarios = async (req: Request, res: Response): Promise<void> => {
  const { busqueda, rol, id_sede } = req.query;
  if ((busqueda !== undefined && typeof busqueda !== 'string') ||
      (rol !== undefined && typeof rol !== 'string') ||
      (id_sede !== undefined && typeof id_sede !== 'string')) {
    responder(res, 400, 'Los filtros deben ser valores de texto simples');
    return;
  }
  const paginacion = paginaQuery(req.query.pagina);
  if (!paginacion) {
    responder(res, 400, 'pagina debe ser un entero positivo seguro');
    return;
  }
  if (rol !== undefined && rol !== 'admin' && rol !== 'operador' && rol !== 'medico' && rol !== 'paciente') {
    responder(res, 400, 'rol debe ser admin, operador, medico o paciente');
    return;
  }
  const sede = id_sede === undefined ? undefined : enteroPositivoQuery(id_sede);
  if (sede === null) {
    responder(res, 400, 'id_sede debe ser un entero positivo seguro');
    return;
  }

  const condiciones: string[] = [];
  const valores: Array<string | number> = [];
  agregarBusqueda(condiciones, valores, busqueda?.trim() ?? '');
  if (rol !== undefined) {
    condiciones.push('u.rol = ?');
    valores.push(rol);
  }
  if (sede !== undefined) {
    condiciones.push('u.id_sede = ?');
    valores.push(sede);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [totales] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM usuario u ${where}`, valores);
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT ${usuarioPublicoSelect} FROM usuario u ${where} ORDER BY u.apellido ASC, u.nombre ASC, u.id ASC LIMIT ? OFFSET ?`,
    [...valores, limiteListado, paginacion.offset]
  );
  responder(res, 200, 'ok', { items, total: Number(totales[0].total), pagina: paginacion.pagina, limite: limiteListado });
};

export const listarPacientes = async (req: Request, res: Response): Promise<void> => {
  const { busqueda, dni } = req.query;
  if ((busqueda !== undefined && typeof busqueda !== 'string') ||
      (dni !== undefined && typeof dni !== 'string')) {
    responder(res, 400, 'Los filtros deben ser valores de texto simples');
    return;
  }
  const paginacion = paginaQuery(req.query.pagina);
  if (!paginacion) {
    responder(res, 400, 'pagina debe ser un entero positivo seguro');
    return;
  }
  const dniBuscado = dni?.trim() ?? '';
  if (dniBuscado && !/^\d{7,8}$/.test(dniBuscado)) {
    responder(res, 400, 'dni debe tener 7 u 8 digitos');
    return;
  }

  const condiciones = ['u.rol = ?'];
  const valores: Array<string | number> = ['paciente'];
  agregarBusqueda(condiciones, valores, busqueda?.trim() ?? '');
  if (dniBuscado) {
    condiciones.push('u.dni = ?');
    valores.push(dniBuscado);
  }
  const where = `WHERE ${condiciones.join(' AND ')}`;
  const [totales] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM usuario u ${where}`, valores);
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.nombre, u.apellido, u.dni, u.fecha_nacimiento, u.id_cobertura,
      c.nombre AS cobertura_nombre
     FROM usuario u LEFT JOIN cobertura c ON c.id = u.id_cobertura
     ${where} ORDER BY u.apellido ASC, u.nombre ASC, u.id ASC LIMIT ? OFFSET ?`,
    [...valores, limiteListado, paginacion.offset]
  );
  responder(res, 200, 'ok', { items, total: Number(totales[0].total), pagina: paginacion.pagina, limite: limiteListado });
};

export const crearUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.usuario) {
    responder(res, 401, 'Token no verificado');
    return;
  }

  const validacion = validarAltaUsuario(req.body);
  if (typeof validacion === 'string') {
    responder(res, 400, validacion);
    return;
  }

  const hash = await bcrypt.hash(validacion.password, 10);
  const administradorId = req.usuario.id;
  let altaCreada: { id: number; usuario: RowDataPacket; especialidades: { id: number; descripcion: string }[] } | undefined;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [duplicados] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM usuario WHERE dni = ? OR email = ? LIMIT 1',
      [validacion.dni, validacion.email]
    );
    if (duplicados.length > 0) {
      await connection.rollback();
      responder(res, 409, 'El DNI o email ya se encuentra registrado');
      return;
    }

    if (validacion.id_sede !== null) {
      const [sedes] = await connection.query<RowDataPacket[]>('SELECT id FROM sede WHERE id = ? LIMIT 1', [validacion.id_sede]);
      if (sedes.length === 0) {
        await connection.rollback();
        responder(res, 400, 'La sede indicada no existe');
        return;
      }
    }

    let especialidades: EspecialidadRow[] = [];
    if (validacion.rol === 'medico') {
      const placeholders = validacion.ids_especialidades.map(() => '?').join(', ');
      const [filas] = await connection.query<EspecialidadRow[]>(
        `SELECT id, descripcion FROM especialidad WHERE id IN (${placeholders})`,
        validacion.ids_especialidades
      );
      if (filas.length !== validacion.ids_especialidades.length) {
        await connection.rollback();
        responder(res, 400, 'Una o mas especialidades indicadas no existen');
        return;
      }
      const porId = new Map(filas.map((especialidad) => [especialidad.id, especialidad]));
      especialidades = validacion.ids_especialidades.map((id) => porId.get(id)!);
    }

    const [resultado] = await connection.query<ResultSetHeader>(
      `INSERT INTO usuario
        (nombre, apellido, dni, email, telefono, password, fecha_nacimiento, id_cobertura, id_sede, rol)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [validacion.nombre, validacion.apellido, validacion.dni, validacion.email, validacion.telefono, hash, validacion.fecha_nacimiento, validacion.id_sede, validacion.rol]
    );

    for (const especialidad of especialidades) {
      await connection.query(
        'INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES (?, ?)',
        [resultado.insertId, especialidad.id]
      );
    }

    const [usuarios] = await connection.query<RowDataPacket[]>(
      `SELECT ${usuarioPublicoSelect} FROM usuario WHERE id = ? LIMIT 1`,
      [resultado.insertId]
    );
    if (usuarios.length !== 1) throw new Error('No se pudo recuperar el usuario creado');
    await connection.commit();
    altaCreada = {
      id: resultado.insertId,
      usuario: usuarios[0],
      especialidades: especialidades.map(({ id, descripcion }) => ({ id, descripcion }))
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (!altaCreada) throw new Error('No se pudo recuperar el usuario creado');
  await registrarAuditoria(administradorId, 'ALTA', 'usuario', altaCreada.id, `Alta del usuario ${altaCreada.id}`);
  responder(res, 201, 'ok', { ...altaCreada.usuario, especialidades: altaCreada.especialidades });
};

export const obtenerUsuarioPorId = async (req: Request, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  const [usuarios] = await pool.query<RowDataPacket[]>(`SELECT ${usuarioPublicoSelect} FROM usuario WHERE id = ?`, [id]);

  if (usuarios.length === 0) {
    responder(res, 404, 'Usuario no encontrado');
    return;
  }

  const usuario = usuarios[0];
  let especialidades: EspecialidadRow[] = [];
  if (usuario.rol === 'medico') {
    [especialidades] = await pool.query<EspecialidadRow[]>(
      `SELECT DISTINCT especialidad.id, especialidad.descripcion
       FROM medico_especialidad
       INNER JOIN especialidad ON especialidad.id = medico_especialidad.id_especialidad
       WHERE medico_especialidad.id_medico = ?
       ORDER BY especialidad.id`,
      [id]
    );
  }

  responder(res, 200, 'ok', { ...usuario, especialidades });
};

export const actualizarUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  if (!req.usuario) {
    responder(res, 401, 'Token no verificado');
    return;
  }

  const validacion = validarEdicionUsuario(req.body);
  if (typeof validacion === 'string') {
    responder(res, 400, validacion);
    return;
  }
  const administradorId = req.usuario.id;
  let usuarioActualizado: RowDataPacket | undefined;
  let especialidadesActualizadas: { id: number; descripcion: string }[] = [];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [usuariosActuales] = await connection.query<RowDataPacket[]>(
      'SELECT id, rol FROM usuario WHERE id = ? LIMIT 1 FOR UPDATE', [id]
    );
    if (usuariosActuales.length === 0) {
      await connection.rollback();
      responder(res, 404, 'Usuario no encontrado');
      return;
    }

    if (usuariosActuales[0].rol !== validacion.rol) {
      const asociaciones = [
        { tabla: 'medico_especialidad', columna: 'id_medico', mensaje: 'Tiene especialidades médicas asignadas' },
        { tabla: 'agenda', columna: 'id_medico', mensaje: 'Tiene agendas propias' },
        { tabla: 'historial_clinico', columna: 'id_medico', mensaje: 'Figura como médico en historiales clínicos' },
        { tabla: 'turno', columna: 'id_paciente', mensaje: 'Tiene turnos como paciente' },
        { tabla: 'historial_clinico', columna: 'id_paciente', mensaje: 'Figura como paciente en historiales clínicos' }
      ];
      for (const asociacion of asociaciones) {
        const [filas] = await connection.query<RowDataPacket[]>(
          `SELECT 1 FROM ${asociacion.tabla} WHERE ${asociacion.columna} = ? LIMIT 1 FOR UPDATE`, [id]
        );
        if (filas.length > 0) {
          await connection.rollback();
          responder(res, 409, `No se puede cambiar el rol: ${asociacion.mensaje}.`);
          return;
        }
      }
    }

    const [usuariosDuplicados] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM usuario WHERE email = ? AND id <> ? LIMIT 1', [validacion.email, id]
    );
    if (usuariosDuplicados.length > 0) {
      await connection.rollback();
      responder(res, 409, 'El email ya se encuentra registrado');
      return;
    }

    if (validacion.id_sede !== null) {
      const [sedes] = await connection.query<RowDataPacket[]>('SELECT id FROM sede WHERE id = ? LIMIT 1', [validacion.id_sede]);
      if (sedes.length === 0) {
        await connection.rollback();
        responder(res, 400, 'La sede indicada no existe');
        return;
      }
    }
    if (validacion.id_cobertura !== null) {
      const [coberturas] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM cobertura WHERE id = ? LIMIT 1', [validacion.id_cobertura]
      );
      if (coberturas.length === 0) {
        await connection.rollback();
        responder(res, 400, 'La cobertura indicada no existe');
        return;
      }
    }

    let especialidades: EspecialidadRow[] = [];
    if (validacion.rol === 'medico') {
      const placeholders = validacion.ids_especialidades.map(() => '?').join(', ');
      const [filas] = await connection.query<EspecialidadRow[]>(
        `SELECT id, descripcion FROM especialidad WHERE id IN (${placeholders})`, validacion.ids_especialidades
      );
      if (filas.length !== validacion.ids_especialidades.length) {
        await connection.rollback();
        responder(res, 400, 'Una o mas especialidades indicadas no existen');
        return;
      }
      const porId = new Map(filas.map((especialidad) => [especialidad.id, especialidad]));
      especialidades = validacion.ids_especialidades.map((especialidadId) => porId.get(especialidadId)!);
    }

    const [asignaciones] = await connection.query<RowDataPacket[]>(
      'SELECT id_especialidad FROM medico_especialidad WHERE id_medico = ? FOR UPDATE', [id]
    );
    const actuales = new Set<number>(asignaciones.map((fila) => fila.id_especialidad));
    const solicitadas = new Set(validacion.ids_especialidades);
    const quitar = [...actuales].filter((especialidadId) => !solicitadas.has(especialidadId));
    const agregar = validacion.ids_especialidades.filter((especialidadId) => !actuales.has(especialidadId));

    for (const especialidadId of quitar) {
      const [agendas] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM agenda WHERE id_medico = ? AND id_especialidad = ? LIMIT 1 FOR UPDATE', [id, especialidadId]
      );
      if (agendas.length > 0) {
        await connection.rollback();
        responder(res, 409, `No se puede quitar la especialidad ${especialidadId}: está utilizada en agendas del médico.`);
        return;
      }
    }

    await connection.query(
      `UPDATE usuario SET nombre = ?, apellido = ?, fecha_nacimiento = ?, rol = ?, email = ?, telefono = ?, id_sede = ?, id_cobertura = ? WHERE id = ?`,
      [validacion.nombre, validacion.apellido, validacion.fecha_nacimiento, validacion.rol,
        validacion.email, validacion.telefono, validacion.id_sede, validacion.id_cobertura, id]
    );
    for (const especialidadId of quitar) {
      await connection.query('DELETE FROM medico_especialidad WHERE id_medico = ? AND id_especialidad = ?', [id, especialidadId]);
    }
    for (const especialidadId of agregar) {
      await connection.query('INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES (?, ?)', [id, especialidadId]);
    }

    const [usuarios] = await connection.query<RowDataPacket[]>(
      `SELECT ${usuarioPublicoSelect} FROM usuario WHERE id = ? LIMIT 1`, [id]
    );
    if (usuarios.length !== 1) throw new Error('No se pudo recuperar el usuario actualizado');
    await connection.commit();
    usuarioActualizado = usuarios[0];
    especialidadesActualizadas = especialidades.map(({ id: especialidadId, descripcion }) => ({ id: especialidadId, descripcion }));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (!usuarioActualizado) throw new Error('No se pudo recuperar el usuario actualizado');
  await registrarAuditoria(administradorId, 'MODIFICACION', 'usuario', id, `Modificacion del usuario ${id}`);
  responder(res, 200, 'ok', { ...usuarioActualizado, especialidades: especialidadesActualizadas });
};

export const actualizarMiPerfil = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.usuario) {
    responder(res, 401, 'Token no verificado');
    return;
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    responder(res, 400, 'El cuerpo debe ser un objeto');
    return;
  }

  const body = req.body as Record<string, unknown>;
  const campos = Object.keys(body);
  const permitidos = ['email', 'telefono', 'password', 'id_cobertura'];
  if (campos.length === 0 || campos.some((campo) => !permitidos.includes(campo))) {
    responder(res, 400, 'Debe enviar al menos un campo permitido: email, telefono, password o id_cobertura');
    return;
  }

  const columnas: string[] = [];
  const valores: Array<string | number> = [];
  let email: string | undefined;
  let idCobertura: number | undefined;

  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    const emailValidado = textoObligatorio(body.email, 30);
    if (!emailValidado || !emailValido(emailValidado)) {
      responder(res, 400, 'El email debe tener un formato valido y hasta 30 caracteres');
      return;
    }
    email = emailValidado;
    columnas.push('email = ?');
    valores.push(email);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'telefono')) {
    const telefono = textoObligatorio(body.telefono, 10);
    if (!telefono || !telefonoValido(telefono)) {
      responder(res, 400, 'El telefono debe tener entre 7 y 10 digitos');
      return;
    }
    columnas.push('telefono = ?');
    valores.push(telefono);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'password')) {
    if (!passwordValida(body.password)) {
      responder(res, 400, 'La password debe tener entre 8 y 72 bytes y no estar vacia');
      return;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'id_cobertura')) {
    if (!idCatalogoValido(body.id_cobertura)) {
      responder(res, 400, 'id_cobertura debe ser un ID entero positivo valido');
      return;
    }
    idCobertura = body.id_cobertura;
    columnas.push('id_cobertura = ?');
    valores.push(idCobertura);
  }

  const idPaciente = req.usuario.id;
  if (email !== undefined) {
    const [duplicados] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM usuario WHERE email = ? AND id <> ? LIMIT 1', [email, idPaciente]
    );
    if (duplicados.length > 0) {
      responder(res, 409, 'El email ya se encuentra registrado');
      return;
    }
  }
  if (idCobertura !== undefined) {
    const [coberturas] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM cobertura WHERE id = ? LIMIT 1', [idCobertura]
    );
    if (coberturas.length === 0) {
      responder(res, 400, 'La cobertura indicada no existe');
      return;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'password')) {
    const hash = await bcrypt.hash(body.password as string, 10);
    columnas.push('password = ?');
    valores.push(hash);
  }

  await pool.query<ResultSetHeader>(
    `UPDATE usuario SET ${columnas.join(', ')} WHERE id = ? AND rol = 'paciente'`,
    [...valores, idPaciente]
  );
  const [usuarios] = await pool.query<RowDataPacket[]>(
    `SELECT ${usuarioPublicoSelect} FROM usuario WHERE id = ? AND rol = 'paciente' LIMIT 1`, [idPaciente]
  );
  if (usuarios.length === 0) {
    responder(res, 401, 'Usuario del token no encontrado');
    return;
  }

  await registrarAuditoria(idPaciente, 'MODIFICACION', 'usuario', idPaciente, `Modificacion del perfil propio del usuario ${idPaciente}`);
  responder(res, 200, 'ok', usuarios[0]);
};

export const eliminarUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = obtenerIdParam(req, res);

  if (id === null) {
    return;
  }

  if (!req.usuario) {
    responder(res, 401, 'Token no verificado');
    return;
  }

  const [resultado] = await pool.query<ResultSetHeader>('DELETE FROM usuario WHERE id = ?', [id]);

  if (resultado.affectedRows === 0) {
    responder(res, 404, 'Usuario no encontrado');
    return;
  }

  await registrarAuditoria(req.usuario.id, 'BAJA', 'usuario', id, `Baja del usuario ${id}`);

  responder(res, 200, 'ok', null);
};
