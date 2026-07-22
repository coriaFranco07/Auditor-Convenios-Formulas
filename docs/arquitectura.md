# Arquitectura

## Vista general

El sistema funciona como un compilador estatico:

1. Recibe un `.xlsx`.
2. Valida extension, MIME y tamano.
3. Lee el workbook con ExcelJS.
4. Normaliza hojas, encabezados, filas y ubicaciones.
5. Tokeniza y parsea formulas.
6. Construye AST tipado y referencias.
7. Construye tablas de simbolos.
8. Ejecuta validadores independientes.
9. Construye grafo de dependencias.
10. Genera informe y exportaciones.

## Backend

La API esta separada en modulos:

- `config`: esquema centralizado y variables.
- `domain`: normalizacion, issue factory y tablas de simbolos.
- `parsers`: lenguaje de formulas.
- `services`: lectura y orquestacion.
- `validators`: reglas atomicas.
- `repositories`: persistencia desacoplada.
- `exporters`: JSON, CSV y XLSX marcado.
- `controllers/routes`: borde HTTP.

El repositorio actual es en memoria, implementa una interfaz y puede reemplazarse por MongoDB/PostgreSQL sin cambiar controladores.

## Frontend

Angular 15 usa un modulo principal con una feature `formula-validation`:

- `pages`: pantalla principal.
- `components`: upload, resumen, tabla y chips.
- `dialogs`: detalle del problema.
- `services`: cliente HTTP.
- `models`: contratos del backend.

No se usa NgRx; el estado del MVP es local a la pantalla y suficiente para filtros, resultado y descargas.

## Decisiones

- Los aliases de hojas y columnas se resuelven con normalizacion de tildes, mayusculas y espacios.
- Las reglas dependientes del formato viven en `schema.ts`.
- Las formulas Excel internas que empiezan con `=` se ignoran si no pertenecen al lenguaje de liquidacion.
- El XLSX original se conserva en memoria junto al resultado para poder generar la copia marcada sin modificar el archivo fuente.
- Los errores tecnicos de lectura producen estado `FAILED`; las inconsistencias bloqueantes producen `BLOCKED`.

