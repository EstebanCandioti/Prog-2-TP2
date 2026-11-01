# Colecciones de Postman

Esta carpeta tiene dos tipos de colecciones:

- `coleccion-fase-01.json`, `coleccion-fase-02.json`, `coleccion-fase-03.json` y `coleccion-fase-04.json`: sirven como documentacion de los endpoints de cada semana.
- `coleccion-fase-01-runner.json`, `coleccion-fase-02-runner.json`, `coleccion-fase-03-runner.json` y `coleccion-fase-04-runner.json`: sirven para ejecutar las pruebas en orden con la opcion **Run** de Postman.

## Como usar los runners

1. Importar la coleccion runner en Postman.
2. Seleccionar la coleccion.
3. Presionar **Run**.
4. Ejecutar todas las requests en el orden en el que aparecen.

Los runners ya tienen variables y scripts internos para guardar tokens e ids generados durante la ejecucion. Por eso no hace falta copiar manualmente el token del login ni los ids de los registros creados.

## Permisos de catálogos

| Rutas | Token requerido | Rol permitido |
| --- | --- | --- |
| `GET /coberturas-disponibles` | No | Público |
| `GET /sedes`, `GET /especialidades`, `GET /coberturas` | Sí | Cualquier rol autenticado |
| `GET /medicos` | Sí | Administrador, médico, operador o paciente |
| `GET /sedes/:id`, `GET /especialidades/:id`, `GET /coberturas/:id` | Sí | Administrador |
| `POST`, `PUT`, `DELETE` de esos tres catálogos | Sí | Administrador |

Las colecciones documentales muestran ejemplos de listados con token de operador y de operaciones restringidas con token de administrador.

## Listado de médicos (B01)

La carpeta **Médicos para selección (B01)** de `coleccion-fase-04.json` documenta el listado completo, los filtros por especialidad y sede, y la combinación de ambos. Usa ejemplos con los cuatro roles. El operador puede consultar otra sede; cuando se combinan filtros, debe existir una agenda en esa sede para esa misma especialidad. La respuesta conserva todas las especialidades asignadas y solo incluye ID, nombre y apellido del médico, además de esas especialidades.

El caso de médico sin agenda usa el listado sin `id_sede` y requiere un médico existente en esa condición; no carga datos. También se incluyen un resultado vacío `200`, filtros inválidos, repetidos o estructurados `400`, y token ausente o inválido `401`. Los ejemplos son de lectura y no forman parte de los runners que crean datos temporales. La verificación funcional queda pendiente en Windows.

## Turnos del paciente e historial por turno (B11)

La carpeta **Paciente: turnos e historial (B11)** de `coleccion-fase-04.json` incluye `tipo=proximos`, `tipo=todos`, valores por defecto, segunda página, página sin resultados, errores de consulta y ejemplos de historial propio, ajeno, inexistente, no atendido y atendido sin historial. Los casos clínicos requieren configurar IDs de turnos existentes del paciente autenticado o de otro paciente según el ejemplo; no preparan ni cargan datos.

`GET /turnos/mis-turnos` devuelve ahora `datos.items` y los metadatos `total`, `pagina` y `limite` (20). Las consultas existentes de fases 03 y 04, incluidos ambos runners, conservan sus casos y agregan comprobaciones del nuevo formato. El total corresponde al tipo solicitado; sin coincidencias o en una página posterior se espera `items: []`. El momento de corte de los próximos proviene de MySQL.

El futuro frontend enviará `tipo` y `pagina` por pestaña: `proximos` para los confirmados vigentes y `todos` para el listado completo, que también incluye próximos. El historial se consulta aparte con `GET /turnos/:id/historial`, exclusivo de pacientes. Los demás roles reciben `403`; sin token válido, `401`. El backend se verificó en Windows mediante build y pruebas HTTP con MySQL en una base temporal. Se validaron los ocho JSON de Postman y la sintaxis de sus scripts; no se ejecutaron los runners completos.

Limitación preexistente: la fase 03 todavía contiene atención sin cuerpo clínico y una creación separada de historial esperada como `201`, anteriores al contrato de B08. Se conservaron esos casos en esta entrega; la adaptación de `mis-turnos` a B11 no corrige esos pasos y el runner completo de fase 03 requiere revisarlos antes de ejecutarlo con la API actual.

## Notificaciones: marcado masivo (F09)

La carpeta **Notificaciones / Marcado masivo (F09)** de `coleccion-fase-04.json` documenta `PATCH /notificaciones/leidas`. Requiere `Authorization: Bearer <token>` de cualquier rol autenticado, sin cuerpo ni ID de usuario del cliente. Responde `200` con `datos: { "cantidad_actualizada": N }`, donde N es la cantidad de pendientes propias actualizadas; sin pendientes devuelve 0. Se conserva el endpoint individual.

Los ejemplos están numerados para verificar pendientes propias, consulta posterior sin pendientes, repetición con cantidad 0, aislamiento de otro usuario y rechazo `401` sin token o con token inválido. Usan `paciente_token` como cuenta A y `medico_token` como cuenta B; deben pertenecer a usuarios distintos. A debe tener pendientes antes de empezar. Para comprobar que las pendientes de B también se conservan, usar una cuenta B que las tenga. Las consultas guardan las capturas y el recuento esperado en variables de colección. Se pueden cambiar ambos tokens por los de otros roles autenticados.

Ejecutar únicamente en Windows sobre una base de prueba controlada, sin operaciones concurrentes que generen notificaciones entre las capturas. Estos ejemplos **sí marcan registros existentes**, no crean ni eliminan datos y no se añadieron a los runners generales para evitar marcar en masa sus notificaciones históricas. Si se repite toda la carpeta, el primer caso vuelve a requerir pendientes propias. Los scripts se entregan sin ejecutar desde Ubuntu.

## Verificacion de pruebas

Cada runner incluye codigo de verificacion en la seccion **Tests** de Postman.

Ese codigo revisa principalmente:

- que cada request devuelva el codigo HTTP esperado;
- que la respuesta tenga el formato definido para el proyecto:

```json
{
  "codigo": 200,
  "estado": "ok",
  "datos": {}
}
```

Si una prueba negativa devuelve el error esperado, Postman la marca como correcta. Por ejemplo:

- registro duplicado: `409`;
- token ausente o invalido: `401`;
- rol no permitido: `403`;
- recurso inexistente: `404`.

En la colección de fase 04, la atención de un turno incluye los campos clínicos en el cuerpo de `PATCH /turnos/:id/atender`. También se documentan los rechazos por datos clínicos inválidos, turno ajeno, estado incompatible e historial duplicado. El runner comprueba que `POST /historial-clinico` responda `409` al intentar volver a cargar el historial creado durante la atención.

La misma colección incluye los rechazos `409` al eliminar una especialidad usada por agendas y una cobertura conservada por turnos aunque ya no esté asignada a ningún usuario. Esos ejemplos usan variables configurables para apuntar a registros que cumplan cada condición sin alterar relaciones desde Postman.

De esta forma, al terminar el **Run**, Postman muestra cuales pruebas pasaron y cuales fallaron.

## Importante

Los runners crean datos temporales en la base de datos para poder probar altas, modificaciones, turnos, historiales, auditoria y reportes.

Algunos datos se eliminan durante el mismo runner, pero otros pueden quedar guardados porque son necesarios para mantener relaciones con auditoria, turnos o historiales clinicos.
