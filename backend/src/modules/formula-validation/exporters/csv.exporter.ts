import { StoredValidationResult, ValidationIssue } from '../types/validation.types';

const columns = [
  'Titulo',
  'Hoja',
  'Fila',
  'Columna',
  'Celda',
  'Entidad',
  'Formula',
  'Descripcion',
  'Explicacion',
  'Recomendacion',
];

const escape = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }
  const text = Array.isArray(value) ? value.join(' -> ') : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const exportCsv = (result: StoredValidationResult): Buffer => {
  const lines = [
    columns.join(','),
    ...result.issues.map((issue) =>
      [
        issue.title,
        issue.sheet,
        issue.row,
        issue.column,
        issue.cell,
        entityLabel(issue),
        issue.formula,
        humanizeText(issue.message),
        humanizeText(issue.explanation),
        humanizeText(issue.recommendation),
      ]
        .map(escape)
        .join(','),
    ),
  ];
  return Buffer.from(lines.join('\n'), 'utf-8');
};

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

const humanizeText = (value?: string): string | undefined =>
  value
    ?.replace(/\bCONCEPT\b/g, 'Concepto')
    .replace(/\bAUXILIARY\b/g, 'Auxiliar')
    .replace(/\bACCUMULATOR\b/g, 'Acumulador')
    .replace(/\bLEG_VARIABLE\b/g, 'Variable de legajo')
    .replace(/\bCONVENTION\b/g, 'Convenio')
    .replace(/\bWORKBOOK\b/g, 'Archivo');
