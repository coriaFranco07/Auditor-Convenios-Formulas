import ExcelJS from 'exceljs';
import { StoredValidationResult } from '../types/validation.types';

const headers = [
  'Titulo',
  'Hoja',
  'Fila',
  'Columna',
  'Celda',
  'Entidad',
  'Formula',
  'Mensaje',
  'Explicacion',
  'Recomendacion',
];

export const exportMarkedXlsx = async (result: StoredValidationResult): Promise<Buffer> => {
  if (!result.sourceBuffer) {
    throw new Error('El archivo original ya no esta disponible para exportar el Excel marcado.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.sourceBuffer);

  const existing = workbook.getWorksheet('Informe de control');
  if (existing) {
    workbook.removeWorksheet(existing.id);
  }
  const report = workbook.addWorksheet('Informe de control');
  report.addRow(headers);
  report.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  report.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };

  result.issues.forEach((issue) => {
    report.addRow([
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
    ]);

    if (issue.sheet && issue.cell) {
      const sheet = workbook.getWorksheet(issue.sheet);
      const cell = sheet?.getCell(issue.cell);
      if (cell) {
        cell.note = `${issue.title}: ${humanizeText(issue.message)}`;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF3CD' },
        };
      }
    }
  });

  report.columns.forEach((column) => {
    column.width = Math.min(60, Math.max(12, Number(column.header?.toString().length ?? 12) + 4));
  });
  report.autoFilter = {
    from: 'A1',
    to: `J${Math.max(1, report.rowCount)}`,
  };
  report.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
};

const entityLabel = (issue: StoredValidationResult['issues'][number]): string =>
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
