# Colecciones de Postman

Las colecciones reflejan el contrato actual del backend. Los ejemplos por fase se conservan como documentación; los runners ejecutan escenarios ordenados y verifican sus respuestas.

| Archivo | Uso |
| --- | --- |
| `coleccion-fase-01.json` a `coleccion-fase-04.json` | Ejemplos manuales de cada entrega; algunos requieren configurar IDs existentes. |
| `coleccion-fase-01-runner.json` a `coleccion-fase-04-runner.json` | Flujos de registro, autenticación, CRUD, reservas, atención, historial, notificaciones, auditoría y reportes. |
| `coleccion-contrato-actual-runner.json` | Regresión ampliada: permisos de las 54 rutas, B01–B11, F09, validaciones, privacidad, paginación y coherencia de datos. Requiere los fixtures del verificador. |
| `verificar-colecciones.cjs` | Prepara bases temporales independientes y ejecuta los cinco runners con Newman. |
| [COBERTURA.md](COBERTURA.md) | Matriz de rutas, escenarios cubiertos, resultado de la ejecución y limitaciones conocidas. |

## Ejecutar toda la regresión en Windows

Desde `backend/`, con las dependencias instaladas, MySQL encendido y `.env` configurado:

```powershell
npm.cmd run build
npm.cmd exec --yes --package=newman@6.2.1 -- node postman/verificar-colecciones.cjs
```

Newman se obtiene de la caché de npm: no se agrega a `package.json`, al lockfile ni al `node_modules` del proyecto. El usuario MySQL de `.env` necesita poder consultar la estructura y crear/eliminar las bases temporales.

El verificador:

1. Valida los nueve JSON y la sintaxis de todos sus scripts. Compara los runners con las rutas actuales para detectar endpoints sin casos.
2. Lee **solo la estructura** de la base configurada en `DB_NAME`; no copia sus datos ni ejecuta el seed habitual.
3. Crea una base `codex_postman_<marca_temporal>_<n>` para cada runner, con cuentas y datos controlados. Los escenarios ampliados incluyen más de 20 pacientes/turnos, dos sedes, agendas, historiales y más de 10 notificaciones pendientes.
4. Inicia una instancia temporal de la API en un puerto libre, sin usar ni detener el servidor habitual del puerto 3000.
5. Ejecuta Newman y muestra requests, aserciones y fallos por colección. Devuelve código de salida 1 si hay fallos.
6. Detiene esa instancia y elimina su base temporal en `finally`, también si falla una prueba. La base habitual, su esquema y sus datos permanecen intactos. Un cierre forzado del proceso o la caída de MySQL puede impedir esa limpieza.

Opcionalmente, guardar el resumen de la ejecución, sin tokens ni contraseñas:

```powershell
$env:POSTMAN_REPORT = Join-Path $env:TEMP 'resultado-postman.json'
npm.cmd exec --yes --package=newman@6.2.1 -- node postman/verificar-colecciones.cjs
```

No es necesario cargar `seed-b10.sql`, iniciar el frontend ni cambiar `.env` para esta verificación.

## Usar Postman manualmente

Importar un runner, seleccionar **Run** y ejecutar sus requests en orden. Los runners por fase crean registros y conservan algunos por sus asociaciones; usarlos sobre una base de pruebas.

Las fases 02–04 usan variables `admin_dni`, `medico_dni`, `operador_dni`, `paciente_dni` y sus respectivas `*_password`. Los valores iniciales son las cuentas demo de `seed:demo`, con contraseña `Demo2026!`. Los logins guardan tokens, IDs de usuario y la sede del operador; configurar `id_especialidad` si el médico elegido tiene otra. La fase 01 registra su propio paciente y conserva su flujo independiente.

Las colecciones documentales no son una secuencia automática: sus fechas e IDs son ejemplos y las carpetas de errores necesitan datos con las asociaciones indicadas. El runner de contrato actual usa IDs conocidos, JWT de prueba y fechas preparados por el verificador; importarlo solo no prepara esos datos. Para la regresión completa, usar el comando anterior.

## Contratos comprobados

- Respuesta uniforme: `{ codigo, estado, datos }`, con `codigo` igual al estado HTTP. En un error, `estado` contiene el mensaje.
- Catálogos: `GET /coberturas-disponibles` es público. Los listados generales requieren cualquier rol autenticado. Obtener por ID y escribir requiere admin.
- B01: `GET /medicos` admite los cuatro roles, no pagina y solo devuelve `id`, `nombre`, `apellido`, `especialidades`. Sus filtros son `id_especialidad` e `id_sede`; la sede selecciona agendas, no la sede principal del médico. La combinación exige una agenda de esa especialidad en esa sede.
- B02: alta y edición administrativas por `/usuarios`, relaciones según rol, duplicados, especialidades y cambios de rol con asociaciones. `GET /usuarios/:id` incluye las especialidades médicas asignadas y devuelve `[]` para otros roles; se comprueba que editar otros datos preserve las asignaciones. El rol y la sede usados para autorizar provienen de la base, incluso con un JWT anterior.
- B03: `/usuarios` para admin y `/pacientes` para admin, médico u operador; ambos devuelven `{ items, total, pagina, limite }`, con límite fijo 20. Búsqueda por nombre, apellido o nombre completo; DNI exacto en pacientes y rol/sede en usuarios.
- B04: `PATCH /usuarios/mi-perfil` solo para pacientes, con campos parciales `email`, `telefono`, `password`, `id_cobertura`. Conserva lo omitido y rechaza campos ajenos al contrato.
- B05: médico gestiona agendas propias en distintas sedes; operador consulta cualquier sede y escribe solo en la propia. Se validan fechas, horas `HH:mm`, especialidad asignada y protección de agendas con turnos.
- B06: bloques completos de 20 minutos, disponibilidad y reserva coherentes, rechazo de bloque ocupado, liberación al cancelar y paciente tomado del token. No se prueba exclusión mutua entre reservas simultáneas: quedó postergada.
- B07: `/turnos/medico` y `/turnos/sede` requieren fecha; devuelven arreglos y datos identificatorios del paciente, sin historial clínico. Respetan médico/sede y filtros acordados.
- B08: atender incluye datos clínicos y crea el historial; repetir el alta de ese historial devuelve `409`. `POST /historial-clinico` sigue disponible para atendidos sin historial. Fase 03 corregida: `16:20`, cuerpo clínico al atender y `409` al intentar duplicarlo.
- B09: eliminación de especialidad/cobertura con dependencias devuelve `409`, incluidas agendas y turnos históricos.
- B10: las pruebas generan fixtures propios; no evalúan ni modifican el seed de demostración.
- B11: `tipo=proximos|todos`, página de 20 y valores por defecto; Todos incluye próximos. Historial por turno exclusivo del paciente dueño, con `400`, `403`, `404` y `409` según el caso.
- F09: notificaciones propias, marcado individual y `PATCH /notificaciones/leidas`, con `{ cantidad_actualizada }`. Se comprueba repetición con 0 y conservación de pendientes ajenas.
- Auditoría y reportes: permisos admin, filtros y formas de respuesta actuales; totales por sede/especialidad y tasa de cancelación coherentes con los turnos de la base de prueba. `id_entidad` no es un filtro del endpoint de auditoría: el frontend lo aplica localmente.

## Alcance de los resultados

Las pruebas cubren las rutas y los principales contratos positivos/negativos acordados. No prueban todas las combinaciones posibles de entradas ni reemplazan la verificación visual del frontend. La matriz detalla lo ejecutado y lo pendiente.

**Limitación detectada:** `DELETE /usuarios/:id` con asociaciones devuelve actualmente `500` porque ese controlador no traduce el error de clave foránea a `409`. La regresión tiene un caso identificado como `LIMITACION actual` que registra ese comportamiento; que pase no significa que el problema esté corregido. El método de eliminación no se modificó.
