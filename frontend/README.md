# Frontend - Clínica Virtual

Aplicación web de la clínica desarrollada con Angular 21 y Angular Material 21. No utiliza SSR.

## Versiones

- Node.js: 24.19.0 (versión usada para verificar el proyecto; Angular 21 también admite Node 22.12 o superior).
- Angular CLI: 21.2.26.
- Angular: 21.2.25.
- Angular Material y CDK: 21.2.14.
- TypeScript: 5.9.3.
- npm: 11.16.0.

## Requisitos

Instalar Node.js 24 LTS o Node.js 22.12 LTS o superior. El backend debe estar levantado con MySQL y CORS habilitado para `http://localhost:4200`.

La URL del backend se configura en un único lugar: `src/environments/environment.ts` (por defecto, `http://localhost:3000`).

## Instalar y ejecutar

Desde esta carpeta (`frontend`), ejecutar en PowerShell:

```powershell
npx -y npm@11.16.0 ci
npm start
```

Abrir `http://localhost:4200`. Para que funcionen login, registro, perfil y coberturas, iniciar también el backend según las instrucciones de `../backend/README.md` y configurar `../backend/.env`.

## Funcionalidad de esta etapa

- Portada pública y layout con navegación por rol, notificaciones visuales, cierre de sesión y footer.
- Registro de pacientes con validaciones y coberturas cargadas desde `GET /coberturas-disponibles`.
- Inicio de sesión con `POST /auth/login`, sesión persistida en el navegador y token enviado en las peticiones protegidas.
- Perfil obtenido desde `GET /auth/perfil`.
- Rutas protegidas para administrador, médico, operador y paciente; páginas para acceso denegado, ruta inexistente y secciones aún en construcción.

## Verificación

```powershell
npm run build
npm test -- --watch=false
```

El footer enlaza al Instagram institucional `iessantafe`, al sitio oficial de WhatsApp y a Gmail.