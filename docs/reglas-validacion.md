# Reglas de validacion

## Estructura

- Workbook invalido o corrupto.
- Hoja obligatoria ausente.
- Columna obligatoria ausente.
- Encabezado duplicado.
- Columna desconocida.
- Identificador ausente o no numerico.
- Nombre obligatorio ausente.

## Duplicados

- Conceptos y auxiliares se agrupan por identificador.
- Si las definiciones normalizadas son iguales: `DUPLICATE_IDENTICAL`.
- Si difieren: `DUPLICATE_CONFLICT`, bloqueante.
- Acumuladores se consideran duplicados por combinacion acumulador, concepto y operacion.

## Sintaxis

- Parentesis/corchetes sin cerrar.
- Identificador vacio o no numerico.
- Operador sin operando.
- Funcion desconocida.
- Cantidad invalida de argumentos.
- Caracter no permitido.
- Division literal por cero.

## Referencias

- `L[n]` contra variables.
- `A[n]` contra auxiliares.
- `R[n]` y `U[n]` contra conceptos.
- `N[n]` e `I[n]` contra conceptos/novedades inferidas.

Las referencias inexistentes son criticas y bloquean importacion.

## Tipos

- Columnas de condicion esperan `BOOLEAN`.
- Columnas de formula y unidad esperan `NUMBER`.
- Una condicion como `L[10] * 1.5` se marca como `INVALID_CONDITION_TYPE`.

## Dependencias

Se construye grafo dirigido entre `R[n]` y `A[n]`, incluyendo componentes de acumuladores. Se detectan:

- Autorreferencias.
- Ciclos directos e indirectos.
- Ciclos mixtos concepto/auxiliar.

## Catalogos y drift

Los valores documentados estan centralizados. Si aparece un valor no documentado pero plausible, se emite `SCHEMA_DRIFT` con severidad `WARNING`.

## Estados

- `FAILED`: error tecnico de lectura.
- `BLOCKED`: existe issue critico o bloqueante.
- `VALID_WITH_WARNINGS`: existen issues no bloqueantes.
- `VALID`: sin issues.

