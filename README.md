# Clínica Virtual - TP de Programación

Proyecto con backend Express/TypeScript, MySQL/MariaDB y frontend Angular Material.
La rama de trabajo entregada actualmente es `entrega-frontend-1`.

## Preparar otra PC

1. Actualizar la rama `entrega-frontend-1` y levantar MySQL. Los comandos siguientes se ejecutan en Windows, desde la carpeta del repositorio.
2. Preparar el backend en una terminal:

```powershell
cd backend
npx -y npm@11.16.0 ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Revisar `backend/.env`: host, puerto, usuario, contraseña y nombre de la base. El puerto esperado de MySQL es `3306` y el backend usa `3000`. También debe estar definido `JWT_SECRET`.

3. Si la base todavía no existe, importar `backend/src/database/clinica.sql`, que crea la base `clinica`. Si ya existe, conservarla: no reimportar el esquema para cargar datos demo. Este seed no necesita agregar índices ni cambiar restricciones.
4. Desde `backend`, crear las cuentas:

```powershell
npm.cmd run seed:demo
```

Después importar **`backend/src/database/seed-b10.sql`** en esa misma base. El procedimiento, los escenarios y la repetición de la carga están explicados en [el README del backend](backend/README.md#datos-de-demostración-b10).

5. Iniciar el backend:

```powershell
npm.cmd run dev
```

6. Abrir otra terminal en la raíz del repositorio y preparar el frontend:

```powershell
cd frontend
npx -y npm@11.16.0 ci
npm.cmd start
```

Abrir `http://localhost:4200`. El frontend consulta `http://localhost:3000`, configurable en `frontend/src/environments/environment.ts`.

## Cuentas y datos demo

La contraseña de todas las cuentas demo es **`Demo2026!`**.

| Rol | DNI |
| --- | --- |
| Administrador | 90000001, 90000002, 90000003 |
| Médico | 90000004, 90000005, 90000006 |
| Operador | 90000007, 90000008, 90000009 |
| Paciente | 90000010, 90000011, 90000012 |

El SQL B10 agrega 16 agendas, 20 turnos (12 confirmados, 4 cancelados y 4 atendidos), 4 historiales y 28 notificaciones. El médico `90000004` atiende en dos sedes. Las fechas se calculan desde la fecha base indicada al comienzo del SQL.

## Notas para trabajar en equipo

- En Windows se verificaron Node `22.19.0` y las builds de ambos proyectos. El frontend declara npm `11.16.0`; usar el comando `npx` indicado evita el error `edgesOut` encontrado con npm global `10.9.3`.
- Las dependencias de Angular Material y Chart.js ya están declaradas: no instalarlas por separado. Cada carpeta tiene su propio `package-lock.json`.
- No compartir `node_modules`, `dist` ni `.env` entre Windows y Ubuntu. Cada equipo configura su `.env`; las dependencias para ejecutar y probar este proyecto compartido se mantienen en Windows.
- No todas las pantallas están implementadas. Las rutas provisionales no indican un fallo en la carga de datos. Reportes permite revisar las estadísticas, y las pantallas administrativas ya incluyen sedes, especialidades, coberturas y auditoría.
- La restricción única propuesta para el historial clínico no se aplicó a la base local existente. El SQL B10 no la aplica; los cambios de esquema se mantienen pendientes de acuerdo del grupo.

Más información: [backend](backend/README.md) y [frontend](frontend/README.md).
