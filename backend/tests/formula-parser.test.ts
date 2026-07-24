import { FormulaParser, containsExplicitDivisionByZero } from '../src/modules/formula-validation/parsers/formula-parser';

describe('FormulaParser', () => {
  const parser = new FormulaParser();

  it('tokeniza referencias', () => {
    const result = parser.parse('L[10] + A[350] - R[1]');
    expect(result.references).toEqual([
      expect.objectContaining({ type: 'L', id: 10 }),
      expect.objectContaining({ type: 'A', id: 350 }),
      expect.objectContaining({ type: 'R', id: 1 }),
    ]);
  });

  it('respeta precedencia de operadores', () => {
    const result = parser.parse('1 + 2 * 3');
    expect(result.ast.kind).toBe('BinaryExpression');
    expect(result.inferredType).toBe('NUMBER');
    if (result.ast.kind === 'BinaryExpression') {
      expect(result.ast.operator).toBe('+');
      expect(result.ast.right.kind).toBe('BinaryExpression');
    }
  });

  it('respeta parentesis', () => {
    const result = parser.parse('(1 + 2) * 3');
    expect(result.ast.kind).toBe('BinaryExpression');
    if (result.ast.kind === 'BinaryExpression') {
      expect(result.ast.operator).toBe('*');
      expect(result.ast.left.kind).toBe('BinaryExpression');
    }
  });

  it('reconoce numeros negativos', () => {
    const result = parser.parse('A[6] / 24 * N[33] * -1');
    expect(result.syntaxErrors).toHaveLength(0);
    expect(result.inferredType).toBe('NUMBER');
  });

  it('infiere comparaciones como booleanas', () => {
    const result = parser.parse('L[10] >= 100');
    expect(result.inferredType).toBe('BOOLEAN');
  });

  it('infiere operadores logicos como booleanos', () => {
    const result = parser.parse('L[10] > 0 && NO(L[11] < 0)');
    expect(result.syntaxErrors).toHaveLength(0);
    expect(result.inferredType).toBe('BOOLEAN');
  });

  it('soporta SI, Y, O y NO', () => {
    expect(parser.parse('SI(L[10] > 0; 1; 0)').inferredType).toBe('NUMBER');
    expect(parser.parse('Y(L[10] > 0; L[11] > 0)').inferredType).toBe('BOOLEAN');
    expect(parser.parse('O(L[10] > 0; L[11] > 0)').inferredType).toBe('BOOLEAN');
    expect(parser.parse('NO(L[10] > 0)').inferredType).toBe('BOOLEAN');
  });

  it('acepta operadores escritos cuando hay referencias tecnicas', () => {
    const result = parser.parse('( L[10] mas N[1] ) multiplicado por 0.2');
    expect(result.syntaxErrors).toHaveLength(0);
    expect(result.inferredType).toBe('NUMBER');
    expect(result.references).toEqual([
      expect.objectContaining({ type: 'L', id: 10 }),
      expect.objectContaining({ type: 'N', id: 1 }),
    ]);
  });

  it('detecta tipos incompatibles dentro de funciones', () => {
    const result = parser.parse('SI(L[10]; 1; 0)');
    expect(result.syntaxErrors).toHaveLength(0);
    expect(result.inferredType).toBe('NUMBER');
    expect(result.typeErrors.some((error) => error.message.includes('BOOLEAN'))).toBe(true);
  });

  it('marca formulas invalidas', () => {
    const result = parser.parse('L[10] + * 2');
    expect(result.syntaxErrors.length).toBeGreaterThan(0);
  });

  it('detecta division literal por cero', () => {
    const result = parser.parse('L[10] / 0');
    expect(containsExplicitDivisionByZero(result.ast)).toBe(true);
  });
});
