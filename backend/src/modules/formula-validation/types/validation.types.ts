import { EntityType, CellLocation } from './workbook.types';

export type ValidationSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';

export type AnalysisStatus = 'VALID' | 'VALID_WITH_WARNINGS' | 'BLOCKED' | 'FAILED';

export const IssueCodes = {
  INVALID_WORKBOOK: 'INVALID_WORKBOOK',
  MISSING_REQUIRED_SHEET: 'MISSING_REQUIRED_SHEET',
  MISSING_REQUIRED_COLUMN: 'MISSING_REQUIRED_COLUMN',
  DUPLICATE_HEADER: 'DUPLICATE_HEADER',
  UNKNOWN_COLUMN: 'UNKNOWN_COLUMN',
  INVALID_ROW: 'INVALID_ROW',
  INVALID_IDENTIFIER: 'INVALID_IDENTIFIER',
  MISSING_NAME: 'MISSING_NAME',
  INVALID_DATA_TYPE: 'INVALID_DATA_TYPE',
  DUPLICATE_IDENTICAL: 'DUPLICATE_IDENTICAL',
  DUPLICATE_CONFLICT: 'DUPLICATE_CONFLICT',
  INVALID_FORMULA_SYNTAX: 'INVALID_FORMULA_SYNTAX',
  FORMULA_TEXT_IN_CALCULATION_COLUMN: 'FORMULA_TEXT_IN_CALCULATION_COLUMN',
  MISSING_AUXILIARY_REFERENCE: 'MISSING_AUXILIARY_REFERENCE',
  MISSING_CONCEPT_REFERENCE: 'MISSING_CONCEPT_REFERENCE',
  MISSING_LEG_VARIABLE_REFERENCE: 'MISSING_LEG_VARIABLE_REFERENCE',
  INVALID_CONDITION_TYPE: 'INVALID_CONDITION_TYPE',
  INVALID_FORMULA_TYPE: 'INVALID_FORMULA_TYPE',
  FORMULA_TYPE_MISMATCH: 'FORMULA_TYPE_MISMATCH',
  INCOMPLETE_CONDITIONAL_FORMULA: 'INCOMPLETE_CONDITIONAL_FORMULA',
  FORMULA_SCOPE_MISMATCH: 'FORMULA_SCOPE_MISMATCH',
  CALCULATION_ORDER_REVIEW: 'CALCULATION_ORDER_REVIEW',
  UNIT_USES_AMOUNT_REFERENCE: 'UNIT_USES_AMOUNT_REFERENCE',
  CONDITION_USES_RESULT_REFERENCE: 'CONDITION_USES_RESULT_REFERENCE',
  TOTALIZES_VALUE_INVALID: 'TOTALIZES_VALUE_INVALID',
  PRE_POST_WITHOUT_MAIN_FORMULA: 'PRE_POST_WITHOUT_MAIN_FORMULA',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  SELF_REFERENCE: 'SELF_REFERENCE',
  MISSING_ACCUMULATOR_ID: 'MISSING_ACCUMULATOR_ID',
  INVALID_AUXILIARY_ROW: 'INVALID_AUXILIARY_ROW',
  INVALID_ACCUMULATOR_ROW: 'INVALID_ACCUMULATOR_ROW',
  AUXILIARY_VALUE_MISSING: 'AUXILIARY_VALUE_MISSING',
  AUXILIARY_VALUE_HAS_FORMULA: 'AUXILIARY_VALUE_HAS_FORMULA',
  AUXILIARY_ACCUMULATOR_HAS_FORMULA: 'AUXILIARY_ACCUMULATOR_HAS_FORMULA',
  AUXILIARY_FORMULA_HAS_ACCUMULATOR_COMPONENTS: 'AUXILIARY_FORMULA_HAS_ACCUMULATOR_COMPONENTS',
  ACCUMULATOR_CONCEPT_NAME_MISMATCH: 'ACCUMULATOR_CONCEPT_NAME_MISMATCH',
  ACCUMULATOR_CONTRADICTORY_OPERATION: 'ACCUMULATOR_CONTRADICTORY_OPERATION',
  SCHEMA_DRIFT: 'SCHEMA_DRIFT',
} as const;

export interface ValidationIssue {
  id: string;
  code: string;
  severity: ValidationSeverity;
  category: string;
  title: string;
  message: string;
  explanation: string;
  recommendation?: string;
  sheet?: string;
  row?: number;
  column?: string;
  cell?: string;
  entityType?: EntityType;
  entityId?: number | string;
  entityName?: string;
  formula?: string;
  invalidFragment?: string;
  referenceType?: 'N' | 'I' | 'A' | 'R' | 'U' | 'L';
  referenceId?: number;
  dependencyPath?: string[];
  dependencyDetails?: DependencyNodeDetail[];
  aiExplanation?: AiIssueExplanation;
  replacementSuggestions?: ReplacementSuggestion[];
  relatedLocations?: CellLocation[];
  blocksImport: boolean;
}

export interface DependencyNodeDetail extends CellLocation {
  node: string;
  label: string;
  formula?: string;
}

export interface AiIssueExplanation {
  model: string;
  summary: string;
  impact: string;
  reviewSteps: string[];
  suggestedAction: string;
  confidenceNote: string;
  generatedAt: string;
}

export type ReplacementSuggestionConfidence = 'ALTA' | 'MEDIA' | 'BAJA';

export interface ReplacementSuggestion {
  token: string;
  label: string;
  reason: string;
  confidence: ReplacementSuggestionConfidence;
  score: number;
  sheet?: string;
  row?: number;
  cell?: string;
  formula?: string;
}

export interface ValidationSummary {
  status: AnalysisStatus;
  totalIssues: number;
  critical: number;
  errors: number;
  warnings: number;
  info: number;
  sheetsAnalyzed: number;
  conceptsAnalyzed: number;
  variablesAnalyzed: number;
  auxiliariesAnalyzed: number;
  accumulatorsAnalyzed: number;
  formulasAnalyzed: number;
  analysisStartedAt: string;
  analysisFinishedAt: string;
  durationMs: number;
}

export interface ValidationResult {
  id: string;
  fileName: string;
  summary: ValidationSummary;
  issues: ValidationIssue[];
  createdAt: string;
  expiresAt: string;
}

export interface ValidationHistoryItem {
  id: string;
  fileName: string;
  summary: ValidationSummary;
  createdAt: string;
  expiresAt: string;
}

export interface StoredValidationResult extends ValidationResult {
  sourceBuffer?: Buffer;
}
