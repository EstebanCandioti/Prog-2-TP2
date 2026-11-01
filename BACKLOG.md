# Backlogs del frontend y backend

Estado actualizado al 01/11/2026 según los acuerdos del chat y la revisión de esta copia local. Cada tarea de pantalla incluye vista, estilos, lógica, modelos y servicio necesarios, ruta, validaciones y estados de carga, vacío y error. La división busca tareas completas sin abarcar un módulo entero.

## Estados y responsables

- **Hecha:** Esteban confirmó que terminó la tarea.
- **Pendiente:** todavía no se informó su finalización.
- **Disponible:** puede comenzar con los endpoints actuales, según el alcance acordado.
- **Parcial:** parte del alcance está implementada; se detalla el faltante.
- **Sin verificar:** tarea asignada a Santiago; falta confirmar su estado actual.
- **Dependiente:** se puede completar después de las tareas indicadas.

## Backlog 1 — Frontend con el backend actual

| ID | Tarea | Alcance | Responsable | Estado |
| --- | --- | --- | --- | --- |
| F01 | Sesión vencida y fallos de API | Ante `401` de una petición protegida, limpiar sesión y redirigir al login; distinguir errores de conexión. | Esteban | **Hecha** |
| F02 | Administrador / Sedes | Tabla con búsqueda, alta, edición, confirmación de baja y actualización de la lista. | Santiago | Sin verificar |
| F03 | Administrador / Especialidades | CRUD con mensajes del backend cuando se rechaza una baja. | Santiago | Sin verificar |
| F04 | Administrador / Coberturas | CRUD y manejo de dependencias. | Santiago | Sin verificar |
| F05 | Administrador / Auditoría | Filtros por usuario, entidad y fechas; paginación en el frontend sobre el listado actual. | Santiago | Sin verificar |
| F06 | Administrador / Reportes | Cuatro indicadores, período común y gráficos; servicio para consultar los reportes. | Esteban | **Hecha** |
| F08 | Operador / Alta de pacientes | Reutilizar el registro público bajo la ruta protegida del operador y mostrar los datos del alta sin cerrar su sesión. | Esteban | **Hecha** |
| F09 | Campana y listado de notificaciones | Panel con hasta 10 pendientes, listado completo, contador, marcado individual y masivo con sincronización coordinada y estados vacío/error. Consultar al iniciar sesión, abrir la campana y volver a la pestaña; refrescar cada dos minutos solo con sesión y pestaña visibles. | Esteban | **Hecha; funcionamiento y cierre confirmados por Esteban** |

**F07 — Paciente / Mis turnos** salió de este backlog y pasó a **D10**. La paginación y el detalle clínico por turno requieren primero **B11**. F03 y F04 pueden desarrollarse con la API actual; los rechazos controlados de B09 ya están implementados y verificados.

## Backlog 2 — Cambios del backend

Cada tarea incluye rutas, permisos, validaciones, respuestas uniformes, casos de error y actualización de Postman. Las URL nuevas se acuerdan antes de implementarlas.

| ID | Tarea | Resultado esperado | Estado |
| --- | --- | --- | --- |
| B01 | Datos para seleccionar sedes, especialidades y médicos | Lecturas de catálogos para autenticados y `GET /medicos` con especialidades y filtros por especialidad y sede implementados; listado separado de usuarios y disponibilidad. | **Hecha; verificada en Windows** |
| B02 | Alta y edición administrativa de usuarios | Crear operador, médico y admin; reglas de sede por rol; asignar y editar especialidades médicas; contraseñas hasheadas y auditoría. | **Hecha** |
| B03 | Consultas de usuarios y búsqueda de pacientes | Listados paginados de 20 registros; búsqueda por nombre/apellido y filtros acordados, incluido DNI exacto para pacientes; permisos por rol. | **Hecha** |
| B04 | Edición del perfil propio del paciente | Permitir solo email, contraseña, teléfono y cobertura; comprobar email único y hashear la contraseña nueva. | **Hecha** |
| B05 | Reglas y datos de agenda | Operador limitado a su sede; médico a su agenda y especialidades; validar fecha y horarios; proteger turnos confirmados; devolver IDs y nombres legibles. | **Hecha, con alcance acordado** |
| B06 | Consulta de disponibilidad | Fechas con agenda y bloques libres de 20 minutos por médico, especialidad y sede; validación compartida con la reserva. | **Hecha** |
| B07 | Listados y permisos de turnos | Nombre y fecha de nacimiento del paciente, filtros por fecha/sede/médico/estado según el rol y gestión del médico en todas sus sedes. | **Hecha** |
| B08 | Atención transaccional e historial clínico | Guardar historial y estado atendido en una transacción; conservar el endpoint separado de historial y las notificaciones al paciente después del commit. | **Hecha, con alcance acordado** |
| B09 | Bajas controladas de catálogos con dependencias | Responder `409` ante especialidades usadas en agendas o coberturas usadas en turnos; capturar específicamente el rechazo por clave foránea del DELETE. | **Hecha** |
| B10 | Datos de prueba reproducibles | Cuentas demo y SQL B10 portable: 16 agendas, 20 turnos en los tres estados, 4 historiales y 28 notificaciones; tres médicos, uno en dos sedes; README con instrucciones. | **Hecha** |
| B11 | Consulta paginada de turnos del paciente y detalle clínico por turno | Listar con `tipo=proximos` o `tipo=todos`, paginar de a 20 y consultar el resumen clínico por ID de turno con permisos del paciente. | **Hecha; verificada en Windows** |

### Alcance y decisiones del backend

- La duración acordada e implementada es de **20 minutos fijos**, calculados por el backend.
- La prevención de superposición entre agendas quedó fuera de B05 por acuerdo del grupo.
- El control de reservas simultáneas quedó postergado; no bloquea el alcance actual del frontend. Se conserva la comprobación de disponibilidad antes de insertar.
- No se aplicó a la base existente la restricción única propuesta para `historial_clinico.id_turno`. La atención transaccional está implementada; el refuerzo de unicidad del endpoint separado queda pendiente de confirmar cambios de esquema.
- B10 se prepara ejecutando `npm run seed:demo` para las cuentas e importando después `backend/src/database/seed-b10.sql`; la repetición con la misma fecha base no duplica datos.
- B01 quedó verificada en Windows: build y 381 comprobaciones contra MySQL en una base temporal, incluidos cuatro roles, médicos sin agenda, filtros combinados, campos devueltos y conservación de los permisos de usuarios y disponibilidad.
- B11 quedó verificada en Windows: build y 419 comprobaciones con MySQL en una base temporal. Se probaron 49 turnos propios, 27 próximos, orden, paginación, reloj de MySQL, permisos clínicos y actualización tras cancelar. `GET /turnos/mis-turnos` devuelve `{ items, total, pagina, limite }` y `GET /turnos/:id/historial` consulta el registro clínico de un turno propio atendido.
- Mantenimiento documental pendiente: fase 03 de Postman y su runner todavía tienen pasos de atención anteriores a B08; requieren cuerpo clínico y adaptación del alta separada de historial. Los runners completos no se ejecutaron en esta revisión; se validaron los ocho JSON y la sintaxis de sus scripts.

## Backlog 3 — Frontend dependiente del backend

**Reparto acordado al 01/11/2026.** Santiago toma las pantallas más independientes; Esteban concentra los flujos de agenda y reserva que comparten lógica. La disponibilidad de esta tabla contempla el alcance de backend ya implementado y verificado hasta B11; el control de reservas simultáneas quedó fuera del alcance actual.

| ID | Tarea | Responsable | Depende de | Estado actual |
| --- | --- | --- | --- | --- |
| D01 | Administrador / Usuarios: listado filtrado y paginado, alta y edición con sede y especialidades. | Santiago | B01 (lecturas de catálogos ya disponibles), B02, B03 | **Disponible** |
| D02 | Médico / Mi agenda: consulta por día y CRUD de rangos. | Esteban | B01, B05 | **Hecha; cierre confirmado por Esteban** |
| D03 | Médico / Turnos programados: paciente, edad, filtro de sede, atención con historial y cancelación. | Esteban | B07, B08 | **Hecha; cierre confirmado por Esteban** |
| D04 | Médico / Historial clínico: búsqueda del paciente y visualización de sus registros. | Santiago | B03, B08 | **Disponible** |
| D05 | Operador / Agenda y turnos de su sede: filtros, alta y edición de agenda, consulta y cancelación de turnos. | Esteban | B01, B05, B07 | **Hecha; cierre confirmado por Esteban** |
| D06 | Paciente / Nuevo turno: flujo reutilizable por pasos, opciones filtradas, resumen y recuperación si se ocupa el horario. | Esteban | B01, B06, B08 | **Hecha; prueba funcional y cierre confirmados por Esteban** |
| D07 | Operador / Asignar turno desde un rango de agenda: diálogo propio con búsqueda paginada de pacientes, horario libre y nota; sede tomada de la sesión. | Esteban | B03, B06, D05 | **Implementada y verificada en Windows; limitaciones documentadas** |
| D08 | Paciente / Mis datos editables: campos permitidos y confirmación de cambio de contraseña. | Santiago | B04 | **Disponible** |
| D09 | README y recorrido de defensa: arranque desde cero, versiones, datos de prueba, librería de gráficos y recorrido de los cuatro roles. | Esteban, con aportes de Santiago | B10 y pantallas terminadas | Dependiente: cierre de las pantallas y recorrido final |
| D10 | Paciente / Mis turnos: pestañas Próximos y Todos los turnos, consultas paginadas, estados visibles, detalle, resumen clínico de atendidos y cancelación confirmada. | Santiago | B11 | **Disponible** |

### Orden y coordinación de la tanda D

- **Santiago:** comenzar por D01, continuar con D04 y D08, y abordar D10; B11 ya está verificada.
- **Esteban:** D02, D03, D05 y D06 cerradas por Esteban. D07 implementada como asignación contextual desde la agenda y verificada en Windows; quedan la advertencia menor de tipado y la limitación conocida de agendas superpuestas, documentadas abajo. F09 base verificada; su ampliación requiere corregir la apertura del panel. Restan el cierre documental D09 y la revisión conjunta de las entregas de Santiago.
- **Reutilización:** evaluar formularios de agenda compartidos entre D02 y D05; D07 usa un diálogo propio y reutiliza servicios HTTP y utilidades, sin modificar el stepper de D06.
- **Archivos compartidos:** antes de trabajar en paralelo, acordar quién crea cada servicio y modelo compartido. Coordinar los cambios en rutas y navegación para evitar editar el mismo archivo simultáneamente.
- **Notificaciones:** F09 y su ampliación cerradas por Esteban después de corregir las queries de los botones; conserva su responsable Esteban.

### Verificación de D02 en Windows

- Build del frontend correcta; conserva advertencias de tamaño del bundle inicial y del CSS de Reportes.
- Pasaron 59 comprobaciones de validadores/fechas y 42 comprobaciones de integración usando los componentes, servicios y API reales contra una base temporal de MySQL, eliminada al terminar.
- Verificación en navegador: fecha inicial, listado vacío, cambio de día, rangos en dos sedes, sede inicial, especialidades propias, errores del formulario y precarga de edición. Se revisó también el diálogo en pantalla angosta sin guardar cambios en la base actual.
- Presentación horaria aceptada: los inputs nativos `type="time"` pueden mostrar AM/PM según la configuración del navegador. Se retiró únicamente la ayuda de formato de 24 horas que generaba confusión; se conservan las validaciones, la serialización en `HH:mm` y las demás ayudas.
- Decisión técnica para la defensa: cada rango de agenda pertenece a una sola fecha y exige salida posterior a entrada. No se admiten rangos que crucen medianoche. `12 AM` representa `00:00` de esa fecha y `12 PM` representa `12:00`; una salida con cualquiera de esos valores es anterior a una entrada de `13:00`. La misma regla se valida en frontend y backend. Esteban aceptó este alcance y confirmó el cierre de D02.
- Desde Windows solo se actualizó este backlog; no se modificó código de la aplicación ni se hizo commit o push.

### Verificación de D03 en Windows

- Build del frontend correcta; conserva advertencias de tamaño del bundle inicial y del CSS de Reportes.
- Pasaron 69 comprobaciones de integración, con 22 peticiones a la API, usando los componentes y servicios reales contra una base temporal de MySQL eliminada al terminar.
- Se comprobaron filtros y conservación de su selección, edad, notas desplegables, validaciones clínicas, atención e historial, cancelación, prevención de envíos duplicados, recuperación ante errores y descarte de respuestas anteriores al cambiar los filtros.
- Verificación visual en navegador: listado en dos sedes, filtro de sede, expansión de notas, diagnóstico obligatorio y confirmación de cancelación. No se guardaron cambios en la base actual durante la revisión visual.
- Desde Windows solo se actualizó este backlog; no se modificó código de la aplicación ni se hizo commit o push. No se encontraron conflictos.

### Verificación de D05 en Windows

- Builds del frontend y backend correctas. El frontend conserva las advertencias de tamaño del bundle inicial y del CSS de Reportes.
- Pasaron 62 comprobaciones de integración, con 41 peticiones a la API, usando componentes y servicios reales contra una base temporal de MySQL eliminada al terminar. La base habitual no se modificó.
- Se verificaron agrupación por médico y agenda, filtros, médicos sin agenda, sede fija, selección de especialidades, alta, edición, eliminación, rechazos por asociaciones, turnos confirmados, notas y cancelación. También se comprobaron conservación de valores ante errores, reintentos, prevención de envíos duplicados y descarte de respuestas antiguas.
- Regresión del modo médico: conserva el médico propio, permite elegir sede y mantiene la consulta de agendas en distintas sedes.
- Revisión visual en navegador: fecha y sede iniciales, listado vacío, tabla y turnos desplegables, nota, formulario de alta, precarga de rango y consulta de otra sede sin acciones. No se guardaron cambios en la base habitual durante esta revisión visual.
- Desde Windows solo se actualizó este backlog; no se modificó código de la aplicación ni se hizo commit o push. No se encontraron conflictos ni errores funcionales en los casos revisados.

### Verificación de D07 en Windows

- Build del frontend correcta. Conserva las advertencias de tamaño y agrega NG8102 en la expresión `versionesTurnos()[medico.id] ?? 0`: el registro está tipado como si todas sus claves existieran. Ajuste menor pendiente: expresar las claves opcionales, por ejemplo con `Partial<Record<number, number>>`, conservando el valor por defecto.
- Pasaron 59 comprobaciones de integración, con 29 peticiones a la API, usando componentes y servicios reales contra una base temporal de MySQL eliminada al terminar. Se confirmó que no quedan bases temporales D07; la base habitual no se modificó.
- Se comprobaron búsqueda por nombre, nombre completo y DNI, paginación de 20, selección y cobertura del paciente, validaciones de nota y horario, reserva con el contexto correcto, notificación del backend, bloqueo de envíos repetidos, recuperación ante `409`, errores y reintentos, cancelación de consultas antiguas y permisos por sede y rol.
- Se verificaron conservación de filtros y de la sección desplegada, actualización del listado de confirmados y del horario al reabrir, y conservación del contrato de reserva de D06.
- Revisión visual: apertura desde un rango, resumen fijo, búsqueda por DNI, paciente y cobertura, selector de horarios, nota y botón de confirmación. Se cerró el diálogo sin crear reservas en la base habitual.
- Limitación de backend reproducida en la base temporal: con rangos superpuestos del mismo médico, especialidad, sede y fecha, el POST puede asociar la reserva a otro rango compatible. El frontend filtra horarios por el ID seleccionado, pero el contrato de reserva no recibe `id_agenda`. La prevención de superposición sigue fuera del alcance acordado de B05; no se modificó el backend.
- Desde Windows solo se actualizó este backlog; no se modificó código de la aplicación ni se hizo commit o push. No se encontraron conflictos.

### Verificación de F09 en Windows

- Build del frontend correcta, con las advertencias existentes de tamaño del bundle, CSS de Reportes y tipado de `versionesTurnos` de D07.
- Pasaron 43 comprobaciones del servicio real y sus effects de Angular con HTTP y tiempos controlados: intervalo de 120000 ms, sesión, visibilidad, inicialización idempotente, consultas coincidentes, reintentos, contador, marcado concurrente, respuestas antiguas y limpieza al destruirse.
- Pasaron además 46 comprobaciones de integración, con 14 peticiones a la API real y MySQL en una base temporal eliminada al terminar. Se verificaron los cuatro roles, propiedad de las notificaciones, conteo, orden, persistencia del marcado y rechazo de accesos ajenos o sin autenticación.
- Revisión visual de la compilación actual: ruta protegida, ingreso con paciente demo, campana con 11 no leídas, listado de 16 notificaciones con estados y fechas, actualización manual disponible y campana retirada al cerrar sesión. No se marcaron notificaciones en la base habitual.
- El servidor existente de `localhost:4200` seguía mostrando el placeholder anterior; se verificó la compilación actual mediante un servidor temporal en Windows, detenido al terminar. Para ver F09 en el servidor habitual hay que reiniciar su proceso de Angular.
- Detalle previo del backend observado: algunos mensajes de atención ya guardados contienen una fecha de JavaScript en formato largo en inglés. El frontend muestra el mensaje recibido; normalizar la fecha al construir esos mensajes queda como ajuste de presentación pendiente, sin modificar registros existentes.
- Desde Windows solo se actualizó este backlog; no se modificó código de la aplicación ni la base habitual, ni se hizo commit o push. No se encontraron conflictos.

### Ampliación de F09 — verificación en Windows y corrección pendiente

- Se conserva la implementación base y su verificación anterior. Se agregó `PATCH /notificaciones/leidas`, para cualquier rol autenticado, con usuario tomado del token y respuesta `{ cantidad_actualizada }`; se documentaron pendientes propias, ninguna pendiente, autenticación y aislamiento en README y Postman.
- La campana abre un panel CDK anclado, con hasta 10 pendientes recientes, scroll, total real, marcado individual, marcado de todas las pendientes y acceso al listado completo. El panel y la pantalla comparten lista, contador, bloqueos, progreso y errores del servicio central.
- Se conserva el seguimiento de sesión, visibilidad e intervalo de 120000 ms. El marcado masivo bloquea nuevos marcados hasta completar su GET; si falla esa consulta después de un PATCH exitoso, se informa el resultado y se permite reintentar solo la consulta antes de volver a marcar. Se descartan consultas antiguas y se cancelan las de la sesión anterior.
- Compilación y comprobación visual y funcional de esta ampliación pendientes en Windows; no se ejecutaron instalaciones, builds, tests, commits, pushes ni cargas de datos desde Ubuntu. No se integró el commit remoto `b2f8a71` ni se incluyó el ajuste pendiente de `versionesTurnos`.
- Verificación posterior en Windows: builds del frontend y backend correctas, con las advertencias ya conocidas; JSON de Postman fase 04 válido.
- Pasaron 63 comprobaciones del servicio real con tiempos y HTTP controlados, incluido el seguimiento anterior, límite de diez pendientes, reemplazo del aviso marcado, bloqueos durante PATCH + GET, errores, reintento exclusivo de consulta y cambios de sesión.
- Pasaron además 50 comprobaciones de integración con 26 peticiones a la API y MySQL en una base temporal eliminada al terminar. Se probaron los cuatro roles, 15 registros y 14 pendientes iniciales por usuario, marcado de todas las pendientes más allá de las diez visibles, cantidad actualizada, repetición con cero pendientes y aislamiento frente a IDs ajenos en el cuerpo, ausencia de token o token vencido.
- Error bloqueante reproducido en navegador sobre la compilación actual: pulsar la campana genera `Cannot read properties of undefined (reading 'focus')` en `alternar()`. Las queries `campana` y `cierre` declaran `ElementRef` solo en su tipo y necesitan solicitarlo explícitamente con `{ read: ElementRef }`; la referencia obtenida del botón Material no expone `nativeElement`. Quedan pendientes la corrección en Ubuntu y las pruebas visuales de apertura, cierre, scroll, teclado y navegación.
- Primer ajuste recibido desde Ubuntu: ambas queries agregaron `read: ElementRef`, pero conservaron un solo parámetro genérico. La build posterior en Windows falla con TS2353 porque esa sobrecarga exige dos parámetros genéricos o inferencia completa. Se comprobó sin editar archivos que omitir los genéricos y conservar `{ read: ElementRef }` elimina los errores de tipos de este componente; queda aplicar ese ajuste en Ubuntu y repetir la build y revisión visual.
- Cierre posterior: se aplicó la inferencia de tipos con `{ read: ElementRef }` en ambas queries. La build del frontend del 01/11/2026 pasó en Windows con las advertencias conocidas; Esteban probó el funcionamiento y confirmó que quedó bien. Los errores anteriores se conservan aquí como registro de la revisión y ya no bloquean F09.
- Desde Windows solo se actualizó este backlog; no se modificó código de la aplicación ni la base habitual. El servidor temporal se detuvo al terminar. No se hicieron commits ni pushes ni se encontraron conflictos.

### Criterios ya acordados para D10

- **Próximos:** turnos confirmados cuya fecha y hora sean iguales o posteriores al momento de MySQL, del más cercano al más lejano.
- **Todos los turnos:** todos los turnos del paciente, incluidos los próximos, atendidos, cancelados y confirmados pasados; fecha, hora e ID descendentes.
- Sin filtros adicionales ni buscador. Cada pestaña envía `tipo=proximos` o `tipo=todos`, con páginas de 20 registros. Al cambiar de pestaña, volver a la página 1.
- Pedir el resumen clínico mediante `GET /turnos/:id/historial` solo al abrir el detalle de un turno atendido.
- Tras cancelar, actualizar los listados y totales: el turno deja Próximos y permanece en Todos los turnos con estado cancelado.
