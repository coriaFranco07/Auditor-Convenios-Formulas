# Backend

API REST para analizar workbooks `.xlsx` de formulas de liquidacion.

## Comandos

```powershell
npm run dev --workspace backend
npm run build --workspace backend
npm run test --workspace backend
npm run lint --workspace backend
```

`npm run dev --workspace backend` y `npm run start --workspace backend` usan `--max-old-space-size=4096` para evitar caidas por heap al analizar workbooks grandes.

## Endpoints

- `GET /api/health`
- `POST /api/validations`
- `GET /api/validations/:validationId`
- `GET /api/validations/:validationId/export/json`
- `GET /api/validations/:validationId/export/csv`
- `GET /api/validations/:validationId/export/xlsx`

## Configuracion

Variables:

- `PORT`: puerto HTTP. Default `3000`.
- `UPLOAD_DIR`: carpeta temporal de Multer. Default `tmp/uploads`.
- `MAX_UPLOAD_MB`: limite de archivo. Default `10`.
- `VALIDATION_TTL_MS`: vencimiento de resultados en memoria. Default `3600000`.

## Arquitectura interna

- `config/schema.ts`: esquema centralizado de hojas, aliases, columnas y catalogos.
- `parsers/`: tokenizer, parser Pratt/recursivo, AST e inferencia de tipos.
- `services/excel-reader.service.ts`: lectura ExcelJS, normalizacion, tablas base y celdas de formulas.
- `validators/`: reglas independientes.
- `repositories/`: interfaz y repositorio en memoria.
- `exporters/`: JSON, CSV y copia XLSX marcada.
- `controllers/` y `routes/`: API Express.

El backend no usa `eval` ni `new Function`; nunca ejecuta formulas del Excel.
