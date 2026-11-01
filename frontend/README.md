# Frontend - Clínica Virtual

Aplicación web desarrollada con Angular y Angular Material, sin SSR. La preparación completa del sistema, incluida la base de datos y las cuentas de los cuatro roles, está en el [README general](../README.md).

## Versiones utilizadas

- Node.js verificado en Windows: 22.19.0.
- npm utilizado para instalar dependencias: 11.16.0.
- Angular: 21.2.25.
- Angular CLI: 21.2.26.
- Angular Material y CDK: 21.2.14.
- TypeScript: 5.9.3.
- Chart.js: 4.6.1.

## Configuración

El frontend consulta la API configurada en `src/environments/environment.ts`:

```typescript
export const environment = {
  apiUrl: 'http://localhost:3000'
};
```

Esta dirección debe coincidir con el host y puerto del backend. El frontend no utiliza un archivo `.env`. MySQL y el backend deben estar en ejecución para utilizar la aplicación.

## Instalar y ejecutar

Desde esta carpeta (`frontend/`), en PowerShell:

```powershell
npm install
npm start
```

El script `start` ejecuta `ng serve`. Abrir `http://localhost:4200` e ingresar con una de las [cuentas de prueba](../README.md#usuarios-de-prueba).

## Librería de gráficos

Se utiliza **Chart.js 4.6.1**, importada desde `chart.js/auto`, para los reportes administrativos: dona de turnos atendidos/cancelados y barras del ranking de médicos por turnos atendidos. Está incluida en las dependencias del proyecto.

## Compilar

```powershell
npm run build
```

La salida se genera en `dist/frontend`.
