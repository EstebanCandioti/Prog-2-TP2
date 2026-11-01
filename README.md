# Clínica Virtual - TP de Programación

Sistema de gestión de turnos médicos con backend Express/TypeScript, base MySQL/MariaDB y frontend Angular Material. Incluye acceso para administrador, médico, operador y paciente.

## Versiones utilizadas

| Herramienta | Versión |
| --- | --- |
| Node.js verificado en Windows | 22.19.0 |
| npm utilizado para instalar dependencias | 11.16.0 |
| Angular | 21.2.25 |
| Angular CLI | 21.2.26 |
| Angular Material y CDK | 21.2.14 |
| TypeScript | 5.9.3 |
| Librería de gráficos: Chart.js | 4.6.1 |

Chart.js se utiliza en los reportes administrativos para el gráfico de dona de turnos atendidos/cancelados y el gráfico de barras del ranking médico. Las dependencias de ambos proyectos están definidas en sus respectivos `package-lock.json`.

## Levantar el proyecto desde cero

Los comandos siguientes se ejecutan en PowerShell sobre Windows. Se necesitan Git, Node.js y un servidor MySQL/MariaDB en ejecución.

### 1. Obtener el repositorio

```powershell
git clone --branch entrega-frontend-1 https://github.com/EstebanCandioti/Prog-2-TP2.git
cd Prog-2-TP2
```

La rama de entrega utilizada por el grupo es `entrega-frontend-1`. Los pasos siguientes parten de la carpeta raíz del repositorio.

### 2. Preparar el backend y sus variables de entorno

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Editar `backend/.env` según la configuración local:

| Variable | Valor de ejemplo | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto de la API |
| `DB_HOST` | `localhost` | Dirección de MySQL |
| `DB_PORT` | `3306` | Puerto de MySQL |
| `DB_USER` | `root` | Usuario de conexión |
| `DB_PASSWORD` | Vacío si el usuario local no tiene contraseña | Contraseña de conexión |
| `DB_NAME` | `clinica` | Base de datos utilizada |
| `JWT_SECRET` | Definir una clave para el entorno local | Firma y validación de los tokens de sesión |

### 3. Crear la base y cargar los datos de prueba

1. Desde un cliente SQL, como phpMyAdmin o MySQL Workbench, importar **`backend/src/database/clinica.sql`**. El archivo crea y selecciona la base `clinica`; `DB_NAME` debe coincidir con ese nombre. Este paso se realiza al preparar una base nueva, no sobre una base ya utilizada.
2. Desde la terminal que quedó en `backend/`, generar las cuentas de prueba con sus contraseñas hasheadas:

```powershell
npm run seed:demo
```

3. En el cliente SQL, seleccionar esa misma base e importar **`backend/src/database/seed-b10.sql` completo, en una sola conexión**, para cargar agendas, turnos, historiales y notificaciones. El comando anterior prepara las cuentas; esta importación carga los datos relacionados.

El SQL B10 agrega 16 agendas, 20 turnos (12 confirmados, 4 cancelados y 4 atendidos), 4 historiales y 28 notificaciones. Hay tres médicos con distintas especialidades y el médico `90000004` atiende en dos sedes. Las fechas se calculan desde `@b10_fecha_base = CURDATE()` al comienzo del SQL. Repetir la carga con la misma fecha base no duplica datos. El procedimiento detallado está en [el README del backend](backend/README.md#datos-de-demostración-b10).

### 4. Iniciar el backend

Desde `backend/`:

```powershell
npm run dev
```

La API queda disponible en `http://localhost:3000`. Se puede consultar `http://localhost:3000/health` para comprobar la conexión con la base.

### 5. Preparar e iniciar el frontend

Abrir otra terminal en la raíz del repositorio:

```powershell
cd frontend
npm install
npm start
```

Abrir **`http://localhost:4200`**. El frontend se inicia mediante Angular CLI (`ng serve`). El backend y MySQL deben permanecer en ejecución.

La dirección de la API se configura en `frontend/src/environments/environment.ts`, mediante `apiUrl`, cuyo valor por defecto es `http://localhost:3000`. Si se cambia `PORT` en el backend, actualizar también esa dirección. El frontend no requiere un archivo `.env`.

## Usuarios de prueba

La contraseña de todas las cuentas demo es **`Demo2026!`**. Ingresar con DNI y contraseña; la navegación disponible depende del rol autenticado.

| Rol | DNI |
| --- | --- |
| Administrador | 90000001, 90000002, 90000003 |
| Médico | 90000004, 90000005, 90000006 |
| Operador | 90000007, 90000008, 90000009 |
| Paciente | 90000010, 90000011, 90000012 |

La pantalla de login también permite seleccionar estas cuentas para completar las credenciales.

## Volver a iniciar el proyecto

Con MySQL encendido y la instalación inicial completada, abrir dos terminales desde la raíz del repositorio.

Backend, en la primera terminal:

```powershell
cd backend
npm run dev
```

Frontend, en la segunda terminal:

```powershell
cd frontend
npm start
```

`npm start` del frontend ejecuta `ng serve`. Abrir `http://localhost:4200`.

## Documentación

- [Backend: configuración, datos de prueba y contratos de la API](backend/README.md).
- [Frontend: instalación y librería de gráficos](frontend/README.md).
- [Postman: ejecución de las pruebas y cobertura](backend/postman/README.md).
