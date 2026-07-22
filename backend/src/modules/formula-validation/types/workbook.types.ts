import { FormulaParseResult } from './formula.types';

export type SheetKey = 'concepts' | 'variables' | 'auxiliaries' | 'accumulators' | 'conventions';

export type FormulaColumnRole = 'CONDITION' | 'FORMULA' | 'UNIT';

export type EntityType =
  | 'WORKBOOK'
  | 'CONCEPT'
  | 'LEG_VARIABLE'
  | 'AUXILIARY'
  | 'ACCUMULATOR'
  | 'CONVENTION';

export interface CellLocation {
  sheet: string;
  row: number;
  column?: string;
  cell?: string;
}

export interface SourceColumn {
  key: string;
  label: string;
  column: string;
  index: number;
  role?: FormulaColumnRole;
}

export interface SheetContext {
  key: SheetKey;
  name: string;
  headerRow: number;
  columns: Record<string, SourceColumn>;
  headerValues: Array<string | null>;
  unknownHeaders: SourceColumn[];
  duplicateHeaders: string[];
}

export interface BaseRecord {
  entityType: EntityType;
  id?: number;
  name?: string;
  sheet: string;
  row: number;
  sourceColumns: Record<string, CellLocation>;
  originalValues: Record<string, unknown>;
  normalizedValues: Record<string, unknown>;
}

export interface ConceptRecord extends BaseRecord {
  entityType: 'CONCEPT';
  activation?: string;
  scope?: string;
  monthlyCondition?: string;
  monthlyFormulaTrue?: string;
  monthlyFormulaFalse?: string;
  monthlyUnit?: string;
  dailyCondition?: string;
  dailyFormulaTrue?: string;
  dailyFormulaFalse?: string;
  dailyUnit?: string;
  totalizes?: number | string;
  preFormula?: string;
  postFormula?: string;
  sequence?: number;
}

export interface LegVariableRecord extends BaseRecord {
  entityType: 'LEG_VARIABLE';
  abbreviation?: string;
}

export interface AuxiliaryRecord extends BaseRecord {
  entityType: 'AUXILIARY';
  trueFormula?: string;
  falseFormula?: string;
  condition?: string;
  value?: number | string;
  class?: string;
}

export interface AccumulatorRecord extends BaseRecord {
  entityType: 'ACCUMULATOR';
  conceptId?: number;
  conceptName?: string;
  operation?: string;
}

export interface ConventionRecord extends BaseRecord {
  entityType: 'CONVENTION';
}

export interface FormulaCell {
  sheet: string;
  row: number;
  column: string;
  cell: string;
  role: FormulaColumnRole;
  entityType: EntityType;
  entityId?: number | string;
  entityName?: string;
  formula: string;
  parseResult: FormulaParseResult;
}

export interface WorkbookContext {
  originalFileName: string;
  sourceBuffer: Buffer;
  sheets: Partial<Record<SheetKey, SheetContext>>;
  missingSheets: string[];
  concepts: ConceptRecord[];
  variables: LegVariableRecord[];
  auxiliaries: AuxiliaryRecord[];
  accumulators: AccumulatorRecord[];
  conventions: ConventionRecord[];
  formulaCells: FormulaCell[];
}
