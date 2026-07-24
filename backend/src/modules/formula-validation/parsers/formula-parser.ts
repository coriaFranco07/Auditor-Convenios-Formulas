import {
  BinaryExpression,
  ComparisonExpression,
  Expression,
  FormulaDiagnostic,
  FormulaParseResult,
  FormulaReference,
  FormulaType,
  FunctionCallExpression,
  InvalidExpression,
  LogicalExpression,
  ReferenceExpression,
  UnaryExpression,
} from '../types/formula.types';
import { FormulaTokenizer, Token } from './tokenizer';

const comparisonOperators = new Set(['>', '<', '>=', '<=', '==', '!=']);
const knownFunctions = new Set(['SI', 'Y', 'O', 'NO']);

export class FormulaParser {
  private tokens: Token[] = [];
  private current = 0;
  private syntaxErrors: FormulaDiagnostic[] = [];
  private references: FormulaReference[] = [];

  parse(input: string): FormulaParseResult {
    const tokenizer = new FormulaTokenizer();
    const tokenizeResult = tokenizer.tokenize(normalizeWordOperators(input));
    this.tokens = tokenizeResult.tokens;
    this.current = 0;
    this.syntaxErrors = [...tokenizeResult.errors];
    this.references = [];

    const ast = this.parseExpression();
    if (!this.isAtEnd()) {
      const token = this.peek();
      this.syntaxErrors.push({
        message: `Expresion incompleta o token inesperado: ${token.value}`,
        position: token.start,
        fragment: token.value,
      });
    }

    const typeErrors: FormulaDiagnostic[] = [];
    const inferredType = this.inferType(ast, typeErrors);
    return {
      ast,
      references: this.references,
      inferredType,
      syntaxErrors: this.syntaxErrors,
      typeErrors,
    };
  }

  private parseExpression(): Expression {
    return this.parseOr();
  }

  private parseOr(): Expression {
    let expression = this.parseAnd();
    while (this.matchOperator('||')) {
      const operator = this.previous();
      const right = this.parseAnd();
      expression = {
        kind: 'LogicalExpression',
        operator: operator.value as '||',
        left: expression,
        right,
        start: expression.start,
        end: right.end,
      } satisfies LogicalExpression;
    }
    return expression;
  }

  private parseAnd(): Expression {
    let expression = this.parseComparison();
    while (this.matchOperator('&&')) {
      const operator = this.previous();
      const right = this.parseComparison();
      expression = {
        kind: 'LogicalExpression',
        operator: operator.value as '&&',
        left: expression,
        right,
        start: expression.start,
        end: right.end,
      } satisfies LogicalExpression;
    }
    return expression;
  }

  private parseComparison(): Expression {
    let expression = this.parseAdditive();
    while (this.checkOperator([...comparisonOperators])) {
      const operator = this.advance();
      const right = this.parseAdditive();
      expression = {
        kind: 'ComparisonExpression',
        operator: operator.value as ComparisonExpression['operator'],
        left: expression,
        right,
        start: expression.start,
        end: right.end,
      } satisfies ComparisonExpression;
    }
    return expression;
  }

  private parseAdditive(): Expression {
    let expression = this.parseMultiplicative();
    while (this.checkOperator(['+', '-'])) {
      const operator = this.advance();
      const right = this.parseMultiplicative();
      expression = {
        kind: 'BinaryExpression',
        operator: operator.value as BinaryExpression['operator'],
        left: expression,
        right,
        start: expression.start,
        end: right.end,
      } satisfies BinaryExpression;
    }
    return expression;
  }

  private parseMultiplicative(): Expression {
    let expression = this.parseUnary();
    while (this.checkOperator(['*', '/'])) {
      const operator = this.advance();
      const right = this.parseUnary();
      expression = {
        kind: 'BinaryExpression',
        operator: operator.value as BinaryExpression['operator'],
        left: expression,
        right,
        start: expression.start,
        end: right.end,
      } satisfies BinaryExpression;
    }
    return expression;
  }

  private parseUnary(): Expression {
    if (this.checkOperator(['!', '-', '+'])) {
      const operator = this.advance();
      const argument = this.parseUnary();
      return {
        kind: 'UnaryExpression',
        operator: operator.value as UnaryExpression['operator'],
        argument,
        start: operator.start,
        end: argument.end,
      };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    if (this.match('NUMBER')) {
      const token = this.previous();
      return {
        kind: 'NumericLiteral',
        value: Number(token.value),
        start: token.start,
        end: token.end,
      };
    }

    if (this.match('REFERENCE')) {
      const token = this.previous();
      const rawId = token.referenceRawId ?? '';
      const numericId = /^\d+$/.test(rawId) ? Number(rawId) : undefined;
      if (!rawId) {
        this.syntaxErrors.push({
          message: 'La referencia no tiene identificador.',
          position: token.start,
          fragment: token.value,
        });
      } else if (numericId === undefined) {
        this.syntaxErrors.push({
          message: 'El identificador de la referencia no es numerico.',
          position: token.start,
          fragment: token.value,
        });
      }
      const reference: ReferenceExpression = {
        kind: 'ReferenceExpression',
        referenceType: token.referenceType!,
        referenceId: numericId,
        rawId,
        start: token.start,
        end: token.end,
      };
      this.references.push({
        type: token.referenceType!,
        id: numericId,
        rawId,
        start: token.start,
        end: token.end,
      });
      return reference;
    }

    if (this.match('IDENTIFIER')) {
      return this.parseFunctionCall(this.previous());
    }

    if (this.match('LPAREN')) {
      const start = this.previous();
      const expression = this.parseExpression();
      if (!this.match('RPAREN')) {
        this.syntaxErrors.push({
          message: 'Parentesis sin cerrar.',
          position: start.start,
          fragment: start.value,
        });
        return expression;
      }
      return { ...expression, start: start.start, end: this.previous().end };
    }

    const token = this.peek();
    const reason = token.type === 'EOF' ? 'Expresion incompleta.' : `Operando esperado antes de ${token.value}.`;
    this.syntaxErrors.push({
      message: reason,
      position: token.start,
      fragment: token.value,
    });
    if (!this.isAtEnd()) {
      this.advance();
    }
    return {
      kind: 'InvalidExpression',
      reason,
      start: token.start,
      end: token.end,
    } satisfies InvalidExpression;
  }

  private parseFunctionCall(identifier: Token): Expression {
    if (!this.match('LPAREN')) {
      this.syntaxErrors.push({
        message: `Funcion desconocida o referencia mal formada: ${identifier.value}`,
        position: identifier.start,
        fragment: identifier.value,
      });
      return {
        kind: 'InvalidExpression',
        reason: 'Funcion sin parentesis.',
        start: identifier.start,
        end: identifier.end,
      };
    }

    const args: Expression[] = [];
    if (!this.check('RPAREN')) {
      do {
        args.push(this.parseExpression());
      } while (this.match('SEMICOLON'));
    }

    if (!this.match('RPAREN')) {
      this.syntaxErrors.push({
        message: `La funcion ${identifier.value} no cierra parentesis.`,
        position: identifier.start,
        fragment: identifier.value,
      });
    }

    const end = this.previous().end;
    if (!knownFunctions.has(identifier.value)) {
      this.syntaxErrors.push({
        message: `Funcion desconocida: ${identifier.value}`,
        position: identifier.start,
        fragment: identifier.value,
      });
    }

    this.validateFunctionArity(identifier, args);

    return {
      kind: 'FunctionCallExpression',
      name: identifier.value,
      args,
      start: identifier.start,
      end,
    } satisfies FunctionCallExpression;
  }

  private validateFunctionArity(identifier: Token, args: Expression[]): void {
    const name = identifier.value;
    const valid =
      (name === 'SI' && args.length === 3) ||
      (name === 'NO' && args.length === 1) ||
      ((name === 'Y' || name === 'O') && args.length >= 2) ||
      !knownFunctions.has(name);
    if (!valid) {
      this.syntaxErrors.push({
        message: `Cantidad invalida de argumentos para ${name}.`,
        position: identifier.start,
        fragment: name,
      });
    }
  }

  private inferType(expression: Expression, errors: FormulaDiagnostic[]): FormulaType {
    switch (expression.kind) {
      case 'NumericLiteral':
      case 'ReferenceExpression':
        expression.inferredType = 'NUMBER';
        return expression.inferredType;
      case 'InvalidExpression':
        expression.inferredType = 'INVALID';
        return expression.inferredType;
      case 'UnaryExpression': {
        const argumentType = this.inferType(expression.argument, errors);
        if (expression.operator === '!') {
          this.expectType(expression.argument, argumentType, 'BOOLEAN', errors);
          expression.inferredType = argumentType === 'INVALID' ? 'INVALID' : 'BOOLEAN';
        } else {
          this.expectType(expression.argument, argumentType, 'NUMBER', errors);
          expression.inferredType = argumentType === 'INVALID' ? 'INVALID' : 'NUMBER';
        }
        return expression.inferredType;
      }
      case 'BinaryExpression': {
        const leftType = this.inferType(expression.left, errors);
        const rightType = this.inferType(expression.right, errors);
        this.expectType(expression.left, leftType, 'NUMBER', errors);
        this.expectType(expression.right, rightType, 'NUMBER', errors);
        expression.inferredType = leftType === 'INVALID' || rightType === 'INVALID' ? 'INVALID' : 'NUMBER';
        return expression.inferredType;
      }
      case 'ComparisonExpression': {
        const leftType = this.inferType(expression.left, errors);
        const rightType = this.inferType(expression.right, errors);
        this.expectComparable(expression.left, leftType, errors);
        this.expectComparable(expression.right, rightType, errors);
        expression.inferredType = leftType === 'INVALID' || rightType === 'INVALID' ? 'INVALID' : 'BOOLEAN';
        return expression.inferredType;
      }
      case 'LogicalExpression': {
        const leftType = this.inferType(expression.left, errors);
        const rightType = this.inferType(expression.right, errors);
        this.expectType(expression.left, leftType, 'BOOLEAN', errors);
        this.expectType(expression.right, rightType, 'BOOLEAN', errors);
        expression.inferredType = leftType === 'INVALID' || rightType === 'INVALID' ? 'INVALID' : 'BOOLEAN';
        return expression.inferredType;
      }
      case 'FunctionCallExpression':
        expression.inferredType = this.inferFunctionType(expression, errors);
        return expression.inferredType;
      default:
        return 'UNKNOWN';
    }
  }

  private inferFunctionType(expression: FunctionCallExpression, errors: FormulaDiagnostic[]): FormulaType {
    const argTypes = expression.args.map((arg) => this.inferType(arg, errors));
    if (!knownFunctions.has(expression.name)) {
      return 'INVALID';
    }
    if (expression.name === 'SI') {
      if (expression.args[0]) {
        this.expectType(expression.args[0], argTypes[0], 'BOOLEAN', errors);
      }
      const trueType = argTypes[1] ?? 'UNKNOWN';
      const falseType = argTypes[2] ?? 'UNKNOWN';
      if (trueType === falseType) {
        return trueType;
      }
      if (trueType === 'INVALID' || falseType === 'INVALID') {
        return 'INVALID';
      }
      return 'UNKNOWN';
    }
    if (expression.name === 'Y' || expression.name === 'O') {
      expression.args.forEach((arg, index) => this.expectType(arg, argTypes[index], 'BOOLEAN', errors));
      return argTypes.includes('INVALID') ? 'INVALID' : 'BOOLEAN';
    }
    if (expression.name === 'NO') {
      if (expression.args[0]) {
        this.expectType(expression.args[0], argTypes[0], 'BOOLEAN', errors);
      }
      return argTypes.includes('INVALID') ? 'INVALID' : 'BOOLEAN';
    }
    return 'UNKNOWN';
  }

  private expectType(
    expression: Expression,
    actual: FormulaType,
    expected: FormulaType,
    errors: FormulaDiagnostic[],
  ): void {
    if (actual !== expected && actual !== 'UNKNOWN' && actual !== 'INVALID') {
      errors.push({
        message: `Tipo incompatible: se esperaba ${expected} y se obtuvo ${actual}.`,
        position: expression.start,
      });
    }
  }

  private expectComparable(expression: Expression, actual: FormulaType, errors: FormulaDiagnostic[]): void {
    if (actual !== 'NUMBER' && actual !== 'UNKNOWN' && actual !== 'INVALID') {
      errors.push({
        message: `Tipo no comparable: ${actual}.`,
        position: expression.start,
      });
    }
  }

  private match(type: Token['type']): boolean {
    if (!this.check(type)) {
      return false;
    }
    this.advance();
    return true;
  }

  private matchOperator(operator: string): boolean {
    if (!this.checkOperator([operator])) {
      return false;
    }
    this.advance();
    return true;
  }

  private check(type: Token['type']): boolean {
    if (this.isAtEnd()) {
      return type === 'EOF';
    }
    return this.peek().type === type;
  }

  private checkOperator(operators: Iterable<string>): boolean {
    if (this.isAtEnd() || this.peek().type !== 'OPERATOR') {
      return false;
    }
    return new Set(operators).has(this.peek().value);
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current += 1;
    }
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}

export const containsExplicitDivisionByZero = (expression: Expression): boolean => {
  if (expression.kind === 'BinaryExpression') {
    if (
      expression.operator === '/' &&
      expression.right.kind === 'NumericLiteral' &&
      expression.right.value === 0
    ) {
      return true;
    }
    return containsExplicitDivisionByZero(expression.left) || containsExplicitDivisionByZero(expression.right);
  }
  if (
    expression.kind === 'ComparisonExpression' ||
    expression.kind === 'LogicalExpression'
  ) {
    return containsExplicitDivisionByZero(expression.left) || containsExplicitDivisionByZero(expression.right);
  }
  if (expression.kind === 'UnaryExpression') {
    return containsExplicitDivisionByZero(expression.argument);
  }
  if (expression.kind === 'FunctionCallExpression') {
    return expression.args.some(containsExplicitDivisionByZero);
  }
  return false;
};

export const normalizeWordOperators = (input: string): string => {
  if (!/\b[NIARUL]\s*\[/i.test(input)) {
    return input;
  }

  return input
    .replace(/\bmultiplicado\s+por\b/gi, ' * ')
    .replace(/\bdividido\s+(por|en)\b/gi, ' / ')
    .replace(/\bmas\b/gi, ' + ')
    .replace(/\bm[aá]s\b/gi, ' + ')
    .replace(/\bmenos\b/gi, ' - ')
    .replace(/\bpor\b/gi, ' * ');
};
