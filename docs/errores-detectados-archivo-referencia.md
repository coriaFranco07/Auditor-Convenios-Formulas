# Errores detectados en Formulas.Comercio.xlsx

Resultado del backend compilado sobre `referencias/Formulas.Comercio.xlsx`:

| Metrica | Valor |
| --- | ---: |
| Estado | `BLOCKED` |
| Issues totales | 407 |
| Criticos | 160 |
| Errores | 16 |
| Advertencias | 102 |
| Informativos | 129 |
| Hojas analizadas | 5 |
| Conceptos analizados | 639 |
| Variables analizadas | 258 |
| Auxiliares analizados | 198 |
| Acumuladores analizados | 220 |
| Formulas analizadas | 1.982 |

## Conteo por codigo

| Codigo | Cantidad |
| --- | ---: |
| `MISSING_NAME` | 1 |
| `INVALID_ROW` | 1 |
| `DUPLICATE_CONFLICT` | 24 |
| `DUPLICATE_IDENTICAL` | 80 |
| `INVALID_FORMULA_SYNTAX` | 9 |
| `MISSING_CONCEPT_REFERENCE` | 61 |
| `MISSING_AUXILIARY_REFERENCE` | 72 |
| `INVALID_CONDITION_TYPE` | 2 |
| `CIRCULAR_DEPENDENCY` | 2 |
| `SELF_REFERENCE` | 1 |
| `INVALID_AUXILIARY_ROW` | 121 |
| `MISSING_ACCUMULATOR_ID` | 1 |
| `SCHEMA_DRIFT` | 32 |

## Ejemplos relevantes

- `Conceptos y Formulas (1)!F35`: `A[6] / 24 * N[33] * - 1` referencia `A[6]`, inexistente.
- `Conceptos y Formulas (1)!J35`: misma referencia inexistente `A[6]`.
- `Conceptos y Formulas (1)!E96`: `L[10] * 1.5` en columna de condicion devuelve `NUMBER`.
- `Conceptos y Formulas (1)!I96`: mismo problema de tipo.
- Concepto `32`: duplicado conflictivo en `Conceptos y Formulas (1)!A32`.
- Ciclo indirecto detectado: `A[754] -> R[56] -> A[777] -> R[303] -> A[754]`.
- Autorreferencia detectada: `R[475] -> R[475]`.

## Ambiguedades pendientes

- Confirmar si `N[n]` e `I[n]` deben resolverse contra conceptos o contra una tabla de novedades externa.
- Confirmar si `Novedad` es un valor valido de `Activación` o un drift del exportador.
- Confirmar el nombre real de la columna de secuencia; el PDF menciona `Secuentica`, pero el archivo no la exporta.
- Definir si auxiliares no referenciados deben quedar como `INFO` o elevarse a advertencia funcional.

