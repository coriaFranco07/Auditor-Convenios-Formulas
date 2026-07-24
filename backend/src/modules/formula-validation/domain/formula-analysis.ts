import { Expression, FormulaReference } from '../types/formula.types';

export const collectEffectiveReferences = (expression: Expression): FormulaReference[] => {
  if (expression.kind === 'ReferenceExpression') {
    return [
      {
        type: expression.referenceType,
        id: expression.referenceId,
        rawId: expression.rawId,
        start: expression.start,
        end: expression.end,
      },
    ];
  }

  if (expression.kind === 'BinaryExpression') {
    if (
      expression.operator === '*' &&
      (isZeroLiteral(expression.left) || isZeroLiteral(expression.right))
    ) {
      return [];
    }
    return [
      ...collectEffectiveReferences(expression.left),
      ...collectEffectiveReferences(expression.right),
    ];
  }

  if (expression.kind === 'ComparisonExpression' || expression.kind === 'LogicalExpression') {
    return [
      ...collectEffectiveReferences(expression.left),
      ...collectEffectiveReferences(expression.right),
    ];
  }

  if (expression.kind === 'UnaryExpression') {
    return collectEffectiveReferences(expression.argument);
  }

  if (expression.kind === 'FunctionCallExpression') {
    return expression.args.flatMap(collectEffectiveReferences);
  }

  return [];
};

export const hasLogicalDecision = (expression: Expression): boolean => {
  if (
    expression.kind === 'ComparisonExpression' ||
    expression.kind === 'LogicalExpression' ||
    (expression.kind === 'UnaryExpression' && expression.operator === '!')
  ) {
    return true;
  }

  if (expression.kind === 'FunctionCallExpression') {
    return ['SI', 'Y', 'O', 'NO'].includes(expression.name) || expression.args.some(hasLogicalDecision);
  }

  if (expression.kind === 'BinaryExpression') {
    return hasLogicalDecision(expression.left) || hasLogicalDecision(expression.right);
  }

  if (expression.kind === 'UnaryExpression') {
    return hasLogicalDecision(expression.argument);
  }

  return false;
};

export const uniqueReferences = (references: FormulaReference[]): FormulaReference[] => {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.type}[${reference.id ?? reference.rawId}]`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const isZeroLiteral = (expression: Expression): boolean =>
  expression.kind === 'NumericLiteral' && expression.value === 0;
