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
| `GET /sedes/:id`, `GET /especialidades/:id`, `GET /coberturas/:id` | Sí | Administrador |
| `POST`, `PUT`, `DELETE` de esos tres catálogos | Sí | Administrador |

Las colecciones documentales muestran ejemplos de listados con token de operador y de operaciones restringidas con token de administrador.

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
