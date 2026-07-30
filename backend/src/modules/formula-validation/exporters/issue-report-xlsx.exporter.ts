import ExcelJS from 'exceljs';
import { StoredValidationResult, ValidationIssue } from '../types/validation.types';

const reportHeaders = [
  'Nro',
  'Tipo de control',
  'Donde esta el error',
  'Tabla',
  'Columna',
  'Fila',
  'Entidad afectada',
  'Error encontrado',
  'Que puede afectar',
  'Que revisar o corregir',
  'Formula o valor original',
  'Posible reemplazo',
];

export const exportIssueReportXlsx = async (result: StoredValidationResult): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'e-Sueldos Auditoria de formulas';
  workbook.created = new Date();

  buildSummarySheet(workbook, result);
  buildIssuesSheet(workbook, result);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
};

const buildSummarySheet = (workbook: ExcelJS.Workbook, result: StoredValidationResult): void => {
  const sheet = workbook.addWorksheet('Resumen');
  sheet.columns = [
    { key: 'label', width: 34 },
    { key: 'value', width: 72 },
  ];

  sheet.addRow(['Reporte de errores detectados', '']);
  sheet.mergeCells('A1:B1');
  sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5BFF' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 30;

  const summaryRows = [
    ['Archivo analizado', result.fileName],
    ['Fecha del analisis', formatDate(result.summary.analysisFinishedAt)],
    ['Total de hallazgos', result.summary.totalIssues],
    ['Tablas auditadas', 'Conceptos y Formulas (1); Calculo Auxiliares (3)'],
    ['Conceptos analizados', result.summary.conceptsAnalyzed],
    ['Formulas analizadas', result.summary.formulasAnalyzed],
    ['Auxiliares analizados', result.summary.auxiliariesAnalyzed],
  ];

  summaryRows.forEach((row) => sheet.addRow(row));
  sheet.addRow([]);
  sheet.addRow(['Como usar este reporte', 'Revisar la hoja "Errores detectados". Cada fila indica tabla, columna, fila, entidad afectada, que puede afectar y que conviene corregir.']);

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    row.eachCell((cell, columnNumber) => {
      cell.border = thinBorder();
      cell.alignment = { vertical: 'top', wrapText: true };
      if (columnNumber === 1 && cell.value) {
        cell.font = { bold: true, color: { argb: 'FF243247' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF4FF' } };
      }
    });
  });
};

const buildIssuesSheet = (workbook: ExcelJS.Workbook, result: StoredValidationResult): void => {
  const sheet = workbook.addWorksheet('Errores detectados');
  sheet.columns = [
    { key: 'number', width: 8 },
    { key: 'controlType', width: 24 },
    { key: 'location', width: 42 },
    { key: 'sheet', width: 28 },
    { key: 'column', width: 14 },
    { key: 'row', width: 10 },
    { key: 'entity', width: 34 },
    { key: 'message', width: 54 },
    { key: 'impact', width: 54 },
    { key: 'recommendation', width: 54 },
    { key: 'formula', width: 42 },
    { key: 'replacement', width: 42 },
  ];

  sheet.addRow(reportHeaders);
  styleHeaderRow(sheet.getRow(1));

  const reportRows = mergeEquivalentIssueRows(result.issues);

  reportRows.forEach((reportRow, index) => {
    const { issue } = reportRow;
    const row = sheet.addRow([
      index + 1,
      controlTypeLabel(issue),
      locationLabel(reportRow),
      issue.sheet ?? 'Tabla no informada',
      reportRow.columnLabel,
      issue.row ?? '',
      entityLabel(issue),
      messageLabel(reportRow),
      impactLabel(issue),
      recommendationReportLabel(reportRow),
      issue.formula ?? issue.invalidFragment ?? '',
      replacementReportLabel(reportRow),
    ]);

    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = thinBorder();
    });
  });

  sheet.autoFilter = {
    from: 'A1',
    to: `L${Math.max(1, sheet.rowCount)}`,
  };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getColumn('A').alignment = { horizontal: 'center', vertical: 'top' };
  sheet.getColumn('F').alignment = { horizontal: 'center', vertical: 'top' };
};

interface IssueReportRow {
  issue: ValidationIssue;
  issues: ValidationIssue[];
  columns: string[];
  columnLabel: string;
}

const mergeEquivalentIssueRows = (issues: ValidationIssue[]): IssueReportRow[] => {
  const groups = new Map<string, IssueReportRow>();

  issues.forEach((issue) => {
    const key = issueReportGroupKey(issue);
    const column = columnLabel(issue);
    const existing = groups.get(key);

    if (existing) {
      existing.issues.push(issue);
      existing.columns = mergeColumns(existing.columns, column);
      existing.columnLabel = columnListLabel(existing.columns);
      return;
    }

    const columns = column ? [column] : [];
    groups.set(key, {
      issue,
      issues: [issue],
      columns,
      columnLabel: columnListLabel(columns) || '-',
    });
  });

  return Array.from(groups.values());
};

const issueReportGroupKey = (issue: ValidationIssue): string => {
  if (isMissingReferenceIssue(issue)) {
    return [
      issue.category,
      issue.code,
      issue.severity,
      issue.sheet ?? '',
      issue.row ?? '',
      issue.entityType ?? '',
      issue.entityId ?? '',
      issue.entityName ?? '',
      issue.formula ?? '',
      issue.blocksImport ? '1' : '0',
    ].join('\u001f');
  }

  return [
    issue.code,
    controlTypeLabel(issue),
    issue.sheet ?? '',
    issue.row ?? '',
    issue.entityType ?? '',
    issue.entityId ?? '',
    issue.entityName ?? '',
    humanizeText(issue.message) ?? issue.title,
    impactLabel(issue),
    recommendationLabel(issue),
    issue.formula ?? issue.invalidFragment ?? '',
    replacementLabel(issue),
    issue.invalidFragment ?? '',
    issue.referenceType ?? '',
    issue.referenceId ?? '',
    issue.blocksImport ? '1' : '0',
  ].join('\u001f');
};

const mergeColumns = (columns: string[], column: string): string[] => {
  const unique = new Set([...columns, column].filter((value) => value && value !== '-'));
  return Array.from(unique).sort(compareColumnLabels);
};

const compareColumnLabels = (left: string, right: string): number => columnNumber(left) - columnNumber(right);

const columnNumber = (column: string): number =>
  column
    .toUpperCase()
    .split('')
    .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);

const columnListLabel = (columns: string[]): string => {
  const cleanColumns = columns.filter((column) => column && column !== '-');
  if (cleanColumns.length === 0) {
    return '-';
  }
  if (cleanColumns.length === 1) {
    return cleanColumns[0];
  }
  if (cleanColumns.length === 2) {
    return `${cleanColumns[0]} y ${cleanColumns[1]}`;
  }

  return `${cleanColumns.slice(0, -1).join(', ')} y ${cleanColumns[cleanColumns.length - 1]}`;
};

const styleHeaderRow = (row: ExcelJS.Row): void => {
  row.height = 25;
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102243' } };
  row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  row.eachCell((cell) => {
    cell.border = thinBorder();
  });
};

const thinBorder = (): Partial<ExcelJS.Borders> => ({
  top: { style: 'thin', color: { argb: 'FFDCE6F4' } },
  left: { style: 'thin', color: { argb: 'FFDCE6F4' } },
  bottom: { style: 'thin', color: { argb: 'FFDCE6F4' } },
  right: { style: 'thin', color: { argb: 'FFDCE6F4' } },
});

const locationLabel = (reportRow: IssueReportRow): string =>
  [
    reportRow.issue.sheet ?? 'Tabla no informada',
    `${reportRow.columns.length > 1 ? 'Columnas' : 'Columna'} ${reportRow.columnLabel}`,
    reportRow.issue.row ? `Fila ${reportRow.issue.row}` : undefined,
  ]
    .filter(Boolean)
    .join(' > ');

const columnLabel = (issue: ValidationIssue): string => issue.column || columnFromCell(issue.cell) || '-';

const columnFromCell = (cell?: string): string => {
  const match = /^([A-Z]+)/i.exec(cell ?? '');
  return match?.[1]?.toUpperCase() ?? '';
};

const entityLabel = (issue: ValidationIssue): string =>
  [entityTypeLabel(issue.entityType), issue.entityId, issue.entityName].filter(Boolean).join(' ') || '-';

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

const controlTypeLabel = (issue: ValidationIssue): string => {
  if (issue.category === 'FUNCTIONAL_AUDIT') {
    return 'Auditoria funcional del PDF';
  }
  if (issue.code === 'DUPLICATE_IDENTICAL' || issue.code === 'DUPLICATE_CONFLICT' || issue.category === 'DUPLICATES') {
    return 'Duplicados y conflictos';
  }
  if (issue.category === 'REFERENCES') {
    return 'Referencias no encontradas';
  }
  if (issue.category.startsWith('FORMULA') || issue.category === 'FORMULA_TYPE') {
    return 'Errores de formulas';
  }
  if (issue.category === 'AUXILIARIES') {
    return 'Controles de soporte';
  }
  if (issue.category === 'WORKBOOK_STRUCTURE' || issue.category === 'CATALOGS') {
    return 'Errores del Excel';
  }
  return 'Errores de carga de datos';
};

const messageLabel = (reportRow: IssueReportRow): string => {
  const missingReferences = missingReferenceFragments(reportRow);
  if (missingReferences.length <= 1) {
    return humanizeText(reportRow.issue.message) ?? reportRow.issue.title;
  }

  const targetLabel = referenceTargetsLabel(reportRow.issues);
  return `La formula contiene referencias inexistentes: ${textListLabel(missingReferences)}. No existen en ${targetLabel}.`;
};

const impactLabel = (issue: ValidationIssue): string => {
  if (issue.aiExplanation?.impact) {
    return issue.aiExplanation.impact;
  }
  return humanizeText(issue.explanation) ?? 'Puede afectar la correcta interpretacion de la formula o del dato cargado.';
};

const recommendationReportLabel = (reportRow: IssueReportRow): string => {
  const missingReferences = missingReferenceFragments(reportRow);
  if (missingReferences.length <= 1) {
    return recommendationLabel(reportRow.issue);
  }

  return `Revisar juntas las referencias faltantes ${textListLabel(
    missingReferences,
  )}. Crear las definiciones faltantes o corregir los identificadores usados en la formula indicada.`;
};

const recommendationLabel = (issue: ValidationIssue): string => {
  if (issue.aiExplanation?.suggestedAction) {
    return issue.aiExplanation.suggestedAction;
  }
  return humanizeText(issue.recommendation) ?? 'Revisar la fila indicada y corregir el dato segun la definicion esperada.';
};

const replacementReportLabel = (reportRow: IssueReportRow): string =>
  uniqueText(reportRow.issues.map(replacementLabel)).filter(Boolean).join('\n');

const replacementLabel = (issue: ValidationIssue): string => {
  const suggestion = issue.replacementSuggestions?.[0];
  if (!suggestion) {
    return '';
  }
  return `${issue.invalidFragment ?? 'Referencia'} -> ${suggestion.token}. ${suggestion.reason}`;
};

const isMissingReferenceIssue = (issue: ValidationIssue): boolean =>
  issue.category === 'REFERENCES' &&
  Boolean(issue.invalidFragment) &&
  [
    'MISSING_AUXILIARY_REFERENCE',
    'MISSING_CONCEPT_REFERENCE',
    'MISSING_LEG_VARIABLE_REFERENCE',
  ].includes(issue.code);

const missingReferenceFragments = (reportRow: IssueReportRow): string[] => {
  if (!reportRow.issues.every(isMissingReferenceIssue)) {
    return [];
  }
  return uniqueText(reportRow.issues.map((issue) => issue.invalidFragment ?? ''));
};

const referenceTargetsLabel = (issues: ValidationIssue[]): string => {
  const labels = uniqueText(issues.map(referenceTargetName));
  if (labels.length === 1) {
    return `la tabla de ${labels[0]}`;
  }
  return `las tablas correspondientes (${textListLabel(labels)})`;
};

const referenceTargetName = (issue: ValidationIssue): string => {
  if (issue.referenceType === 'A') {
    return 'calculo auxiliar';
  }
  if (issue.referenceType === 'L') {
    return 'variable de legajo';
  }
  if (issue.referenceType === 'N' || issue.referenceType === 'I') {
    return 'novedad/concepto';
  }
  return 'concepto';
};

const uniqueText = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const cleanValue = value.trim();
    if (!cleanValue || seen.has(cleanValue)) {
      return false;
    }
    seen.add(cleanValue);
    return true;
  });
};

const textListLabel = (values: string[]): string => {
  if (values.length === 0) {
    return '';
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} y ${values[1]}`;
  }
  return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`;
};

const humanizeText = (value?: string): string | undefined =>
  value
    ?.replace(/\bCONCEPT\b/g, 'Concepto')
    .replace(/\bAUXILIARY\b/g, 'Auxiliar')
    .replace(/\bACCUMULATOR\b/g, 'Acumulador')
    .replace(/\bLEG_VARIABLE\b/g, 'Variable de legajo')
    .replace(/\bCONVENTION\b/g, 'Convenio')
    .replace(/\bWORKBOOK\b/g, 'Archivo');

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('es-AR');
};
