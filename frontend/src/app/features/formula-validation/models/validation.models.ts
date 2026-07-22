export type ValidationSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
export type AnalysisStatus = 'VALID' | 'VALID_WITH_WARNINGS' | 'BLOCKED' | 'FAILED';

export interface RelatedLocation {
  sheet: string;
  row: number;
  column?: string;
  cell?: string;
}

export interface DependencyNodeDetail extends RelatedLocation {
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
  entityType?: string;
  entityId?: number | string;
  entityName?: string;
  formula?: string;
  invalidFragment?: string;
  referenceType?: string;
  referenceId?: number;
  dependencyPath?: string[];
  dependencyDetails?: DependencyNodeDetail[];
  aiExplanation?: AiIssueExplanation;
  replacementSuggestions?: ReplacementSuggestion[];
  relatedLocations?: RelatedLocation[];
  blocksImport: boolean;
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
