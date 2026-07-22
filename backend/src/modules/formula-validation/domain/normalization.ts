import { normalizeText } from '../../../config/schema';
import { BaseRecord, CellLocation } from '../types/workbook.types';

export const toNumberId = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return undefined;
};

export const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

export const normalizeCellValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (value && typeof value === 'object' && 'result' in value) {
    return normalizeCellValue((value as { result?: unknown }).result);
  }
  if (value && typeof value === 'object' && 'formula' in value) {
    return `=${String((value as { formula: unknown }).formula)}`;
  }
  if (value === null) {
    return undefined;
  }
  return value;
};

export const normalizeForSignature = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return normalizeText(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? value : Number(value.toFixed(8));
  }
  return value ?? null;
};

export const recordSignature = (record: BaseRecord): string =>
  JSON.stringify(record.normalizedValues, Object.keys(record.normalizedValues).sort());

export const locationFor = (sheet: string, row: number, column: string): CellLocation => ({
  sheet,
  row,
  column,
  cell: `${column}${row}`,
});
