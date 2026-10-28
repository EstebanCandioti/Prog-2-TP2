import bcrypt from 'bcrypt';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { env } from '../config/env';

type DemoRole = 'admin' | 'medico' | 'operador' | 'paciente';

interface IdRow extends RowDataPacket {
  id: number;
}

interface UsuarioExistente extends RowDataPacket {
  id: number;
  dni: string;
  email: string;
}

interface DemoAccount {
  rol: DemoRole;
  numero: number;
  dni: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string;
  fechaNacimiento: string;
}

const DEMO_PASSWORD = 'Demo2026!';
const roles: DemoRole[] = ['admin', 'medico', 'operador', 'paciente'];
const nombresPorRol: Record<DemoRole, string> = {
  admin: 'Administrador',
  medico: 'Médico',
  operador: 'Operador',
  paciente: 'Paciente'
};

const cuentas: DemoAccount[] = roles.flatMap((rol, rolIndex) =>
  Array.from({ length: 3 }, (_, index) => {
    const numero = index + 1;
    const ordinal = rolIndex * 3 + numero;
    return {
      rol,
      numero,
      dni: String(90000000 + ordinal),
      email: `${rol}${numero}@demo.clinica.test`,
      nombre: nombresPorRol[rol],
      apellido: `Demo ${numero}`,
      telefono: String(3000000000 + ordinal),
      fechaNacimiento: rol === 'paciente' ? '2000-01-15' : '1985-01-15'
    };
  })
);

const crearCuentas = async (): Promise<void> => {
  if (!['localhost', '127.0.0.1', '::1'].includes(env.db.host) || process.env.NODE_ENV === 'production') {
    throw new Error('La carga de cuentas demo solo se permite en una base local de desarrollo.');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let [sedes] = await connection.query<IdRow[]>('SELECT id FROM sede ORDER BY id');
    while (sedes.length < 2) {
      await connection.query<ResultSetHeader>(
        'INSERT INTO sede (nombre, direccion, telefono) VALUES (?, ?, ?)',
        [`Sede Demo ${sedes.length + 1}`, `Dirección de prueba ${sedes.length + 1}`, '3000000000']
      );
      [sedes] = await connection.query<IdRow[]>('SELECT id FROM sede ORDER BY id');
    }

    let [coberturas] = await connection.query<IdRow[]>('SELECT id FROM cobertura ORDER BY id');
    if (coberturas.length === 0) {
      await connection.query<ResultSetHeader>('INSERT INTO cobertura (nombre) VALUES (?)', ['Cobertura Demo']);
      [coberturas] = await connection.query<IdRow[]>('SELECT id FROM cobertura ORDER BY id');
    }

    let [especialidades] = await connection.query<IdRow[]>('SELECT id FROM especialidad ORDER BY id');
    for (const descripcion of ['Cardiología Demo', 'Clínica Médica Demo', 'Pediatría Demo']) {
      if (especialidades.length >= 3) break;
      await connection.query<ResultSetHeader>('INSERT INTO especialidad (descripcion) VALUES (?)', [descripcion]);
      [especialidades] = await connection.query<IdRow[]>('SELECT id FROM especialidad ORDER BY id');
    }

    if (sedes.length < 2 || coberturas.length === 0 || especialidades.length < 3) {
      throw new Error('No se pudieron preparar sedes, coberturas y especialidades para las cuentas demo.');
    }

    for (const cuenta of cuentas) {
      const [coincidencias] = await connection.query<UsuarioExistente[]>(
        'SELECT id, dni, email FROM usuario WHERE dni = ? OR email = ?',
        [cuenta.dni, cuenta.email]
      );

      if (
        coincidencias.length > 1 ||
        (coincidencias.length === 1 &&
          (coincidencias[0].dni !== cuenta.dni || coincidencias[0].email !== cuenta.email))
      ) {
        throw new Error(`El DNI o email de la cuenta demo ${cuenta.dni} ya pertenece a otro usuario.`);
      }

      const idSede = cuenta.rol === 'medico' || cuenta.rol === 'operador'
        ? sedes[(cuenta.numero - 1) % 2].id
        : null;
      const idCobertura = cuenta.rol === 'paciente' ? coberturas[0].id : null;
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      let idUsuario: number;

      if (coincidencias.length === 1) {
        idUsuario = coincidencias[0].id;
        await connection.query<ResultSetHeader>(
          `UPDATE usuario
           SET nombre = ?, apellido = ?, fecha_nacimiento = ?, password = ?, rol = ?,
               email = ?, telefono = ?, id_sede = ?, id_cobertura = ?
           WHERE id = ?`,
          [
            cuenta.nombre, cuenta.apellido, cuenta.fechaNacimiento, passwordHash, cuenta.rol,
            cuenta.email, cuenta.telefono, idSede, idCobertura, idUsuario
          ]
        );
      } else {
        const [resultado] = await connection.query<ResultSetHeader>(
          `INSERT INTO usuario
            (nombre, apellido, fecha_nacimiento, password, rol, email, telefono, dni, id_sede, id_cobertura)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cuenta.nombre, cuenta.apellido, cuenta.fechaNacimiento, passwordHash, cuenta.rol,
            cuenta.email, cuenta.telefono, cuenta.dni, idSede, idCobertura
          ]
        );
        idUsuario = resultado.insertId;
      }

      if (cuenta.rol === 'medico') {
        const idEspecialidad = especialidades[cuenta.numero - 1].id;
        const [relaciones] = await connection.query<IdRow[]>(
          'SELECT id FROM medico_especialidad WHERE id_medico = ? AND id_especialidad = ?',
          [idUsuario, idEspecialidad]
        );
        if (relaciones.length === 0) {
          await connection.query<ResultSetHeader>(
            'INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES (?, ?)',
            [idUsuario, idEspecialidad]
          );
        }
      }
    }

    await connection.commit();
    console.log('12 cuentas demo listas: 3 admin, 3 médico, 3 operador y 3 paciente.');
    console.log('DNI: 90000001 a 90000012. Contraseña común: Demo2026!');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

void (async () => {
  try {
    await crearCuentas();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
