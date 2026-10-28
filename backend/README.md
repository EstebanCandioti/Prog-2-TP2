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

Todas las respuestas usan el formato:

```json
{
  "codigo": 200,
  "estado": "ok",
  "datos": null
}
```
