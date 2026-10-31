# TP2 Prog 2 - Backend Semana 1

Backend inicial para el Sistema de Gestion de Turnos Medicos con Node.js, Express, TypeScript, MySQL/MariaDB, bcrypt y JWT.

## Setup

1. Instalar dependencias:

```bash
npm install
```

2. Copiar `.env.example` a `.env` y ajustar credenciales si tu MySQL usa otra clave o usuario:

```bash
cp .env.example .env
```

3. Importar el script SQL provisto por la catedra. En este proyecto quedo pegado en `src/database/README.md`; si lo queres importar desde phpMyAdmin, podes copiar ese contenido a un `.sql`.

4. Levantar en desarrollo:

```bash
npm run dev
```

## Scripts

- `npm run dev`: levanta Express con recarga automatica.
- `npm run build`: compila TypeScript a `dist/`.
- `npm start`: ejecuta el build compilado.
- `npm run seed:demo`: compila el backend y crea o actualiza 12 cuentas de prueba en la base local.

## Cuentas de prueba

Con la base local configurada en `.env`, ejecutar `npm run seed:demo` desde `backend/`.
El comando crea tres cuentas por rol y se puede repetir sin duplicarlas. La contraseña común es `Demo2026!`.

| Rol | DNI |
| --- | --- |
| Administrador | 90000001, 90000002, 90000003 |
| Médico | 90000004, 90000005, 90000006 |
| Operador | 90000007, 90000008, 90000009 |
| Paciente | 90000010, 90000011, 90000012 |

La pantalla de ingreso muestra estas cuentas y permite completar el formulario con cada una.

## Endpoints

- `GET /health`
- `GET /coberturas`
- `POST /auth/registro`
- `POST /auth/login`
- `GET /auth/perfil`
- `GET /auth/perfil-paciente` para probar `verificarRol('paciente')`
- `GET /auth/perfil-admin` para probar error `403` con token de paciente

### Permisos de catálogos

| Rutas | Acceso |
| --- | --- |
| `GET /coberturas-disponibles` | Público; se usa durante el registro |
| `GET /sedes`, `GET /especialidades`, `GET /coberturas` | Cualquier usuario autenticado |
| `GET /sedes/:id`, `GET /especialidades/:id`, `GET /coberturas/:id` | Solo administrador |
| `POST`, `PUT` y `DELETE` de sedes, especialidades y coberturas | Solo administrador |

Las rutas autenticadas requieren token. Las consultas por ID y las operaciones de escritura también verifican el rol administrador.

### Alta administrativa de usuarios (B02)

`POST /usuarios` requiere `Authorization: Bearer <token>` de administrador y JSON. Crea solo `admin`, `operador` o `medico`; los pacientes se registran por `POST /auth/registro`. Campos comunes obligatorios: `nombre` y `apellido` (hasta 30 caracteres), `dni` (7 u 8 dígitos), `email` (hasta 30 caracteres y formato válido), `telefono` (7 a 10 dígitos), `fecha_nacimiento` (`AAAA-MM-DD`, no futura), `password` (8 a 72 bytes) y `rol`. No se admite una cobertura no nula.

Ejemplos de cuerpos (usar DNI y email no registrados):

```jsonl
{"nombre":"Ana","apellido":"Admin","dni":"90100001","email":"ana.admin@ejemplo.com","telefono":"3424000001","fecha_nacimiento":"1985-03-10","password":"Demo2026!","rol":"admin","id_cobertura":null}
{"nombre":"Olga","apellido":"Operadora","dni":"90100002","email":"olga.operador@ejemplo.com","telefono":"3424000002","fecha_nacimiento":"1990-05-20","password":"Demo2026!","rol":"operador","id_sede":1,"ids_especialidades":[]}
{"nombre":"Mario","apellido":"Medico","dni":"90100003","email":"mario.medico@ejemplo.com","telefono":"3424000003","fecha_nacimiento":"1988-07-15","password":"Demo2026!","rol":"medico","id_sede":1,"ids_especialidades":[1]}
```

El administrador no puede tener sede ni especialidades. Operador y médico requieren una sede existente; el médico requiere una o más especialidades existentes, con IDs enteros positivos y sin repetir. Para admin y operador, `ids_especialidades` puede omitirse o enviarse como `[]`. La respuesta `201` usa el formato uniforme y `datos` contiene `id`, nombre, apellido, DNI, email, teléfono, fecha de nacimiento, rol, `id_sede`, `id_cobertura: null` y `especialidades: [{ id, descripcion }]` (arreglo vacío para admin y operador). Nunca incluye la password ni un token. Errores principales: `400` por datos o relaciones inválidas, `401` sin token, `403` con rol no administrador y `409` por DNI o email ya registrados. El alta y las relaciones médicas se guardan en una misma transacción. La auditoría se registra después del commit y de liberar la conexión; si falla, el alta permanece guardada aunque la petición devuelva un error.

### Edición administrativa de usuarios (B02)

`PUT /usuarios/:id` requiere token de administrador. El cuerpo completo incluye `nombre`, `apellido` (texto no vacío, hasta 30 caracteres), `fecha_nacimiento` (`AAAA-MM-DD` válida y no futura), `rol` (`admin`, `operador`, `medico` o `paciente`), `email` (formato válido, hasta 30 caracteres), `telefono` (7 a 10 dígitos), `id_sede`, `id_cobertura` e `ids_especialidades`. No edita DNI ni contraseña. La sede y cobertura deben existir cuando corresponden; para los demás roles pueden omitirse o enviarse como `null`. Las especialidades pueden omitirse o enviarse como `[]` para roles no médicos; para médico se exige al menos un ID entero positivo, existente y sin repetir.

Ejemplos de edición (reemplazar `:id` y usar relaciones existentes):

```jsonl
{"nombre":"Ana","apellido":"Admin","fecha_nacimiento":"1985-03-10","rol":"admin","email":"ana.admin@ejemplo.com","telefono":"3424000001","id_sede":null,"id_cobertura":null,"ids_especialidades":[]}
{"nombre":"Olga","apellido":"Operadora","fecha_nacimiento":"1990-05-20","rol":"operador","email":"olga.operador@ejemplo.com","telefono":"3424000002","id_sede":1,"id_cobertura":null,"ids_especialidades":[]}
{"nombre":"Mario","apellido":"Medico","fecha_nacimiento":"1988-07-15","rol":"medico","email":"mario.medico@ejemplo.com","telefono":"3424000003","id_sede":1,"id_cobertura":null,"ids_especialidades":[1,2]}
{"nombre":"Paula","apellido":"Paciente","fecha_nacimiento":"1998-03-14","rol":"paciente","email":"paula.paciente@ejemplo.com","telefono":"3424000004","id_sede":null,"id_cobertura":1,"ids_especialidades":[]}
```

La edición médica conserva las especialidades que siguen asignadas e inserta o quita solo las diferencias. Si una especialidad a quitar está usada en agendas del médico, responde `409` sin modificar datos. Un cambio de rol se permite solo si el usuario no tiene especialidades médicas, agendas propias, historiales como médico, turnos ni historiales como paciente; si existe alguna de esas asociaciones, responde `409` con la causa. Auditoría y notificaciones propias no bloquean el cambio. Para cambiar de rol, enviar los campos de sede, cobertura y especialidades válidos para el rol nuevo. La respuesta `200` devuelve los datos públicos actualizados y `especialidades: [{ id, descripcion }]` o `[]`, nunca password ni token. Errores: `400` por datos o relaciones inválidas, `401` sin autenticación o usuario eliminado, `403` sin rol administrador, `404` si el usuario editado no existe, `409` por email duplicado o asociaciones que impiden el cambio. Usuario y especialidades se confirman en una transacción; la auditoría se registra después y, si falla, la edición permanece guardada aunque la petición devuelva error.

Al validar un JWT, el servidor consulta el usuario por su ID y utiliza el rol y la sede actuales de la base. Por eso, los cambios de rol o sede afectan la autorización de la siguiente petición incluso si se usa un token emitido antes del cambio. `GET /auth/perfil` se conserva.

### Listados de usuarios y pacientes (B03)

`GET /usuarios` requiere token de administrador y lista los cuatro roles, incluidos los pacientes. Acepta `busqueda` (coincidencia parcial en nombre, apellido o `nombre apellido`), `rol` (`admin`, `operador`, `medico` o `paciente`), `id_sede` (entero positivo) y `pagina` (entero positivo, por defecto 1). Los filtros se combinan con `AND`; por ejemplo, `/usuarios?busqueda=Ana%20Lopez&rol=medico&id_sede=1&pagina=1`. La búsqueda recorta espacios exteriores y, si queda vacía, no filtra.

`GET /pacientes` requiere token de administrador, operador o médico. Acepta `busqueda` con el mismo criterio, `dni` exacto de 7 u 8 dígitos y `pagina` (por defecto 1); `busqueda` y `dni` se combinan con `AND`. Por ejemplo, `/pacientes?busqueda=Franco&dni=36000960&pagina=1`. Sin filtros devuelve los pacientes paginados. Cada paciente contiene únicamente `id`, `nombre`, `apellido`, `dni`, `fecha_nacimiento`, `id_cobertura` y `cobertura_nombre`; no incluye historial clínico.

Ambos listados se ordenan por apellido, nombre e ID ascendentes y tienen un límite fijo de 20 resultados por página. La respuesta uniforme `200` tiene `datos: { "items": [], "total": 0, "pagina": 1, "limite": 20 }`; `items` contiene los campos públicos existentes en `/usuarios` (sin password) o los campos de selección anteriores en `/pacientes`. `total` cuenta todos los registros filtrados, no solo los de la página. Una página posterior sin resultados responde `200` con `items: []` y el `total` correspondiente. Parámetros mal formados (incluidos arreglos, objetos, página u offset inseguros) responden `400`; sin token, `401`; con rol no permitido, `403`.

### Edición del perfil propio del paciente (B04)

`PATCH /usuarios/mi-perfil` requiere token de paciente. El ID se obtiene exclusivamente del usuario autenticado; el cuerpo no admite `id` ni campos ajenos a `email`, `telefono`, `password` e `id_cobertura`. Debe enviarse al menos un campo. Los omitidos conservan su valor, y enviar el valor actual también es válido. Ejemplos:

```jsonl
{"telefono":"3424111222"}
{"email":"paciente.nuevo@ejemplo.com","telefono":"3424111222","id_cobertura":1}
{"password":"NuevaClave2026!"}
```

El email se recorta de espacios exteriores, debe tener formato válido y no superar 30 caracteres; si lo usa otra persona, responde `409`. El teléfono debe tener 7 a 10 dígitos. La contraseña debe tener 8 a 72 bytes y no estar vacía ni compuesta solo por espacios: se hashea sin recortarla. La cobertura debe ser un ID entero positivo existente y no puede ser `null`. Todos los campos enviados se validan antes de un único `UPDATE`; no se modifican `rol`, `id_sede`, DNI, nombre, apellido, fecha de nacimiento ni especialidades. Cuerpos vacíos, no-objeto, campos prohibidos o valores inválidos —incluida una cobertura inexistente— responden `400`. Sin token válido o si el usuario del token ya no existe, `401`; admin, operador y médico reciben `403`. La respuesta `200` contiene los datos públicos actualizados del paciente, nunca contraseña, hash ni token. Después de guardar se registra auditoría `MODIFICACION` con el propio paciente como autor; si falla la auditoría, la edición permanece guardada aunque la petición devuelva error. `GET /auth/perfil` no cambia.

### Control de sede del operador en agendas y turnos

El operador puede consultar `GET /agendas` y `GET /agendas/:id` de cualquier sede; siguen disponibles los filtros por fecha, sede y médico. Para `POST /agendas` debe indicar su propia sede. En `PUT /agendas/:id`, tanto la sede de la agenda existente como la enviada deben coincidir con la sede actual del operador; no puede editar una agenda ajena ni trasladar una propia. En `DELETE /agendas/:id` tampoco puede borrar una agenda de otra sede. Una agenda inexistente responde `404`; una diferencia de sede responde `403` antes de escribir. El operador puede crear agendas para distintos médicos de su sede, sujeto a las validaciones existentes.

`GET /turnos/sede?fecha=AAAA-MM-DD` toma la sede de `req.usuario.id_sede`, no de los parámetros del cliente. `POST /turnos` permite asignar turnos a distintos pacientes, pero para el operador exige que `id_sede` sea la suya antes de insertar o notificar. `PATCH /turnos/:id/cancelar` obtiene la sede desde la agenda del turno y rechaza con `403` los turnos de otra sede antes de actualizar o notificar; mantiene la restricción de turno confirmado. Si el operador no tiene una sede válida asignada, estas escrituras y el listado de turnos de su sede responden `403`. Los IDs de cuerpo y ruta usados en estas operaciones deben ser enteros positivos válidos. La autorización usa siempre la sede actual de la base, cargada por `verificarToken`, no una sede o un rol enviados por el cliente. Las reglas de pacientes y médicos permanecen intactas.

En `POST /agendas` y `PUT /agendas/:id`, la fecha debe ser un día existente en formato `YYYY-MM-DD` y con año entre 1000 y 9999; se contemplan los años bisiestos. Las horas deben tener formato exacto `HH:mm`, con valores entre `00:00` y `23:59`, y la salida debe ser estrictamente posterior a la entrada, sin cruzar medianoche. Son válidos `2028-02-29` con `09:00`–`12:00` o `09:00`–`21:00`. Responden `400`, por ejemplo, `2027-02-29`, `0999-01-01`, `9:00`, `24:00`, `12:60`, `09:00`–`09:00` y `21:00`–`09:00`. No se restringen fechas pasadas, duración mínima, intervalos ni horario de apertura.

Cuando una escritura del operador apunta a una sede diferente de la asignada, responde `403` con el mensaje: «Solo podés realizar esta operación en tu sede asignada. Si tu asignación cambió recientemente, cerrá sesión y volvé a ingresar para actualizarla.». Este aviso no reemplaza el `404` de registros inexistentes, el error específico de operador sin sede válida ni los errores de propiedad de pacientes o médicos.

### Agendas: relaciones, turnos y datos legibles (B05)

Al crear o editar una agenda, la especialidad debe estar asignada al médico en `medico_especialidad`; una especialidad existente pero no asignada responde `400` con «La especialidad indicada no está asignada al médico.». Se mantienen la validación de fecha y horarios anterior y las comprobaciones de médico y sede.

`GET /agendas` y `GET /agendas/:id` conservan los IDs y demás campos de `agenda` y agregan `medico_nombre`, `medico_apellido`, `especialidad_descripcion` y `sede_nombre`. La consulta usa JOIN; no altera el orden, los filtros ni los permisos. Ejemplo de item: `{ "id": 4, "id_medico": 3, "id_especialidad": 1, "id_sede": 1, "medico_nombre": "Ana", "medico_apellido": "López", "especialidad_descripcion": "Clínica médica", "sede_nombre": "Sede Centro", "fecha": "2028-02-29", "hora_entrada": "09:00", "hora_salida": "21:00" }`. El frontend puede formar etiquetas con el ID y el nombre sin cambiar el valor seleccionado.

Si una agenda tiene turnos confirmados, `PUT /agendas/:id` no permite cambiar médico, especialidad ni sede. Puede ampliar el horario, por ejemplo de `09:00`–`12:00` a `08:00`–`13:00`, o ajustarlo si todos los confirmados siguen en la misma fecha y en el intervalo `[hora_entrada, hora_salida)`. Reducirlo de modo que excluya un turno confirmado responde `409` sin editar. `DELETE /agendas/:id` responde `409` si hay turnos confirmados; otros turnos asociados también impiden eliminarla y producen un `409` controlado, sin borrar registros en cascada. No se mueven ni cancelan turnos automáticamente. No se comprueban superposiciones de agendas.

### Disponibilidad y reservas de 20 minutos (B06)

`GET /medicos/:id/fechas-disponibles?id_especialidad=1&id_sede=1` y `GET /medicos/:id/turnos-disponibles?id_especialidad=1&id_sede=1&fecha=2026-11-10` requieren token de paciente u operador. El operador solo consulta su sede actual: sin sede válida o con otra sede recibe `403` (en el segundo caso, el aviso de sede asignada); el paciente puede consultar distintas sedes. IDs no enteros positivos, parámetros repetidos/no simples y fechas inexistentes o mal formadas responden `400`; médico inexistente o sin rol médico, `404`. Sin token, `401`; con otro rol, `403`.

Fechas devuelve `datos: ["2026-11-10", "2026-11-12"]`: fechas distintas con agenda, ordenadas, aunque ya no queden bloques libres. Una combinación sin agenda devuelve `datos: []`. Horarios devuelve `datos: [{ "id_agenda": 12, "hora": "09:00" }, { "id_agenda": 12, "hora": "09:40" }, { "id_agenda": 15, "hora": "15:00" }]`, ordenados por hora e ID de agenda; si todos están ocupados, `[]`. Puede haber varios rangos el mismo día. Cada rango se divide desde su entrada en bloques completos de 20 minutos: uno que sobrepase la salida no se ofrece. Los turnos confirmados del mismo médico y fecha bloquean todo intervalo que se superponga, incluso reservas antiguas fuera de la división o en otra agenda/sede/especialidad; los cancelados no bloquean. No se devuelven datos de otros pacientes.

`POST /turnos` conserva su cuerpo (`id_medico`, `id_especialidad`, `id_sede`, `fecha`, `hora`, `nota`, más `id_paciente` para operador), cobertura, permisos y notificación. Exige fecha real `YYYY-MM-DD` y hora exacta `HH:mm`. Solo acepta inicios de bloque generados: fuera del rango o de la división responde `400`; si el bloque existe pero está ocupado, `409`; si está libre, responde `201` y utiliza su `id_agenda`. Por ejemplo, con agenda `09:00`–`10:10` se ofrecen `09:00`, `09:20` y `09:40`, pero no `10:00`; reservar `09:10` responde `400`. Si `09:20` está confirmado, no se ofrece ni puede reservarse de nuevo. La disponibilidad es una consulta puntual: B06 todavía no evita reservas simultáneas de B08 y no garantiza que un horario consultado siga libre al reservar. No se restringen fechas pasadas.

### Listados y gestión de turnos (B07)

`GET /turnos/medico?fecha=2026-11-10` requiere token de médico y fecha obligatoria real `YYYY-MM-DD`. Toma siempre el ID del médico autenticado: sin `id_sede` lista sus turnos de todas las sedes; `&id_sede=2` limita el resultado a esa sede sin cambiar el médico consultado. Un `id_medico` adicional enviado por el cliente no modifica ese alcance. `GET /turnos/sede?fecha=2026-11-10` requiere token de operador y toma siempre `id_sede` de su usuario autenticado. `&id_medico=3&estado=confirmado` combina ambos filtros con `AND`; sin ellos devuelve los tres estados y los turnos de todos los médicos de su sede. Un `id_sede` enviado por el cliente no cambia la sede consultada. El operador sin sede válida recibe `403`.

Ambos listados devuelven `200` con `datos` como arreglo ordenado por hora e ID de turno, o `[]` si no hay coincidencias; no tienen paginación. Conservan nota, IDs y nombres de médico, especialidad y sede, y agregan `paciente_nombre`, `paciente_apellido` y `paciente_fecha_nacimiento` en formato `YYYY-MM-DD`. Por ejemplo: `{"id":12,"nota":"Control","hora":"09:20","estado":"confirmado","id_paciente":2,"id_agenda":4,"id_medico":3,"id_especialidad":1,"id_sede":2,"paciente_nombre":"Ana","paciente_apellido":"López","paciente_fecha_nacimiento":"1990-05-14"}` (además de los demás campos existentes). No incluyen contraseña, hash ni historial. `GET /turnos/mis-turnos` conserva su contrato anterior.

La fecha faltante o inválida, un ID no entero positivo seguro, un estado distinto de `confirmado`, `cancelado` o `atendido`, o parámetros repetidos/estructurados responden `400`. Sin token se responde `401`; con rol no permitido, `403`. El médico puede cancelar o atender turnos asignados a él en cualquiera de sus sedes, incluso fuera de su sede principal; un turno de otro médico responde `403`. Paciente y operador mantienen sus límites actuales, al igual que las restricciones de estado y notificaciones.

### Atención con historial clínico (B08)

`PATCH /turnos/:id/atender` sigue siendo exclusivo para médicos y ahora recibe `{"diagnostico":"...","tratamiento":"...","observaciones":"..."}`. `diagnostico` es obligatorio, debe ser texto no vacío y admite hasta 255 caracteres; `tratamiento` y `observaciones` son opcionales, pero si se envían deben ser texto de hasta 255 caracteres. Un cuerpo ausente/no-objeto, tipos incorrectos, diagnóstico vacío o campos demasiado largos responden `400` sin modificar datos ni notificar.

El turno debe existir, estar confirmado y pertenecer al médico autenticado, sin limitarlo a su sede principal. La creación del historial y el cambio de estado a `atendido` se realizan en una única transacción y con la misma conexión; cualquier fallo revierte ambas escrituras. Cada turno admite un solo historial. La operación responde `200` con los mismos datos del turno que devolvía anteriormente y, únicamente después del `commit` y de liberar la conexión, crea la notificación de atención para el paciente. Un turno de otro médico responde `403`; un estado incompatible o un historial existente, `409`.

`POST /historial-clinico` se conserva para cargar el historial de un turno que ya estaba atendido pero todavía no lo tiene. Requiere `id_turno` entero positivo y aplica las mismas validaciones clínicas. Solo puede usarlo el médico dueño del turno; responde `201` al crear, `409` si el turno no está atendido o ya posee historial, y no vuelve a cambiar el estado ni crea una notificación de atención.

Esta entrega no cambia disponibilidad, reservas ni cancelaciones. El control de reservas simultáneas continúa fuera de alcance.

### Eliminación de especialidades y coberturas en uso (B09)

Los `DELETE /especialidades/:id` y `DELETE /coberturas/:id` conservan el acceso exclusivo para administradores, el `404` para registros inexistentes y la auditoría `BAJA` únicamente después de una eliminación exitosa. Las comprobaciones de dependencias usan consultas parametrizadas y no eliminan relaciones asociadas.

Una especialidad con médicos asociados continúa respondiendo `409`. También responde `409` con «No se puede eliminar la especialidad porque tiene agendas asociadas» si cualquier agenda la referencia. Una cobertura con usuarios asociados continúa respondiendo `409`; además, cualquier turno histórico o vigente que la referencie impide eliminarla, sin importar su estado ni que actualmente ningún usuario conserve esa cobertura, con «No se puede eliminar la cobertura porque tiene turnos asociados».

Como respaldo ante una relación creada entre la comprobación y el `DELETE`, el error de clave foránea `ER_ROW_IS_REFERENCED_2` se traduce a `409` indicando que el registro tiene datos asociados. Otros errores se propagan al manejo global. Ningún rechazo registra auditoría.

Todas las respuestas usan el formato:

```json
{
  "codigo": 200,
  "estado": "ok",
  "datos": null
}
```
