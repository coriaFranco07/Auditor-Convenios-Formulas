import { FormulaType, ReferenceType } from './formula.types';
import { CellLocation, EntityType } from './workbook.types';

export interface FormulaManualResponse {
  validationId: string;
  fileName: string;
  generatedAt: string;
  totals: {
    concepts: number;
    auxiliaries: number;
    items: number;
  };
  items: FormulaManualItem[];
}

export interface FormulaManualItem {
  id: string;
  entityType: Extract<EntityType, 'CONCEPT' | 'AUXILIARY'>;
  entityId?: number;
  name: string;
  title: string;
  sheet: string;
  row: number;
  objective: string;
  summary: string;
  attributes: ManualAttribute[];
  formulas: ManualFormulaBlock[];
  references: ManualReference[];
  auxiliaryDetails: ManualAuxiliaryDetail[];
  relatedIssues: ManualRelatedIssue[];
  reviewNotes: string[];
}

export interface ManualAttribute {
  label: string;
  value: string;
}

export interface ManualFormulaBlock {
  id: string;
  title: string;
  role: 'CONDITION' | 'FORMULA' | 'UNIT' | 'PRE_POST';
  sourceLabel: string;
  formula: string;
  readable: string;
  inferredType: FormulaType;
  location?: CellLocation;
  references: ManualReference[];
  example?: ManualFormulaExample;
}

export interface ManualFormulaExample {
  title: string;
  assumptions: ManualAttribute[];
  expression: string;
  result: string;
  note: string;
}

export interface ManualReference {
  token: string;
  type: ReferenceType;
  id?: number;
  label: string;
  meaning: string;
  status: 'Encontrada' | 'No encontrada' | 'Novedad externa';
  sheet?: string;
  row?: number;
  formula?: string;
}

export interface ManualAuxiliaryDetail {
  token: string;
  name: string;
  type: string;
  sheet: string;
  row: number;
  condition?: string;
  trueFormula?: string;
  falseFormula?: string;
  value?: string;
  accumulatorConcepts: ManualAccumulatorConcept[];
}

export interface ManualAccumulatorConcept {
  conceptId?: number;
  conceptName?: string;
  operation?: string;
}

export interface ManualRelatedIssue {
  title: string;
  message: string;
  recommendation?: string;
  location?: CellLocation;
}
