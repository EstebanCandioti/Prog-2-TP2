# Backlogs del frontend y backend

Estado acordado al 29/10/2026. Cada tarea de pantalla incluye vista, estilos, lógica, modelos y servicio necesarios, ruta, validaciones y estados de carga, vacío y error. La división busca tareas completas sin abarcar un módulo entero.

## Estados y responsables

- **Hecha:** Esteban confirmó que terminó la tarea.
- **Pendiente:** todavía no se informó su finalización.
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
| F09 | Campana y listado de notificaciones | Contador de no leídas, orden por fecha, marcado como leída y estados vacío/error. Consultar al iniciar sesión, abrir la campana y volver a la pestaña; refrescar cada dos minutos solo con sesión y pestaña visibles. | Esteban | Pendiente |

**F07 — Paciente / Mis turnos** salió de este backlog y pasó a **D10**. La paginación y el detalle clínico por turno requieren primero **B11**. F03 y F04 pueden desarrollarse con la API actual; los rechazos controlados de algunas bajas dependen de B09.

## Backlog 2 — Cambios del backend

Cada tarea incluye rutas, permisos, validaciones, respuestas uniformes, casos de error y actualización de Postman. Las URL nuevas se acuerdan antes de implementarlas.

| ID | Tarea | Resultado esperado | Estado |
| --- | --- | --- | --- |
| B01 | Datos para seleccionar sedes, especialidades y médicos | Lecturas para usuarios autenticados; médicos con sus especialidades, filtrables por especialidad y sede, sin exponer datos innecesarios. | Pendiente |
| B02 | Alta y edición administrativa de usuarios | Crear operador, médico y admin; reglas de sede por rol; asignar y editar especialidades médicas; contraseñas hasheadas y auditoría. | Pendiente |
| B03 | Consultas de usuarios y búsqueda de pacientes | Listado con filtros y paginación; búsqueda de pacientes por DNI o apellido con permisos de operador, médico y admin. | Pendiente |
| B04 | Edición del perfil propio del paciente | Permitir solo email, contraseña, teléfono y cobertura; comprobar email único y hashear la contraseña nueva. | Pendiente |
| B05 | Reglas y datos de agenda | Operador limitado a su sede; médico a su agenda y especialidades; validar rangos y solapamientos; proteger turnos confirmados; devolver datos legibles. | Pendiente |
| B06 | Consulta de disponibilidad | Fechas con agenda y horarios libres por médico, especialidad y sede; duración de turno coherente con la reserva. | Pendiente |
| B07 | Listados y permisos de turnos | Incluir nombre y fecha de nacimiento del paciente en turnos médicos; contemplar las sedes donde atiende el médico y filtros para médico y operador. | Pendiente |
| B08 | Reserva y atención de turnos | Evitar dobles reservas simultáneas; guardar historial al atender sin estados inconsistentes; revisar destinatarios de notificaciones. | Pendiente |
| B09 | Bajas controladas de catálogos con dependencias | Devolver un rechazo claro al intentar borrar especialidades o coberturas en uso, en vez de un error `500` por clave foránea. | Pendiente |
| B10 | Datos de prueba reproducibles | Tres médicos de distintas especialidades, uno en varias sedes, turnos en los tres estados y cuentas utilizables para los cuatro roles. | Pendiente |
| B11 | Consulta paginada de turnos del paciente y detalle clínico por turno | Vistas Próximos e Historial con filtros, orden y total por página; consultar el resumen clínico de un turno atendido por su ID y con permisos del paciente. | Pendiente |

Las cuentas de demostración creadas hasta ahora no alcanzan por sí solas para dar B10 por terminada. Antes de B06 y B08 hay que acordar una duración única para los turnos; la propuesta inicial fue **30 minutos**.

## Backlog 3 — Frontend dependiente del backend

| ID | Tarea | Depende de | Estado |
| --- | --- | --- | --- |
| D01 | Administrador / Usuarios: listado filtrado y paginado, alta y edición con sede y especialidades. | B01, B02, B03 | Dependiente |
| D02 | Médico / Mi agenda: consulta por día y CRUD de rangos. | B01, B05 | Dependiente |
| D03 | Médico / Turnos programados: paciente, edad, filtro de sede, atención con historial y cancelación. | B07, B08 | Dependiente |
| D04 | Médico / Historial clínico: búsqueda del paciente y visualización de sus registros. | B03, B08 | Dependiente |
| D05 | Operador / Agenda y turnos de su sede: filtros, alta y edición de agenda, consulta y cancelación de turnos. | B01, B05, B07 | Dependiente |
| D06 | Paciente / Nuevo turno: flujo reutilizable por pasos, opciones filtradas, resumen y recuperación si se ocupa el horario. | B01, B06, B08 | Dependiente |
| D07 | Operador / Asignar turno: reutilizar el flujo de reserva, buscar paciente y fijar la sede del operador. | B03, D06 | Dependiente |
| D08 | Paciente / Mis datos editables: campos permitidos y confirmación de cambio de contraseña. | B04 | Dependiente |
| D09 | README y recorrido de defensa: arranque desde cero, versiones, datos de prueba, librería de gráficos y recorrido de los cuatro roles. | B10 y pantallas terminadas | Dependiente |
| D10 | Paciente / Mis turnos: pestañas Próximos e Historial con consultas paginadas, estados visibles, detalle, resumen clínico de atendidos y cancelación confirmada. | B11 | Dependiente |

### Criterios ya acordados para D10

- **Próximos:** turnos confirmados futuros, del más cercano al más lejano.
- **Historial:** atendidos, cancelados y confirmados cuya fecha ya pasó, del más reciente al más antiguo.
- Cargar cada pestaña por separado y pedir el resumen clínico solo al abrir el detalle de un turno atendido.
- Tras cancelar, actualizar las vistas para que el turno deje Próximos y aparezca en Historial.
