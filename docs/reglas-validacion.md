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

## Auditoria funcional del PDF

Controles derivados del manual `Prompt_Formulas_Conceptos.pdf`:

- Texto libre en columnas de calculo: cuando una columna de formula/pre-formula/post-formula contiene texto como `Gremio`, `Embargos` o `Retencion de Alimentos`, se muestra un unico hallazgo funcional para confirmar si es rutina valida o si falta la formula tecnica.
- Operadores escritos en castellano: si una formula usa referencias tecnicas, se aceptan expresiones con `mas`, `menos`, `por`, `multiplicado por` y `dividido por`.
- Unidad mensual/jornal con importes: las columnas de unidad se revisan para detectar usos de `R[]` o `I[]`, porque el PDF las describe como cantidades, novedades, unidades o auxiliares.
- Condiciones que dependen de resultados: se advierte si una condicion usa `R[]`, `U[]` o `I[]`, ya que puede depender de valores calculados previamente.
- Secuencia de calculo: si un concepto usa `R[]` o `U[]` de otro concepto con secuencia posterior o igual, se genera una advertencia funcional no bloqueante.
- Totaliza: se valida que el campo sea numerico.
- Pre/Post formula sin formula principal: se advierte cuando existe pre/post formula pero no hay formula mensual o jornal principal.
- Auxiliares por clase: clase `V` debe tener valor; clase `A` no deberia mezclar formulas/valores; clase `F` no deberia tener componentes en Acumuladores.
- Acumuladores: se revisa que el nombre del concepto coincida con la hoja de Conceptos y que un mismo concepto no se sume y reste dentro del mismo acumulador.

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
