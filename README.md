# Auditor de formulas de liquidacion

Sistema web para cargar archivos `.xlsx` de formulas de liquidacion de sueldos y generar un informe estatico de consistencia.

## Stack

- Node.js `18.14.x`
- Backend: TypeScript, Express, ExcelJS, Multer, Jest, Supertest.
- Frontend: Angular 15, Angular Material 15, Tailwind CSS, RxJS, formularios reactivos.

## Instalacion

Windows PowerShell:

```powershell
nvm use 18.14
npm install
```

## Ejecucion local

Terminal 1:

```powershell
npm run dev:backend
```

Terminal 2:

```powershell
npm run dev:frontend
```

URLs:

- Backend: `http://localhost:3000/api/health`
- Frontend: `http://localhost:4200`

El backend se levanta con heap ampliado (`4096 MB`) porque el analisis del Excel real consume mas memoria que el limite default de Node en Windows.

## Comandos

```powershell
npm run test
npm run lint
npm run build
```

## API

Estado:

```http
GET /api/health
```

Analisis:

```http
POST /api/validations
Content-Type: multipart/form-data

file=<archivo.xlsx>
```

Consulta:

```http
GET /api/validations/{validationId}
```

Descargas:

```http
GET /api/validations/{validationId}/export/json
GET /api/validations/{validationId}/export/csv
GET /api/validations/{validationId}/export/xlsx
```

## Documentacion

- [Analisis inicial](docs/analisis-inicial.md)
- [Arquitectura](docs/arquitectura.md)
- [Modelo de formulas](docs/modelo-formulas.md)
- [Reglas de validacion](docs/reglas-validacion.md)
- [Errores detectados en archivo de referencia](docs/errores-detectados-archivo-referencia.md)

## Limitaciones conocidas

- El repositorio de resultados es en memoria y vence por TTL configurable.
- `N[n]` e `I[n]` se validan contra conceptos porque no hay hoja explicita de novedades.
- La validacion de secuencia queda limitada cuando el Excel no exporta la columna `Secuentica`.
- Las versiones obligatorias mantienen dependencias antiguas con avisos de `npm audit`; no se subieron major versions para respetar Angular 15 y Multer indicado.
