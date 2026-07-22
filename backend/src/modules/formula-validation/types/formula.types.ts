export type FormulaType = 'NUMBER' | 'BOOLEAN' | 'UNKNOWN' | 'INVALID';

export type ReferenceType = 'N' | 'I' | 'A' | 'R' | 'U' | 'L';

export interface FormulaDiagnostic {
  message: string;
  position: number;
  fragment?: string;
}

export interface BaseExpression {
  kind:
    | 'NumericLiteral'
    | 'ReferenceExpression'
    | 'UnaryExpression'
    | 'BinaryExpression'
    | 'LogicalExpression'
    | 'ComparisonExpression'
    | 'FunctionCallExpression'
    | 'InvalidExpression';
  start: number;
  end: number;
  inferredType?: FormulaType;
}

export interface NumericLiteral extends BaseExpression {
  kind: 'NumericLiteral';
  value: number;
}

export interface ReferenceExpression extends BaseExpression {
  kind: 'ReferenceExpression';
  referenceType: ReferenceType;
  referenceId?: number;
  rawId: string;
}

export interface UnaryExpression extends BaseExpression {
  kind: 'UnaryExpression';
  operator: '!' | '-' | '+';
  argument: Expression;
}

export interface BinaryExpression extends BaseExpression {
  kind: 'BinaryExpression';
  operator: '+' | '-' | '*' | '/';
  left: Expression;
  right: Expression;
}

export interface LogicalExpression extends BaseExpression {
  kind: 'LogicalExpression';
  operator: '&&' | '||';
  left: Expression;
  right: Expression;
}

export interface ComparisonExpression extends BaseExpression {
  kind: 'ComparisonExpression';
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  left: Expression;
  right: Expression;
}

export interface FunctionCallExpression extends BaseExpression {
  kind: 'FunctionCallExpression';
  name: string;
  args: Expression[];
}

export interface InvalidExpression extends BaseExpression {
  kind: 'InvalidExpression';
  reason: string;
}

export type Expression =
  | NumericLiteral
  | ReferenceExpression
  | UnaryExpression
  | BinaryExpression
  | LogicalExpression
  | ComparisonExpression
  | FunctionCallExpression
  | InvalidExpression;

export interface FormulaReference {
  type: ReferenceType;
  id?: number;
  rawId: string;
  start: number;
  end: number;
}

export interface FormulaParseResult {
  ast: Expression;
  references: FormulaReference[];
  inferredType: FormulaType;
  syntaxErrors: FormulaDiagnostic[];
  typeErrors: FormulaDiagnostic[];
}

