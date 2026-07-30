import fs from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {
  ColumnSchema,
  normalizeSheetName,
  normalizeText,
  SheetSchema,
  workbookSchema,
} from '../../../config/schema';
import { FormulaParser } from '../parsers/formula-parser';
import {
  AccumulatorRecord,
  AuxiliaryRecord,
  BaseRecord,
  ConceptRecord,
  ConventionRecord,
  FormulaCell,
  LegVariableRecord,
  SheetContext,
  SheetKey,
  SourceColumn,
  WorkbookContext,
  EntityType,
} from '../types/workbook.types';
import { locationFor, normalizeCellValue, normalizeForSignature, toNumberId } from '../domain/normalization';

const parser = new FormulaParser();

const entityTypeBySheet: Record<SheetKey, EntityType> = {
  concepts: 'CONCEPT',
  variables: 'LEG_VARIABLE',
  auxiliaries: 'AUXILIARY',
  accumulators: 'ACCUMULATOR',
  conventions: 'CONVENTION',
};

const columnLetter = (index: number): string => {
  let value = index;
  let letter = '';
  while (value > 0) {
    const modulo = (value - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    value = Math.floor((value - modulo) / 26);
  }
  return letter;
};

const getCellValue = (worksheet: ExcelJS.Worksheet, row: number, column: number): unknown =>
  normalizeCellValue(worksheet.getRow(row).getCell(column).value);

export class ExcelReaderService {
  async read(filePath: string, originalFileName: string): Promise<WorkbookContext> {
    const sourceBuffer = await fs.readFile(filePath);
    return this.readBuffer(sourceBuffer, originalFileName);
  }

  async readBuffer(sourceBuffer: Buffer, originalFileName: string): Promise<WorkbookContext> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(sourceBuffer);

    const sheets: Partial<Record<SheetKey, SheetContext>> = {};
    const missingSheets: string[] = [];
    const concepts: ConceptRecord[] = [];
    const variables: LegVariableRecord[] = [];
    const auxiliaries: AuxiliaryRecord[] = [];
    const accumulators: AccumulatorRecord[] = [];
    const conventions: ConventionRecord[] = [];
    const formulaCells: FormulaCell[] = [];

    for (const schema of workbookSchema) {
      const worksheet = this.findWorksheet(workbook, schema);
      if (!worksheet) {
        if (schema.required) {
          missingSheets.push(schema.canonicalName);
        }
        continue;
      }

      const sheetContext = this.buildSheetContext(worksheet, schema);
      sheets[schema.key] = sheetContext;
      const records = this.collectRecords(worksheet, schema, sheetContext);

      if (schema.key === 'concepts') {
        const typed = records.map((record) => ({ ...record, entityType: 'CONCEPT' as const })) as ConceptRecord[];
        concepts.push(...typed);
        formulaCells.push(...this.collectFormulaCells(typed, sheetContext, schema));
      }
      if (schema.key === 'variables') {
        variables.push(
          ...(records.map((record) => ({
            ...record,
            entityType: 'LEG_VARIABLE' as const,
          })) as LegVariableRecord[]),
        );
      }
      if (schema.key === 'auxiliaries') {
        const typed = records.map((record) => ({
          ...record,
          entityType: 'AUXILIARY' as const,
        })) as AuxiliaryRecord[];
        auxiliaries.push(...typed);
        formulaCells.push(...this.collectFormulaCells(typed, sheetContext, schema));
      }
      if (schema.key === 'accumulators') {
        accumulators.push(
          ...(records.map((record) => ({
            ...record,
            entityType: 'ACCUMULATOR' as const,
          })) as AccumulatorRecord[]),
        );
      }
      if (schema.key === 'conventions') {
        conventions.push(
          ...(records.map((record) => ({
            ...record,
            entityType: 'CONVENTION' as const,
          })) as ConventionRecord[]),
        );
      }
    }

    return {
      originalFileName,
      sourceBuffer,
      sheets,
      missingSheets,
      concepts,
      variables,
      auxiliaries,
      accumulators,
      conventions,
      formulaCells,
    };
  }

  private findWorksheet(workbook: ExcelJS.Workbook, schema: SheetSchema): ExcelJS.Worksheet | undefined {
    const aliases = [schema.canonicalName, ...schema.aliases].map(normalizeSheetName);
    return workbook.worksheets.find((worksheet) => aliases.includes(normalizeSheetName(worksheet.name)));
  }

  private buildSheetContext(worksheet: ExcelJS.Worksheet, schema: SheetSchema): SheetContext {
    const headerRow = this.findHeaderRow(worksheet, schema);
    const headerValues = this.readHeaderValues(worksheet, headerRow);
    const columns: Record<string, SourceColumn> = {};
    const unknownHeaders: SourceColumn[] = [];
    const duplicateHeaders = this.findDuplicateHeaders(headerValues);

    headerValues.forEach((header, index) => {
      const columnIndex = index + 1;
      const column = columnLetter(columnIndex);
      const matched = this.matchColumn(schema, header);
      if (matched && !columns[matched.key]) {
        columns[matched.key] = {
          key: matched.key,
          label: matched.label,
          column,
          index: columnIndex,
          role: matched.role,
        };
        return;
      }
      if (header && !matched) {
        unknownHeaders.push({
          key: normalizeText(header),
          label: header,
          column,
          index: columnIndex,
        });
      }
    });

    if (schema.key === 'accumulators' && !columns.code) {
      columns.code = {
        key: 'code',
        label: 'Acumulador Código',
        column: 'A',
        index: 1,
      };
    }

    return {
      key: schema.key,
      name: worksheet.name,
      headerRow,
      columns,
      headerValues,
      unknownHeaders,
      duplicateHeaders,
    };
  }

  private findHeaderRow(worksheet: ExcelJS.Worksheet, schema: SheetSchema): number {
    let bestRow = schema.minHeaderRow;
    let bestScore = -1;
    for (let rowNumber = schema.minHeaderRow; rowNumber <= schema.maxHeaderRow; rowNumber += 1) {
      const headers = this.readHeaderValues(worksheet, rowNumber);
      const score = headers.reduce((total, header) => {
        if (!header) {
          return total;
        }
        return total + (this.matchColumn(schema, header) ? 2 : 0);
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        bestRow = rowNumber;
      }
    }
    return bestRow;
  }

  private readHeaderValues(worksheet: ExcelJS.Worksheet, rowNumber: number): Array<string | null> {
    const row = worksheet.getRow(rowNumber);
    const values: Array<string | null> = [];
    for (let index = 1; index <= worksheet.columnCount; index += 1) {
      const raw = normalizeCellValue(row.getCell(index).value);
      values.push(typeof raw === 'string' ? raw : raw === undefined ? null : String(raw));
    }
    return values;
  }

  private matchColumn(schema: SheetSchema, header: string | null): ColumnSchema | undefined {
    const normalized = normalizeText(header ?? '');
    return schema.columns.find((column) => {
      const aliases = [column.label, ...(column.aliases ?? [])].map(normalizeText);
      return aliases.includes(normalized);
    });
  }

  private findDuplicateHeaders(headers: Array<string | null>): string[] {
    const counts = new Map<string, number>();
    headers.forEach((header) => {
      if (!header) {
        return;
      }
      const normalized = normalizeText(header);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
    return [...counts.entries()].filter(([, count]) => count > 1).map(([header]) => header);
  }

  private collectRecords(
    worksheet: ExcelJS.Worksheet,
    schema: SheetSchema,
    sheetContext: SheetContext,
  ): BaseRecord[] {
    const records: BaseRecord[] = [];
    for (let rowNumber = sheetContext.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      if (this.isBusinessRowEmpty(worksheet, rowNumber, sheetContext)) {
        continue;
      }

      const record = this.buildRecord(worksheet, rowNumber, schema, sheetContext);
      records.push(record);
    }
    return records;
  }

  private isBusinessRowEmpty(
    worksheet: ExcelJS.Worksheet,
    rowNumber: number,
    sheetContext: SheetContext,
  ): boolean {
    const columns = Object.values(sheetContext.columns);
    return columns.every((column) => {
      const raw = getCellValue(worksheet, rowNumber, column.index);
      return raw === undefined || raw === null || raw === '';
    });
  }

  private buildRecord(
    worksheet: ExcelJS.Worksheet,
    rowNumber: number,
    schema: SheetSchema,
    sheetContext: SheetContext,
  ): BaseRecord {
    const originalValues: Record<string, unknown> = {};
    const normalizedValues: Record<string, unknown> = {};
    const sourceColumns: BaseRecord['sourceColumns'] = {};
    const dynamic: Record<string, unknown> = {};

    schema.columns.forEach((columnSchema) => {
      const mapped = sheetContext.columns[columnSchema.key];
      if (!mapped) {
        return;
      }
      const raw = getCellValue(worksheet, rowNumber, mapped.index);
      const field = columnSchema.entityField ?? columnSchema.key;
      originalValues[field] = raw;
      normalizedValues[field] = normalizeForSignature(raw);
      sourceColumns[field] = locationFor(worksheet.name, rowNumber, mapped.column);
      dynamic[field] = raw;
    });

    const id = toNumberId(dynamic.id);
    if ('conceptId' in dynamic) {
      dynamic.conceptId = toNumberId(dynamic.conceptId);
    }
    if ('sequence' in dynamic) {
      dynamic.sequence = toNumberId(dynamic.sequence);
    }
    const name = typeof dynamic.name === 'string' ? dynamic.name : undefined;

    return {
      ...dynamic,
      id,
      name,
      sheet: worksheet.name,
      row: rowNumber,
      entityType: entityTypeBySheet[schema.key],
      sourceColumns,
      originalValues,
      normalizedValues,
    } as BaseRecord;
  }

  private collectFormulaCells(
    records: Array<ConceptRecord | AuxiliaryRecord>,
    sheetContext: SheetContext,
    schema: SheetSchema,
  ): FormulaCell[] {
    const formulaCells: FormulaCell[] = [];
    const formulaColumns = schema.columns.filter((column) => column.role);

    records.forEach((record) => {
      formulaColumns.forEach((columnSchema) => {
        const field = columnSchema.entityField ?? columnSchema.key;
        const formula = record.originalValues[field];
        if (typeof formula !== 'string' || formula.startsWith('=')) {
          return;
        }
        const sourceColumn = sheetContext.columns[columnSchema.key];
        if (!sourceColumn) {
          return;
        }
        formulaCells.push({
          sheet: record.sheet,
          row: record.row,
          column: sourceColumn.column,
          cell: `${sourceColumn.column}${record.row}`,
          role: columnSchema.role!,
          entityType: record.entityType,
          entityId: record.id,
          entityName: record.name,
          formula,
          parseResult: parser.parse(formula),
        });
      });
    });

    return formulaCells;
  }
}
