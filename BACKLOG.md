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
| F02 | Administrador / Sedes | Tabla con búsqueda, alta, edición, confirmación de baja y actualización de la lista. | Santiago | **Hecha; funcionamiento verificado por Esteban** |
| F03 | Administrador / Especialidades | CRUD con mensajes del backend cuando se rechaza una baja. | Santiago | **Hecha; funcionamiento verificado por Esteban** |
| F04 | Administrador / Coberturas | CRUD y manejo de dependencias. | Santiago | **Hecha; funcionamiento verificado por Esteban** |
| F05 | Administrador / Auditoría | Filtros por usuario, entidad y fechas; paginación en el frontend sobre el listado actual. | Santiago | **Hecha; funcionamiento verificado por Esteban** |
| F06 | Administrador / Reportes | Cuatro indicadores, período común y gráficos; servicio para consultar los reportes. | Esteban | **Hecha** |
| F08 | Operador / Alta de pacientes | Reutilizar el registro público bajo la ruta protegida del operador y mostrar los datos del alta sin cerrar su sesión. | Esteban | **Hecha** |
| F09 | Campana y listado de notificaciones | Panel con hasta 10 pendientes, listado completo, contador, marcado individual y masivo con sincronización coordinada y estados vacío/error. Consultar al iniciar sesión, abrir la campana y volver a la pestaña; refrescar cada dos minutos solo con sesión y pestaña visibles. | Esteban | **Hecha; funcionamiento y cierre confirmados por Esteban** |

**F07 — Paciente / Mis turnos** salió de este backlog y pasó a **D10**. La paginación y el detalle clínico por turno requieren primero **B11**. Los rechazos controlados de B09 ya están implementados y verificados. Esteban confirmó que revisó las pantallas de Santiago de esta tanda F y funcionaban correctamente; se da por cerrado este backlog.

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
- Mantenimiento de Postman cerrado en Windows el 01/11/2026: fase 03 adaptada a B08 y bloques de 20 minutos; última regresión de cinco runners con 578 peticiones y 816 aserciones sin fallos, incluidos los casos posteriores del detalle de médicos. Matriz de las 54 rutas y limitaciones en `backend/postman/COBERTURA.md`.

## Backlog 3 — Frontend dependiente del backend

**Reparto acordado al 01/11/2026.** Santiago toma las pantallas más independientes; Esteban concentra los flujos de agenda y reserva que comparten lógica. La disponibilidad de esta tabla contempla el alcance de backend ya implementado y verificado hasta B11; el control de reservas simultáneas quedó fuera del alcance actual.

| ID | Tarea | Responsable | Depende de | Estado actual |
| --- | --- | --- | --- | --- |
| D01 | Administrador / Usuarios: listado filtrado y paginado, alta y edición con sede y especialidades. | Santiago | B01 (lecturas de catálogos ya disponibles), B02, B03 | **Integrada; edición de médicos corregida y verificada en Windows** |
| D02 | Médico / Mi agenda: consulta por día y CRUD de rangos. | Esteban | B01, B05 | **Hecha; cierre confirmado por Esteban** |
| D03 | Médico / Turnos programados: paciente, edad, filtro de sede, atención con historial y cancelación. | Esteban | B07, B08 | **Hecha; cierre confirmado por Esteban** |
| D04 | Médico / Historial clínico: búsqueda del paciente y visualización de sus registros. | Santiago | B03, B08 | **Integrada; verificación funcional inicial en Windows** |
| D05 | Operador / Agenda y turnos de su sede: filtros, alta y edición de agenda, consulta y cancelación de turnos. | Esteban | B01, B05, B07 | **Hecha; cierre confirmado por Esteban** |
| D06 | Paciente / Nuevo turno: flujo reutilizable por pasos, opciones filtradas, resumen y recuperación si se ocupa el horario. | Esteban | B01, B06, B08 | **Hecha; prueba funcional y cierre confirmados por Esteban** |
| D07 | Operador / Asignar turno desde un rango de agenda: diálogo propio con búsqueda paginada de pacientes, horario libre y nota; sede tomada de la sesión. | Esteban | B03, B06, D05 | **Implementada y verificada en Windows; limitaciones documentadas** |
| D08 | Paciente / Mis datos editables: campos permitidos y confirmación de cambio de contraseña. | Santiago | B04 | **Integrada; verificación funcional inicial en Windows** |
| D09 | README final según el PDF: versiones de Node/Angular, arranque de backend/frontend y base de datos, variables de entorno, librería de gráficos y cuentas de los cuatro roles. | Esteban, con aportes de Santiago | B10 y configuración del proyecto | **Documentación actualizada; pendiente validar arranque en una instalación limpia** |
| D10 | Paciente / Mis turnos: pestañas Próximos y Todos los turnos, consultas paginadas, estados visibles, detalle, resumen clínico de atendidos y cancelación confirmada. | Santiago | B11 | **Integrada y adaptada a B11; verificada en Windows** |

### Orden y coordinación de la tanda D

- **Revisión de Esteban:** probó parte de las pantallas de esta tanda y todo lo revisado funcionó correctamente. No confirmó haber probado todos los casos; se mantiene la revisión final pendiente, sin reabrir las tareas ya cerradas. El faltante de edición de médicos de D01 se corrigió posteriormente en Windows.
- **Santiago:** D01, D04, D08 y D10 integradas desde su entrega; edición de médicos de D01 completada en Windows. Resta el recorrido conjunto de sus pantallas.
- **Esteban:** D02, D03, D05, D06 y F09 cerradas por Esteban. D07 implementada y verificada en Windows; la advertencia de tipado quedó corregida y se conserva la limitación conocida de agendas superpuestas. Restan D09 y el recorrido conjunto de las pantallas integradas.
- **Reutilización:** evaluar formularios de agenda compartidos entre D02 y D05; D07 usa un diálogo propio y reutiliza servicios HTTP y utilidades, sin modificar el stepper de D06.
- **Archivos compartidos:** antes de trabajar en paralelo, acordar quién crea cada servicio y modelo compartido. Coordinar los cambios en rutas y navegación para evitar editar el mismo archivo simultáneamente.
- **Notificaciones:** F09 y su ampliación cerradas por Esteban después de corregir las queries de los botones; conserva su responsable Esteban.
- **Alcance de D09 confirmado por Esteban:** documentar los puntos exigidos por el PDF, sin guion de demostración ni sección de problemas frecuentes. El recorrido funcional conjunto es una verificación interna, no un entregable adicional del README.

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

- En la revisión inicial la build agregó NG8102 en `versionesTurnos()[medico.id] ?? 0`. Corregido en Windows el 01/11/2026 por pedido explícito de Esteban: `versionesTurnos` usa `Partial<Record<number, number>>`, expresando las claves opcionales y conservando el valor por defecto. `npm.cmd run build` pasó y la advertencia desapareció; solo quedan las advertencias de tamaño del bundle y del CSS de Reportes. Avisar al agente de Ubuntu en el siguiente prompt que preserve este ajuste en `agenda-operador.component.ts`.
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

### Ampliación de F09 — verificación en Windows y cierre

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

### Integración de la entrega de Santiago en Windows — 01/11/2026

- Antes del merge se resguardaron los 68 archivos del trabajo local en el commit `65f3854`. Se integró `origin/entrega-frontend-1`, commit `b2f8a71`, en `frontend-1`.
- Se resolvieron 17 archivos en conflicto, conservando las versiones probadas de D02, D03, D05, D06, D07 y F09 y combinando rutas, App/layout, modelos y servicios compartidos. El backend y la base habitual no se modificaron durante esta integración.
- Se conectaron Usuarios, Historial del médico, Perfil editable del paciente, Mis turnos y la pantalla independiente de Turnos del operador aportada por Santiago. Las versiones alternativas `agenda-medico` y `turnos-medico` se conservan como código recibido, pero las rutas médicas siguen usando `mi-agenda` y `turnos-programados`.
- Fue necesario adaptar Mis turnos al contrato B11: `tipo=proximos|todos`, paginación real de 20, totales del backend, vista Todos que también incluye próximos y consulta clínica por turno únicamente al abrir el detalle. Se conservaron presentación y confirmación de cancelación de la entrega recibida.
- Se combinaron los contratos de los servicios de turnos/agenda, se actualizaron llamadas al refresco de notificaciones y se admitió fecha de nacimiento nula en los componentes recibidos. El filtro nuevo por ID de entidad de Auditoría se aplica en el frontend porque el endpoint actual no lo admite.
- Build del frontend correcta con las advertencias conocidas. Pasaron 43 comprobaciones de integración con 34 peticiones a la API real y MySQL en una base temporal, eliminada al terminar: paginación y cancelación del paciente, historial por turno y reintentos, búsqueda e historial del médico, usuarios paginados, alta/edición de operador y edición del perfil con rechazo de email duplicado. No se cambió la contraseña en estas pruebas.
- Revisión visual sin escrituras en la base habitual: Mis turnos en ambas pestañas, resumen clínico al desplegar un atendido, campana que abre y cierra con Escape y lista administrativa de 28 usuarios en dos páginas. No se detectaron errores de consola en esas pantallas.
- Limitación recibida de D01 durante el merge: Usuarios bloqueaba la edición de médicos porque el detalle administrativo no devolvía sus especialidades. No se amplió el backend durante la integración; posteriormente se resolvió por pedido de Esteban agregando las especialidades a `GET /usuarios/:id` y precargándolas en el formulario.
- Los cambios de compatibilidad indicados arriba se realizaron en Windows para integrar la entrega. Antes de la próxima tarea en Ubuntu, releer esos archivos y conservar esta resolución; no reemplazarlos por las versiones previas del commit remoto.
- La integración se realiza localmente; no incluye push ni instalación de dependencias. El mantenimiento de Postman fase 03 se completó después de esta integración; ver la verificación integral indicada más abajo.

### Criterios ya acordados para D10

- **Próximos:** turnos confirmados cuya fecha y hora sean iguales o posteriores al momento de MySQL, del más cercano al más lejano.
- **Todos los turnos:** todos los turnos del paciente, incluidos los próximos, atendidos, cancelados y confirmados pasados; fecha, hora e ID descendentes.
- Sin filtros adicionales ni buscador. Cada pestaña envía `tipo=proximos` o `tipo=todos`, con páginas de 20 registros. Al cambiar de pestaña, volver a la página 1.
- Pedir el resumen clínico mediante `GET /turnos/:id/historial` solo al abrir el detalle de un turno atendido.
- Tras cancelar, actualizar los listados y totales: el turno deja Próximos y permanece en Todos los turnos con estado cancelado.

### Actualización integral de Postman en Windows — 01/11/2026

- Se actualizaron credenciales configurables, captura de IDs, contrato de atención/historial de fase 03 y ejemplos de edición sin DNI ni contraseña. Los logins de fases 02–04 usan las cuentas demo configurables.
- Se agregó `coleccion-contrato-actual-runner.json`, el verificador `verificar-colecciones.cjs` y la matriz `COBERTURA.md`. El verificador detecta JSON/scripts inválidos o rutas sin casos, prepara fixtures y ejecuta Newman en una base nueva por runner.
- Build del backend correcta. Los cinco runners pasaron: **572 peticiones y 804 aserciones**, nueve JSON válidos, 559 scripts válidos y casos para las 54 rutas actuales. Bases temporales y servidores eliminados al finalizar; base habitual y esquema intactos.
- Se detectó y documentó que borrar un usuario con asociaciones devuelve **500** por clave foránea. El caso de regresión está identificado como limitación existente; no se cambió el controlador ni se lo declara corregido.
- Se mantienen fuera del alcance las reservas simultáneas, superposición de agendas, cambios de esquema y fallos de infraestructura; el detalle de cobertura evita confundir pruebas HTTP con cobertura exhaustiva de código o UI.
- No se hicieron commits ni pushes ni hubo conflictos. En el siguiente prompt de Ubuntu, avisar que preserve los cambios de Postman/documentación realizados en Windows y el ajuste previo de `versionesTurnos`.

### Edición administrativa de médicos D01 — ajuste en Windows

- Por pedido explícito de Esteban se amplió GET /usuarios/:id: devuelve especialidades [{ id, descripcion }] para médicos, ordenadas por ID y sin duplicados, o [] para otros roles. Conserva permisos de administrador, campos públicos y errores existentes. No se modificaron rutas, esquema ni datos de la base habitual.
- El frontend retiró el bloqueo de médicos y precarga los IDs de especialidades devueltos. Se incorporó DetalleUsuarioAdmin con especialidades obligatorias, manteniendo el modelo del listado. El PUT conserva sus validaciones y restricciones.
- Builds del backend y frontend correctas; se conservan solo las advertencias conocidas de tamaño del bundle inicial y CSS de Reportes. Pasaron 54 comprobaciones de integración con 39 peticiones en una base temporal: precarga, edición, conservación de asignaciones y DNI, reapertura, validación de especialidad obligatoria y rechazo 409 sin perder el formulario. No se realizó una nueva revisión visual en navegador.
- Postman agrega seis casos del detalle/edición; pasaron los cinco runners actualizados: 578 peticiones y 816 aserciones. Nueve JSON y 565 scripts válidos. Documentación y matriz actualizadas.
- Bases temporales eliminadas y cambios previos preservados. Sin conflictos, commits ni pushes. En el próximo prompt de Ubuntu avisar que preserve estos cambios en usuarioController.ts, usuario-admin.model.ts, usuario-admin.service.ts, usuarios.component.ts, Postman y documentación, además del ajuste previo de versionesTurnos.
