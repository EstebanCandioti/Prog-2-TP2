-- Datos de demostracion B10. Seleccionar primero la base local del proyecto.
-- Requisito: ejecutar npm run seed:demo desde backend para crear las 12 cuentas.
-- No crea ni altera tablas permanentes; no actualiza ni elimina registros existentes.
-- Ejecutar el archivo completo en una sola conexion, deteniendose ante cualquier error.
-- Si ocurre un error antes del COMMIT, ejecutar ROLLBACK y cerrar la conexion.
SET NAMES utf8mb4;

-- Se puede reemplazar CURDATE() por una fecha fija: '2026-10-31'.
-- Usar la misma fecha base al repetir la carga para reproducir los mismos escenarios.
SET @b10_fecha_base = CURDATE();

SET @b10_m1 = (SELECT id FROM usuario WHERE dni = '90000004' AND rol = 'medico');
SET @b10_m2 = (SELECT id FROM usuario WHERE dni = '90000005' AND rol = 'medico');
SET @b10_m3 = (SELECT id FROM usuario WHERE dni = '90000006' AND rol = 'medico');
SET @b10_e1 = (SELECT MIN(id_especialidad) FROM medico_especialidad WHERE id_medico = @b10_m1);
SET @b10_e2 = (SELECT MIN(id_especialidad) FROM medico_especialidad WHERE id_medico = @b10_m2);
SET @b10_e3 = (SELECT MIN(id_especialidad) FROM medico_especialidad WHERE id_medico = @b10_m3);
SET @b10_s1 = (SELECT id_sede FROM usuario WHERE id = @b10_m1);
SET @b10_s2 = (SELECT id_sede FROM usuario WHERE id = @b10_m2);
SET @b10_s3 = (SELECT id_sede FROM usuario WHERE id = @b10_m3);

DROP TEMPORARY TABLE IF EXISTS b10_guard;
DROP TEMPORARY TABLE IF EXISTS b10_dias;
DROP TEMPORARY TABLE IF EXISTS b10_planes;
DROP TEMPORARY TABLE IF EXISTS b10_turnos;

-- La fila 1 actua como asercion: intentar insertarla otra vez detiene la carga.
CREATE TEMPORARY TABLE b10_guard (id INT PRIMARY KEY);
INSERT INTO b10_guard VALUES (1);

SET @b10_cuentas = (
  SELECT COUNT(*) FROM usuario
  WHERE (dni IN ('90000001', '90000002', '90000003') AND rol = 'admin')
     OR (dni IN ('90000004', '90000005', '90000006') AND rol = 'medico')
     OR (dni IN ('90000007', '90000008', '90000009') AND rol = 'operador' AND id_sede IS NOT NULL)
     OR (dni IN ('90000010', '90000011', '90000012') AND rol = 'paciente' AND id_cobertura IS NOT NULL)
);
SET @b10_preparado = @b10_cuentas = 12
  AND @b10_e1 IS NOT NULL AND @b10_e2 IS NOT NULL AND @b10_e3 IS NOT NULL
  AND @b10_e1 <> @b10_e2 AND @b10_e1 <> @b10_e3 AND @b10_e2 <> @b10_e3
  AND @b10_s1 IS NOT NULL AND @b10_s2 IS NOT NULL AND @b10_s3 IS NOT NULL
  AND @b10_s1 <> @b10_s2;
SELECT IF(@b10_preparado, 'OK: cuentas demo preparadas',
  'ERROR: ejecutar npm run seed:demo; se requieren 3 especialidades distintas y 2 sedes') AS requisito;
INSERT INTO b10_guard SELECT 1 WHERE NOT @b10_preparado;

CREATE TEMPORARY TABLE b10_dias (orden INT PRIMARY KEY, fecha DATE NOT NULL);
INSERT INTO b10_dias VALUES
  (0, DATE_SUB(@b10_fecha_base, INTERVAL 2 DAY)),
  (1, @b10_fecha_base),
  (2, DATE_ADD(@b10_fecha_base, INTERVAL 2 DAY)),
  (3, DATE_ADD(@b10_fecha_base, INTERVAL 4 DAY));

CREATE TEMPORARY TABLE b10_planes (
  orden INT PRIMARY KEY,
  id_medico INT NOT NULL,
  id_especialidad INT NOT NULL,
  id_sede INT NOT NULL,
  hora_entrada VARCHAR(5) NOT NULL,
  hora_salida VARCHAR(5) NOT NULL
);
INSERT INTO b10_planes VALUES
  (1, @b10_m1, @b10_e1, @b10_s1, '09:00', '12:00'),
  (2, @b10_m1, @b10_e1, @b10_s2, '14:00', '17:00'),
  (3, @b10_m2, @b10_e2, @b10_s2, '09:00', '12:00'),
  (4, @b10_m3, @b10_e3, @b10_s3, '14:00', '17:00');

START TRANSACTION;

-- No superponer los rangos nuevos con agendas existentes diferentes.
INSERT INTO b10_guard
SELECT 1 FROM b10_planes p CROSS JOIN b10_dias d
JOIN agenda a ON a.id_medico = p.id_medico AND a.fecha = d.fecha
WHERE a.hora_entrada < p.hora_salida AND a.hora_salida > p.hora_entrada
  AND (a.id_especialidad <> p.id_especialidad OR a.id_sede <> p.id_sede
    OR a.hora_entrada <> p.hora_entrada OR a.hora_salida <> p.hora_salida)
LIMIT 1;

-- Si ya hay dos agendas identicas no se puede elegir una de forma segura.
INSERT INTO b10_guard
SELECT 1 FROM (
  SELECT p.orden, d.fecha FROM b10_planes p CROSS JOIN b10_dias d
  JOIN agenda a ON a.id_medico = p.id_medico AND a.id_especialidad = p.id_especialidad
    AND a.id_sede = p.id_sede AND a.fecha = d.fecha
    AND a.hora_entrada = p.hora_entrada AND a.hora_salida = p.hora_salida
  GROUP BY p.orden, d.fecha HAVING COUNT(*) > 1
) repetidas LIMIT 1;

INSERT INTO agenda (hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede)
SELECT p.hora_entrada, p.hora_salida, d.fecha, p.id_medico, p.id_especialidad, p.id_sede
FROM b10_planes p CROSS JOIN b10_dias d
WHERE NOT EXISTS (
  SELECT 1 FROM agenda a WHERE a.id_medico = p.id_medico
    AND a.id_especialidad = p.id_especialidad AND a.id_sede = p.id_sede
    AND a.fecha = d.fecha AND a.hora_entrada = p.hora_entrada AND a.hora_salida = p.hora_salida
);
SET @b10_agendas_creadas = ROW_COUNT();

CREATE TEMPORARY TABLE b10_turnos (
  nota VARCHAR(40) PRIMARY KEY,
  id_agenda INT NOT NULL,
  id_medico INT NOT NULL,
  fecha DATE NOT NULL,
  hora VARCHAR(5) NOT NULL,
  id_paciente INT NOT NULL,
  id_cobertura INT NOT NULL,
  estado VARCHAR(20) NOT NULL
);
INSERT INTO b10_turnos
SELECT CONCAT('B10 ', DATE_FORMAT(d.fecha, '%Y-%m-%d'), ' M', RIGHT(m.dni, 1),
    ' S', p.id_sede, ' ', escenario.estado),
  a.id, p.id_medico, d.fecha,
  TIME_FORMAT(ADDTIME(p.hora_entrada, SEC_TO_TIME(escenario.minutos * 60)), '%H:%i'),
  paciente.id, paciente.id_cobertura, escenario.estado
FROM b10_planes p CROSS JOIN b10_dias d
CROSS JOIN (
  SELECT 'atendido' AS estado, 0 AS minutos, 0 AS paciente_offset
  UNION ALL SELECT 'cancelado', 20, 1
  UNION ALL SELECT 'confirmado', 40, 0
) escenario
JOIN usuario m ON m.id = p.id_medico
JOIN usuario paciente ON paciente.dni = CAST(90000010 + MOD(p.orden - 1
  + IF(d.orden = 0, escenario.paciente_offset, d.orden - 1), 3) AS CHAR)
JOIN agenda a ON a.id_medico = p.id_medico AND a.id_especialidad = p.id_especialidad
  AND a.id_sede = p.id_sede AND a.fecha = d.fecha
  AND a.hora_entrada = p.hora_entrada AND a.hora_salida = p.hora_salida
WHERE (d.orden = 0 AND escenario.estado IN ('atendido', 'cancelado'))
   OR (d.orden > 0 AND escenario.estado = 'confirmado');

-- Preservar los turnos demo si alguien los edito: detenerse, no restaurarlos.
INSERT INTO b10_guard
SELECT 1 FROM b10_turnos b JOIN turno t ON t.nota = b.nota
WHERE t.id_agenda <> b.id_agenda OR NOT (t.fecha <=> b.fecha) OR NOT (t.hora <=> b.hora)
  OR t.id_paciente <> b.id_paciente OR t.id_cobertura <> b.id_cobertura OR t.estado <> b.estado
LIMIT 1;
INSERT INTO b10_guard
SELECT 1 FROM (
  SELECT b.nota FROM b10_turnos b JOIN turno t ON t.nota = b.nota
  GROUP BY b.nota HAVING COUNT(*) > 1
) repetidos LIMIT 1;

-- Comprobar que los turnos nuevos no pisan reservas ni atenciones existentes.
INSERT INTO b10_guard
SELECT 1 FROM b10_turnos b
JOIN agenda a ON a.id_medico = b.id_medico
JOIN turno t ON t.id_agenda = a.id AND t.fecha = b.fecha
WHERE t.estado IN ('confirmado', 'atendido') AND NOT (t.nota <=> b.nota)
  AND TIME_TO_SEC(b.hora) < TIME_TO_SEC(t.hora) + 1200
  AND TIME_TO_SEC(t.hora) < TIME_TO_SEC(b.hora) + 1200
LIMIT 1;

INSERT INTO turno (nota, id_agenda, fecha, hora, id_paciente, id_cobertura, estado)
SELECT b.nota, b.id_agenda, b.fecha, b.hora, b.id_paciente, b.id_cobertura, b.estado
FROM b10_turnos b WHERE NOT EXISTS (SELECT 1 FROM turno t WHERE t.nota = b.nota);
SET @b10_turnos_creados = ROW_COUNT();

INSERT INTO historial_clinico
  (id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones, fecha_registro)
SELECT t.id, b.id_medico, b.id_paciente, 'Control clínico de demostración B10.',
  'Indicaciones ficticias para probar la pantalla.', 'Registro de prueba sin datos clínicos reales.',
  TIMESTAMP(b.fecha, ADDTIME(b.hora, '00:20:00'))
FROM b10_turnos b JOIN turno t ON t.nota = b.nota
WHERE b.estado = 'atendido'
  AND NOT EXISTS (SELECT 1 FROM historial_clinico h WHERE h.id_turno = t.id);
SET @b10_historiales_creados = ROW_COUNT();

INSERT INTO notificacion (id_usuario, tipo, mensaje, leida, fecha)
SELECT b.id_paciente, 'turno_confirmado',
  CONCAT('[B10 T', t.id, '] Tu turno del ', DATE_FORMAT(b.fecha, '%Y-%m-%d'),
    ' a las ', b.hora, ' fue confirmado.'),
  IF(b.fecha < @b10_fecha_base, 1, 0),
  TIMESTAMP(IF(b.fecha < @b10_fecha_base, DATE_SUB(b.fecha, INTERVAL 1 DAY), @b10_fecha_base), '08:00:00')
FROM b10_turnos b JOIN turno t ON t.nota = b.nota
WHERE NOT EXISTS (
  SELECT 1 FROM notificacion n WHERE n.id_usuario = b.id_paciente AND n.tipo = 'turno_confirmado'
    AND n.mensaje = CONCAT('[B10 T', t.id, '] Tu turno del ', DATE_FORMAT(b.fecha, '%Y-%m-%d'),
      ' a las ', b.hora, ' fue confirmado.')
);
SET @b10_notificaciones_creadas = ROW_COUNT();

INSERT INTO notificacion (id_usuario, tipo, mensaje, leida, fecha)
SELECT b.id_paciente, CONCAT('turno_', b.estado),
  CONCAT('[B10 T', t.id, '] Tu turno del ', DATE_FORMAT(b.fecha, '%Y-%m-%d'),
    ' a las ', b.hora, ' fue ', b.estado, '.'),
  IF(b.estado = 'atendido', 1, 0),
  IF(b.estado = 'atendido', TIMESTAMP(b.fecha, ADDTIME(b.hora, '00:20:00')),
    TIMESTAMP(DATE_SUB(b.fecha, INTERVAL 1 DAY), '09:00:00'))
FROM b10_turnos b JOIN turno t ON t.nota = b.nota
WHERE b.estado IN ('atendido', 'cancelado') AND NOT EXISTS (
  SELECT 1 FROM notificacion n WHERE n.id_usuario = b.id_paciente AND n.tipo = CONCAT('turno_', b.estado)
    AND n.mensaje = CONCAT('[B10 T', t.id, '] Tu turno del ', DATE_FORMAT(b.fecha, '%Y-%m-%d'),
      ' a las ', b.hora, ' fue ', b.estado, '.')
);
SET @b10_notificaciones_creadas = @b10_notificaciones_creadas + ROW_COUNT();

COMMIT;

SELECT @b10_fecha_base AS fecha_base, @b10_agendas_creadas AS agendas_creadas,
  @b10_turnos_creados AS turnos_creados, @b10_historiales_creados AS historiales_creados,
  @b10_notificaciones_creadas AS notificaciones_creadas;
SELECT b.estado, COUNT(*) AS cantidad FROM b10_turnos b GROUP BY b.estado;

DROP TEMPORARY TABLE b10_turnos;
DROP TEMPORARY TABLE b10_planes;
DROP TEMPORARY TABLE b10_dias;
DROP TEMPORARY TABLE b10_guard;
