# Cobertura del contrato HTTP

Verificación en Windows del 01/11/2026. Código compilado con `npm.cmd run build`; ejecución con el comando del [README](README.md). Se usó MySQL real en bases temporales independientes, eliminadas al finalizar. No se modificaron datos ni esquema de la base habitual.

## Resultado reproducible

| Runner | Peticiones | Aserciones | Fallos |
| --- | ---: | ---: | ---: |
| coleccion-fase-01-runner.json | 9 | 18 | 0 |
| coleccion-fase-02-runner.json | 31 | 63 | 0 |
| coleccion-fase-03-runner.json | 19 | 39 | 0 |
| coleccion-fase-04-runner.json | 50 | 102 | 0 |
| coleccion-contrato-actual-runner.json | 469 | 594 | 0 |
| **Total** | **578** | **816** | **0** |

Los nueve JSON y sus 565 scripts son válidos. Hay casos para las **54 rutas declaradas** del backend. Las cifras cuentan ejecuciones de requests y aserciones de Postman, no líneas de código ni porcentaje de cobertura interna.

## Escenarios

| Área | Comprobaciones |
| --- | --- |
| Autenticación | Login de cuatro roles, registro público que fuerza paciente, duplicados por DNI/email, campos faltantes, credenciales incorrectas y perfil. JWT ausente, malformado, vencido o de usuario eliminado. |
| Autorización | Cada ruta protegida sin token; rechazo de cada rol no permitido. El JWT anterior toma sede y rol actuales de la base después de una edición. |
| Catálogos | CRUD válido, listados autenticados por cuatro roles, cobertura pública, ID inválido/inexistente, alta incompleta y eliminación con relaciones. |
| B01 médicos | Cuatro roles, DTO mínimo, ausencia de duplicados, médico sin agenda, filtros individuales/combinados sobre la misma agenda, resultado vacío, filtros inválidos/repetidos/estructurados. |
| B02 usuarios | Altas admin/operador/médico, campos y relaciones según rol, duplicados, datos inválidos, edición, cambio de rol libre/bloqueado y eliminación. GET por ID devuelve especialidades médicas o [] para otros roles; alta y edición conservan el mismo campo. Se comprueba privacidad y conservación de las especialidades al editar otros datos. |
| B03 listados | Más de 20 usuarios y pacientes, dos páginas sin IDs repetidos, página vacía, búsquedas por nombre/apellido/nombre completo, DNI exacto, rol/sede y página inválida/no segura. |
| B04 perfil | Modificación parcial, conservación de campos omitidos, email/cobertura/password, login con password nueva y rechazo de la anterior, duplicados y campos desconocidos. |
| B05 agendas | Propiedad del médico, consulta de otra sede por operador, escritura solo en sede propia, operador sin sede, nombres junto a IDs, CRUD por ambos roles, fechas/horas/relaciones inválidas, restricciones con confirmados y ampliación permitida. |
| B06 disponibilidad | Fechas con agenda, DTO de horarios, bloques de 20 minutos completos, reserva válida/ocupada/no alineada/incompleta, nota obligatoria, paciente del token, cobertura actual, liberación tras cancelar. |
| B07 turnos | Fecha obligatoria/válida, médico y sede autenticados, filtros opcionales, DTO de paciente/edad calculable, consulta y gestión fuera de sede principal del médico, cancelación propia/ajena/repetida. |
| B08 atención e historial | Diagnóstico obligatorio, tipos/longitudes de campos clínicos, rechazo sin cambiar el estado, atención que crea historial, repetición/duplicación, médico ajeno, turno inexistente/cancelado, POST separado sobre atendido sin historial, consulta clínica propia o del médico tratante. |
| B09 dependencias | Especialidad con médicos o agendas, cobertura conservada por turnos históricos aunque ningún usuario la use, sede referenciada; rechazos 409 previstos. |
| B11 paciente | Próximos/Todos/default, 20 por página, segunda página sin duplicados, página vacía, parámetros inválidos, turnos propios y detalle clínico por ID con 400/403/404/409 según propiedad y estado. |
| F09 notificaciones | Listado propio en cuatro roles, marcado individual, ID inválido/inexistente/ajeno, más de diez pendientes, masivo con cantidad exacta, repetición 0 y conservación de pendientes de otra cuenta. |
| Auditoría | Generación por operaciones, filtros por autor/entidad/acción, alias estado, acción inválida y resultado vacío. El ID de entidad continúa siendo un filtro local del frontend. |
| Reportes | Cuatro respuestas y DTOs actuales, suma por sede/especialidad igual al total de turnos, tasa calculada sobre el total y rango sin datos sin divisiones por cero. |
| HTTP | Envelope uniforme, JSON inválido 400 y ruta inexistente 404. |

## Presencia por ruta

Los conteos incluyen casos positivos y negativos de los cinco runners; una misma ruta puede aparecer en varias fases. El verificador vuelve a contrastar este inventario contra los archivos de rutas al ejecutarse. La presencia de una ruta no implica que se hayan probado todas sus combinaciones de entradas.

| Método | Ruta | Requests definidos |
| --- | --- | ---: |
| DELETE | `/agendas/:id` | 10 |
| GET | `/agendas/:id` | 9 |
| PUT | `/agendas/:id` | 15 |
| GET | `/agendas` | 8 |
| POST | `/agendas` | 20 |
| GET | `/auditoria` | 11 |
| POST | `/auth/login` | 26 |
| GET | `/auth/perfil-admin` | 6 |
| GET | `/auth/perfil-paciente` | 5 |
| GET | `/auth/perfil` | 11 |
| POST | `/auth/registro` | 8 |
| GET | `/coberturas-disponibles` | 4 |
| DELETE | `/coberturas/:id` | 7 |
| GET | `/coberturas/:id` | 8 |
| PUT | `/coberturas/:id` | 6 |
| GET | `/coberturas` | 7 |
| POST | `/coberturas` | 7 |
| DELETE | `/especialidades/:id` | 8 |
| GET | `/especialidades/:id` | 8 |
| PUT | `/especialidades/:id` | 6 |
| GET | `/especialidades` | 7 |
| POST | `/especialidades` | 7 |
| GET | `/health` | 5 |
| GET | `/historial-clinico/paciente/:id_paciente` | 11 |
| POST | `/historial-clinico` | 13 |
| GET | `/medicos/:id/fechas-disponibles` | 7 |
| GET | `/medicos/:id/turnos-disponibles` | 7 |
| GET | `/medicos` | 16 |
| PATCH | `/notificaciones/:id/leida` | 7 |
| PATCH | `/notificaciones/leidas` | 6 |
| GET | `/notificaciones` | 10 |
| GET | `/pacientes` | 19 |
| GET | `/reportes/ranking-medicos` | 7 |
| GET | `/reportes/tasa-cancelacion` | 7 |
| GET | `/reportes/turnos-por-especialidad` | 7 |
| GET | `/reportes/turnos-por-sede` | 7 |
| DELETE | `/sedes/:id` | 7 |
| GET | `/sedes/:id` | 8 |
| PUT | `/sedes/:id` | 6 |
| GET | `/sedes` | 7 |
| POST | `/sedes` | 7 |
| PATCH | `/turnos/:id/atender` | 18 |
| PATCH | `/turnos/:id/cancelar` | 12 |
| GET | `/turnos/:id/historial` | 11 |
| GET | `/turnos/medico` | 14 |
| GET | `/turnos/mis-turnos` | 21 |
| GET | `/turnos/sede` | 17 |
| POST | `/turnos` | 18 |
| DELETE | `/usuarios/:id` | 7 |
| GET | `/usuarios/:id` | 13 |
| PUT | `/usuarios/:id` | 16 |
| PATCH | `/usuarios/mi-perfil` | 15 |
| GET | `/usuarios` | 26 |
| POST | `/usuarios` | 21 |

## Limitaciones y pendientes explícitos

- **Borrado de usuarios asociados:** actualmente devuelve 500 por clave foránea. El caso identificado como `LIMITACION actual` comprueba y expone este resultado existente; no lo considera una mejora ni lo confunde con el 409 implementado para especialidades/coberturas. Corregirlo requiere una tarea de backend.
- No se probaron reservas simultáneas ni prevención de agendas superpuestas, que quedaron fuera del alcance acordado. La prueba secuencial de horario ocupado no garantiza exclusión mutua.
- No se agregó ninguna restricción de unicidad a la base habitual. Se prueba el rechazo de historial duplicado a nivel de aplicación, usando la estructura realmente instalada.
- No se provocaron fallos internos de MySQL, auditoría o notificaciones ni se inyectaron errores de escritura para demostrar rollback. La atención válida y los rechazos de validación/propiedad/estado se comprueban por HTTP; esto no certifica todos los escenarios de caída.
- No se ejecuta el seed B10 ni se prueban sus reglas de idempotencia en este comando. Los datos controlados pertenecen solo a las bases temporales.
- La apariencia, accesibilidad, diseño adaptable, temporizadores del frontend y validaciones exclusivas de pantalla quedan fuera de Postman. Mantienen sus verificaciones independientes de Windows.

## Verificación adicional de la edición de médicos en el frontend

Se ejecutaron 54 comprobaciones de integración con 39 peticiones, usando componentes y servicios Angular reales contra la API y MySQL en una base temporal. Se comprobaron apertura y precarga de sede/especialidades, guardado de nombre/teléfono conservando especialidades y DNI, reapertura con datos persistidos, bloqueo del envío sin especialidades y conservación del formulario/asignaciones ante el 409 por quitar una especialidad usada. Incluye la regresión de listado administrativo, edición de operador, perfil del paciente e historial/turnos integrados. Estas cifras son independientes de las aserciones Postman de la tabla. No se realizó una nueva revisión visual en navegador en esta tarea.
