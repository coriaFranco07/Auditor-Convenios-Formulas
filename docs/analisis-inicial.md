# Analisis inicial

Fecha de inspeccion: 2026-07-13.

Archivos inspeccionados:

- `referencias/Prompt_Formulas_Conceptos.pdf`
- `referencias/Formulas.Comercio.xlsx`

## Lectura del PDF

El PDF tiene 12 paginas. Describe el archivo de formulas como una fuente estatica para documentar y entender conceptos de liquidacion. Define las cinco hojas principales:

- `Conceptos y Formulas (1)`
- `Variables de Legajos (2)`
- `Calculo Auxiliares (3)`
- `Acumuladores (4)`
- `Convenios (5)`

Tambien define el lenguaje de referencias:

- `N[n]`: unidades de una novedad.
- `I[n]`: importe de una novedad.
- `A[n]`: calculo auxiliar.
- `R[n]`: importe calculado de un concepto.
- `U[n]`: unidades calculadas de un concepto.
- `L[n]`: variable de legajo.

El PDF enumera operadores aritmeticos y funciones logicas `SI`, `Y`, `O`, `NO`. El requerimiento del sistema agrega operadores comparativos y logicos simbolicos que no aparecen completos en el PDF, por lo que se implementan como parte del lenguaje esperado por el sistema.

## Perfil del Excel

El workbook contiene exactamente las hojas esperadas:

| Hoja | Dimension | Encabezado | Registros aproximados |
| --- | --- | ---: | ---: |
| `Conceptos y Formulas (1)` | `A1:O641` | fila 2 | 639 conceptos |
| `Variables de Legajos (2)` | `A1:C260` | fila 2 | 258 variables |
| `Calculo Auxiliares (3)` | `A1:I199` | fila 1 | 198 auxiliares |
| `Acumuladores (4)` | `A1:E221` | fila 1 | 220 filas |
| `Convenios (5)` | `A1:B224` | fila 1 | 223 convenios |

Las hojas `Conceptos y Formulas (1)` y `Variables de Legajos (2)` contienen una primera fila de titulo exportado (`e-Sueldos_datos_exportados...`) y sus encabezados reales comienzan en la fila 2.

## Encabezados reales

### Conceptos

- `N°`
- `Concepto`
- `Activación`
- `Alcance`
- `Condición Mensual`
- `Fórmula Mensual (V)`
- `Fórmula Mensual (F)`
- `Unidad Mensual`
- `Condición Jornal`
- `Fórmula Jornal (V)`
- `Fórmula Jornal (F)`
- `Unidad Jornal`
- `Totaliza`
- `Pre-Fórmula`
- `Post - Fórmula`

### Variables de legajo

- `Código`
- `Detalle`
- `Abreviatura`

### Calculos auxiliares

- `Cod`
- `Items`
- `Algorit.Verdadero`
- `Algorit.Falso`
- `Condicion`
- `Valor`
- `Clase`

La hoja tiene columnas `H` e `I` pobladas con formulas Excel auxiliares como `=SUM(A2:G2)`. No forman parte del lenguaje de formulas de liquidacion y se ignoran como columnas de negocio.

### Acumuladores

- columna A sin encabezado visible: codigo de acumulador.
- `Acumulador`
- `Codigo De Concepto`
- `Concepto`
- `Valor`

### Convenios

- `CÓDIGO`
- `DETALLE`

## Valores de catalogo observados

- Activacion: `Automática`, `Novedad`.
- Alcance: `General`, `Jornal`, `Mensual`.
- Clase de auxiliar: `A`, `F`, `V`.
- Operacion de acumulador: `Resta`, `Suma`.
- Totaliza: `12`.

El PDF documenta activacion como `Automática` o `Manual`, pero el Excel usa `Novedad`. Se registra como `SCHEMA_DRIFT` y no como error critico.

## Inconsistencias PDF vs Excel

- El PDF menciona una columna `Secuentica` para secuencia de calculo, pero el Excel de referencia no la contiene.
- El PDF dice que `Alcance` tiene valores `Mensual` y `General`; el Excel tambien contiene `Jornal`.
- El PDF dice que `Activación` puede ser `Automática` o `Manual`; el Excel contiene `Novedad`.
- En `Acumuladores (4)`, el encabezado del codigo de acumulador esta vacio aunque el PDF describe el concepto de acumuladores.
- En `Calculo Auxiliares (3)`, existen columnas tecnicas `H` e `I` no documentadas con formulas Excel internas.

## Problemas reales detectados en el Excel

Una auditoria estatica preliminar encontro:

- 1.978 celdas con formulas de liquidacion o referencias.
- 121 referencias inexistentes.
- 2 condiciones con expresion numerica en lugar de booleana.
- 2 ciclos de dependencia.

Ejemplos relevantes:

- `Conceptos y Formulas (1)!F35`: `A[6] / 24 * N[33] * - 1` referencia `A[6]`, que no existe.
- `Conceptos y Formulas (1)!J35`: mismo problema con `A[6]`.
- `Conceptos y Formulas (1)!E96`: `L[10] * 1.5` esta en una columna de condicion y devuelve numero.
- `Conceptos y Formulas (1)!I96`: mismo problema en condicion jornal.
- Ciclo indirecto observado: `A[754] -> R[56] -> A[777] -> R[303] -> A[754]`.
- Autorreferencia observada: `R[475] -> R[475]`.

Tambien se encontraron duplicados de conceptos. Algunos son identicos y otros conflictivos:

- Concepto `32`: duplicado conflictivo en filas 32, 33 y 34.
- Concepto `50`: duplicado identico en filas 51 y 52.
- Concepto `56`: duplicado conflictivo en filas 58 y 59.

Los acumuladores tienen multiples filas por codigo porque representan componentes del acumulador. Por eso no se tratan como duplicado de entidad por codigo solamente; el duplicado real se valida por combinacion de acumulador, concepto integrante y operacion.

## Supuestos funcionales

- `N[n]` e `I[n]` se validan contra los conceptos definidos en la hoja `Conceptos y Formulas (1)`, salvo que en el futuro se agregue una hoja explicita de novedades.
- Un concepto puede aparecer repetido. El sistema conserva todas las definiciones y clasifica el caso como duplicado identico o conflictivo.
- Las formulas Excel reales que comienzan con `=` fuera de columnas de negocio no se parsean como formulas de liquidacion.
- Las columnas de condicion deben inferir `BOOLEAN`; formulas y unidades deben inferir `NUMBER`, salvo expresiones incompletas o desconocidas.
- Los ciclos se construyen entre nodos `R[n]` y `A[n]`. Las referencias `U[n]` se validan contra conceptos, pero no se consideran resultado monetario en el grafo principal salvo que aparezcan como dependencia de calculo de un concepto.
- La ausencia de `Secuentica` genera advertencia de esquema y limita las validaciones de orden de calculo.
- El MVP guarda resultados en memoria con vencimiento configurable y deja una interfaz para reemplazar el repositorio por una base de datos.
