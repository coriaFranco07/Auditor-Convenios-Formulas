# Modelo de formulas

## Referencias

- `N[n]`: unidades de novedad.
- `I[n]`: importe de novedad.
- `A[n]`: calculo auxiliar.
- `R[n]`: importe de concepto.
- `U[n]`: unidad de concepto.
- `L[n]`: variable de legajo.

En el MVP, `N[n]` e `I[n]` se validan contra conceptos porque el Excel no incluye una hoja independiente de novedades.

## Operadores

Precedencia implementada, de mayor a menor:

1. Unarios: `!`, `-`, `+`.
2. Multiplicativos: `*`, `/`.
3. Aditivos: `+`, `-`.
4. Comparativos: `>`, `<`, `>=`, `<=`, `==`, `!=`.
5. Logico AND: `&&`.
6. Logico OR: `||`.

## Funciones

- `SI(condicion; verdadero; falso)`
- `Y(condicion1; condicion2; ...)`
- `O(condicion1; condicion2; ...)`
- `NO(condicion)`

## AST

Nodos:

- `NumericLiteral`
- `ReferenceExpression`
- `UnaryExpression`
- `BinaryExpression`
- `LogicalExpression`
- `ComparisonExpression`
- `FunctionCallExpression`
- `InvalidExpression`

## Tipos

- `NUMBER`
- `BOOLEAN`
- `UNKNOWN`
- `INVALID`

Las referencias se tratan como numericas. Las comparaciones y operaciones logicas devuelven booleano. `SI` devuelve el tipo comun de sus ramas o `UNKNOWN` si difieren.

