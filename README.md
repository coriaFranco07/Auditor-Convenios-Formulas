# Auditor Convenios Formulas

Sistema web para auditar archivos Excel `.xlsx` de formulas de liquidacion de sueldos de e-Sueldos. Permite cargar un Excel, analizar conceptos, formulas, auxiliares, variables, acumuladores y convenios, revisar hallazgos por modulo, consultar historial, descargar reportes y exportar el Excel marcado.

## Objetivo

El sistema no busca calcular sueldos. Su funcion es auditar la planilla de formulas antes de cargarla o usarla en otro sistema.

Detecta problemas tecnicos y funcionales:

- Referencias inexistentes como `A[]`, `R[]`, `U[]`, `L[]`, `N[]` o `I[]`.
- Duplicados iguales o conflictivos.
- Formulas con sintaxis invalida.
- Condiciones mal ubicadas o que no devuelven verdadero/falso.
- Dependencias circulares y autorreferencias.
- Coherencia entre formulas mensuales, jornales, unidades, condiciones, pre-formulas y post-formulas.
- Auxiliares de tipo formula, acumulador o valor fijo segun el PDF funcional.
- Acumuladores con componentes inexistentes, operaciones repetidas o contradictorias.
- Textos cargados en columnas donde el PDF espera formulas.
- Posibles reemplazos para referencias inexistentes.
- Explicacion humana de hallazgos con Gemini, si esta configurado.

## Stack y versiones

| Capa | Tecnologia | Version |
| --- | --- | --- |
| Runtime | Node.js | `18.14.x` |
| Package manager | npm | `9.x` |
| Monorepo | npm workspaces | root, backend, frontend |
| Backend | Express | `4.18.2` |
| Backend | TypeScript | `4.9.5` |
| Backend | ExcelJS | `4.4.0` |
| Backend | Multer | `1.4.5-lts.1` |
| Backend | MongoDB driver | `^5.9.2` |
| Backend tests | Jest | `29.7.0` |
| Frontend | Angular | `15.2.x` |
| Frontend UI | Angular Material/CDK | `15.2.x` |
| Frontend styles | Tailwind CSS | `3.4.3` |
| Frontend reactive | RxJS | `7.8.1` |

Version fijada en `.nvmrc`:

```text
18.14
```

## Estructura del proyecto

```text
auditor-formulas/
  backend/       API Express, lectura Excel, validadores, exportadores, MongoDB
  frontend/      Angular, pantalla de carga, historial, traductor y hallazgos
  docs/          documentacion funcional y tecnica
  referencias/   archivos de referencia del proyecto
  tools/         scripts auxiliares de inspeccion
```

## Variables de entorno

Crear un archivo `.env` en la raiz del proyecto tomando como base `.env.example`.

Importante: `.env` esta ignorado por Git y no debe subirse a GitLab.

```env
PORT=3000
UPLOAD_DIR=backend/tmp/uploads
MAX_UPLOAD_MB=10
VALIDATION_TTL_MS=31536000000

MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DATABASE=auditor_formulas
MONGO_COLLECTION=analyses

FRONTEND_API_URL=http://localhost:3000/api

GEMINI_ENABLED=true
GEMINI_API_KEY=
GEMINI_API_ENDPOINT=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODELS=gemini-3-flash-preview,gemini-3.1-flash-lite,gemini-2.5-flash,gemini-2.5-flash-lite
GEMINI_TIMEOUT_MS=15000
```

### Variables principales

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto del backend. Default: `3000`. |
| `UPLOAD_DIR` | Carpeta temporal para archivos subidos. |
| `MAX_UPLOAD_MB` | Tamano maximo permitido por Excel. Default: `10`. |
| `VALIDATION_TTL_MS` | Tiempo de vida de los analisis guardados. |
| `MONGO_URI` | Conexion a MongoDB. Si no se configura o se usa `MONGO_ENABLED=false`, el sistema usa memoria. |
| `MONGO_DATABASE` | Base de datos. Se crea automaticamente al primer analisis. |
| `MONGO_COLLECTION` | Coleccion donde se guardan los analisis. |
| `GEMINI_ENABLED` | Activa/desactiva explicaciones IA. |
| `GEMINI_API_KEY` | Clave de Gemini. No subir al repositorio. |
| `GEMINI_MODELS` | Modelos que se intentan usar en orden. |

## MongoDB Compass

Para usar historial persistente:

1. Instalar o levantar MongoDB.
2. Abrir MongoDB Compass.
3. Conectarse a:

```text
mongodb://127.0.0.1:27017
```

4. Configurar en `.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DATABASE=auditor_formulas
MONGO_COLLECTION=analyses
```

La base `auditor_formulas` y la coleccion `analyses` se crean automaticamente cuando se guarda el primer analisis.

Si no se quiere usar MongoDB:

```env
MONGO_ENABLED=false
```

En ese caso el historial queda en memoria y se pierde al reiniciar el backend.

## Gemini

Gemini es opcional. Se usa para explicar hallazgos en lenguaje mas humano para una persona contable o funcional.

Para activarlo:

```env
GEMINI_ENABLED=true
GEMINI_API_KEY=colocar_clave_real
```

Si no hay clave, el sistema sigue funcionando igual, pero no genera explicaciones IA.

## Instalacion local

Windows PowerShell:

```powershell
nvm use 18.14
npm install
```

Si no se usa `nvm`, instalar Node.js `18.14.x` manualmente.

## Ejecutar en desarrollo

Terminal 1, backend:

```powershell
npm run dev:backend
```

Terminal 2, frontend:

```powershell
npm run dev:frontend
```

URLs locales:

```text
Backend health: http://localhost:3000/api/health
Frontend:       http://localhost:4200
```

El backend de desarrollo usa heap ampliado de Node (`4096 MB`) para evitar errores de memoria al analizar Excel grandes.

## Build y ejecucion productiva

Compilar todo:

```powershell
npm run build
```

Levantar backend compilado:

```powershell
npm run start --workspace backend
```

Salida del frontend:

```text
frontend/dist/auditor-formulas
```

Esa carpeta se puede servir con Nginx, IIS, Apache u otro servidor estatico. Si se sirve Angular con rutas internas, configurar fallback a `index.html`.

Nota para despliegue: `frontend/src/environments/environment.prod.ts` tiene por defecto:

```ts
apiUrl: 'http://localhost:3000/api'
```

Si el backend productivo usa otra URL, cambiar ese valor antes de ejecutar `npm run build`.

## Comandos utiles

```powershell
npm run build
npm run test
npm run lint
npm run dev:backend
npm run dev:frontend
npm run start --workspace backend
```

## API

Health:

```http
GET /api/health
```

Crear analisis:

```http
POST /api/validations
Content-Type: multipart/form-data

file=<archivo.xlsx>
```

Historial:

```http
GET /api/validations
```

Abrir analisis:

```http
GET /api/validations/{validationId}
```

Eliminar analisis:

```http
DELETE /api/validations/{validationId}
```

Explicar hallazgo con Gemini:

```http
POST /api/validations/{validationId}/issues/{issueId}/explain
```

Descargas:

```http
GET /api/validations/{validationId}/export/json
GET /api/validations/{validationId}/export/csv
GET /api/validations/{validationId}/export/xlsx
GET /api/validations/{validationId}/export/issues-xlsx
```

`issues-xlsx` descarga un Excel de errores con nombre basado en el archivo original. Ejemplo:

```text
Formulas-Prueba-Errores.xlsx
```

## Modulos del frontend

- **Cargar Excel**: permite subir un `.xlsx` y ejecutar el analisis.
- **Historial de Analisis**: muestra analisis guardados en MongoDB o memoria, permite abrirlos o eliminarlos.
- **Traductor de formulas**: convierte formulas tecnicas en lectura funcional.
- **Hallazgos de auditoria**: muestra los errores separados por secciones.
- **Auditoria funcional del PDF**: agrupa controles basados en el manual funcional.
- **Exportar errores**: descarga un Excel con todos los hallazgos, ubicacion, impacto y recomendacion.

## Que audita el sistema

### Estructura del Excel

- Hojas obligatorias.
- Columnas obligatorias.
- Encabezados duplicados.
- Columnas no documentadas.
- Filas sin identificador.
- Nombres obligatorios faltantes.

### Formulas

- Parentesis y corchetes.
- Operadores invalidos.
- Funciones `SI`, `Y`, `O`, `NO`.
- Cantidad de argumentos.
- Division literal por cero.
- Condiciones que no devuelven verdadero/falso.
- Formulas o unidades que devuelven booleanos.
- Operadores escritos en castellano cuando hay referencias tecnicas.

### Referencias

- `A[n]`: calculo auxiliar.
- `R[n]`: importe del concepto.
- `U[n]`: unidad del concepto.
- `L[n]`: variable de legajo.
- `N[n]`: novedad en unidades.
- `I[n]`: importe de novedad.

### Dependencias

- Dependencias circulares.
- Autorreferencias.
- Ciclos entre conceptos y auxiliares.
- Ciclos por acumuladores.
- Dependencias anuladas por multiplicacion por cero se ignoran para evitar falsos positivos.

### Auxiliares

- Clase `F`: auxiliar calculado por formula.
- Clase `A`: auxiliar acumulador con componentes en hoja Acumuladores.
- Clase `V`: auxiliar de valor fijo.
- Clase ausente o desconocida.
- Formula falsa sin condicion.
- Condicion sin algoritmo verdadero.
- Auxiliar acumulador mezclado con formula o valor.
- Auxiliar formula con componentes de acumulador.

### Acumuladores

- Codigo de acumulador.
- Concepto integrante.
- Operacion `Suma` o `Resta`.
- Conceptos inexistentes.
- Repeticiones.
- Mismo concepto sumado y restado en el mismo acumulador.
- Nombre del concepto distinto al que figura en la hoja de Conceptos.

### Auditoria funcional segun PDF

- Unidad mensual/jornal debe representar cantidades, no importes.
- Condiciones con `R[]`, `U[]` o `I[]` se advierten porque dependen de resultados ya liquidados.
- Secuencia de calculo entre conceptos.
- `Totaliza` debe ser numerico.
- Pre-formula y post-formula deben tener sentido respecto del calculo principal.
- Textos como `Gremio`, `Embargos`, `Retencion de Alimentos` o `Redondeo 1 Peso` se marcan como rutinas/textos a confirmar si estan en columnas de formula.

## Flujo de uso

1. Abrir el frontend.
2. Ir a **Cargar Excel**.
3. Seleccionar o arrastrar un archivo `.xlsx`.
4. Presionar **Analizar archivo**.
5. Revisar **Hallazgos de auditoria** por secciones.
6. Abrir el detalle de cada hallazgo si hace falta mas contexto.
7. Usar **Traductor de formulas** para entender formulas tecnicas.
8. Descargar **Exportar errores** para entregar el reporte.
9. Descargar **Excel marcado** si se quiere revisar el archivo con hallazgos destacados.
10. Usar **Historial de Analisis** para abrir o eliminar analisis anteriores.

## Pruebas realizadas

Comando principal:

```powershell
npm run test
```

Incluye pruebas de:

- Health check.
- Carga de XLSX.
- Historial.
- Exportaciones JSON, CSV, Excel marcado y Excel de errores.
- Referencias inexistentes.
- Duplicados.
- Tipos de formula.
- Ciclos.
- Reglas funcionales del PDF.
- Archivo real de referencia.

## Preparacion para GitLab

Antes de subir:

```powershell
git status
npm run test
npm run build
```

Verificar que no se suba:

- `.env`
- `.env.*`
- `node_modules/`
- `dist/`
- `backend/tmp/`
- `tmp/`
- `salidas/`
- archivos `.log`

El repositorio ya incluye `.gitignore` con esas exclusiones.

## Consideraciones de despliegue

- Backend recomendado como servicio Node.js con `NODE_ENV=production`.
- Frontend recomendado como sitio estatico.
- MongoDB debe estar accesible desde el backend si se quiere historial persistente.
- El backend actualmente permite CORS abierto con `cors()`. Si se publica en red interna o internet, el equipo de despliegue puede restringir origenes segun el dominio final.
- El limite default de carga es `10 MB`; ajustar `MAX_UPLOAD_MB` si los Excel productivos son mas grandes.
- El backend usa `--max-old-space-size=4096`; mantenerlo para archivos grandes.

## Documentacion interna

- [Arquitectura](docs/arquitectura.md)
- [Modelo de formulas](docs/modelo-formulas.md)
- [Reglas de validacion](docs/reglas-validacion.md)
- [Analisis inicial](docs/analisis-inicial.md)
- [Errores detectados en archivo de referencia](docs/errores-detectados-archivo-referencia.md)

## Limitaciones conocidas

- `N[n]` e `I[n]` se validan contra conceptos porque el Excel no trae una hoja independiente de novedades.
- La secuencia depende de que el Excel tenga la columna `Secuentica`/`Secuencia`.
- Gemini es opcional y depende de una clave valida.
- Si MongoDB esta desactivado, el historial no persiste despues de reiniciar el backend.
