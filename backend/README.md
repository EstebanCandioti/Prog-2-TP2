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
