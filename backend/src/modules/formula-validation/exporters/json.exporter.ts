import { StoredValidationResult, ValidationIssue } from '../types/validation.types';

export const exportJson = (result: StoredValidationResult): Buffer => {
  const report = {
    id: result.id,
    fileName: result.fileName,
    createdAt: result.createdAt,
    summary: {
      totalIssues: result.summary.totalIssues,
      sheetsAnalyzed: result.summary.sheetsAnalyzed,
      conceptsAnalyzed: result.summary.conceptsAnalyzed,
      variablesAnalyzed: result.summary.variablesAnalyzed,
      auxiliariesAnalyzed: result.summary.auxiliariesAnalyzed,
      formulasAnalyzed: result.summary.formulasAnalyzed,
      analysisStartedAt: result.summary.analysisStartedAt,
      analysisFinishedAt: result.summary.analysisFinishedAt,
      durationMs: result.summary.durationMs,
    },
    issues: result.issues.map(publicIssue),
  };
  return Buffer.from(JSON.stringify(report, null, 2), 'utf-8');
};

const publicIssue = (issue: ValidationIssue): Record<string, unknown> => ({
  title: issue.title,
  message: issue.message,
  explanation: issue.explanation,
  recommendation: issue.recommendation,
  sheet: issue.sheet,
  row: issue.row,
  column: issue.column,
  cell: issue.cell,
  entity: entityLabel(issue),
  formula: issue.formula,
  invalidFragment: issue.invalidFragment,
  dependencyPath: issue.dependencyPath,
  dependencyDetails: issue.dependencyDetails,
  relatedLocations: issue.relatedLocations,
});

const entityLabel = (issue: ValidationIssue): string =>
  [entityTypeLabel(issue.entityType), issue.entityId, issue.entityName].filter(Boolean).join(' ');

const entityTypeLabel = (entityType?: string): string => {
  const labels: Record<string, string> = {
    CONCEPT: 'Concepto',
    AUXILIARY: 'Auxiliar',
    ACCUMULATOR: 'Acumulador',
    LEG_VARIABLE: 'Variable de legajo',
    CONVENTION: 'Convenio',
    WORKBOOK: 'Archivo',
  };
  return entityType ? labels[entityType] ?? entityType : '';
};
