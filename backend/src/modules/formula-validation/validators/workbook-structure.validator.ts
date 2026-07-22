import { workbookSchema } from '../../../config/schema';
import { createIssue } from '../domain/issue-factory';
import { isBlank, toNumberId } from '../domain/normalization';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { BaseRecord, WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class WorkbookStructureValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    context.missingSheets.forEach((sheet) => {
      issues.push(
        createIssue({
          code: IssueCodes.MISSING_REQUIRED_SHEET,
          severity: 'CRITICAL',
          category: 'WORKBOOK_STRUCTURE',
          title: 'Hoja obligatoria ausente',
          message: `No se encontro la hoja obligatoria "${sheet}".`,
          explanation: 'El archivo no puede analizarse correctamente sin todas las hojas del esquema.',
          recommendation: 'Verificar que el archivo exportado incluya todas las hojas requeridas.',
          entityType: 'WORKBOOK',
        }),
      );
    });

    workbookSchema.forEach((schema) => {
      const sheet = context.sheets[schema.key];
      if (!sheet) {
        return;
      }

      schema.columns
        .filter((column) => column.required)
        .forEach((column) => {
          if (!sheet.columns[column.key]) {
            issues.push(
              createIssue({
                code: IssueCodes.MISSING_REQUIRED_COLUMN,
                severity: 'CRITICAL',
                category: 'WORKBOOK_STRUCTURE',
                title: 'Encabezado obligatorio ausente',
                message: `La hoja "${sheet.name}" no contiene la columna obligatoria "${column.label}".`,
                explanation: 'El analizador necesita esa columna para construir la tabla de simbolos.',
                recommendation: 'Revisar el encabezado o restaurar la columna esperada.',
                location: { sheet: sheet.name, row: sheet.headerRow },
                entityType: 'WORKBOOK',
              }),
            );
          }
        });

      sheet.duplicateHeaders.forEach((header) => {
        issues.push(
          createIssue({
            code: IssueCodes.DUPLICATE_HEADER,
            severity: 'ERROR',
            category: 'WORKBOOK_STRUCTURE',
            title: 'Encabezado duplicado',
            message: `La hoja "${sheet.name}" contiene el encabezado duplicado "${header}".`,
            explanation: 'Los encabezados repetidos vuelven ambigua la interpretacion de las columnas.',
            recommendation: 'Dejar un solo encabezado para cada columna de negocio.',
            location: { sheet: sheet.name, row: sheet.headerRow },
            entityType: 'WORKBOOK',
            blocksImport: true,
          }),
        );
      });

      sheet.unknownHeaders.forEach((column) => {
        issues.push(
          createIssue({
            code: IssueCodes.UNKNOWN_COLUMN,
            severity: 'WARNING',
            category: 'WORKBOOK_STRUCTURE',
            title: 'Columna desconocida',
            message: `La columna ${column.column} de "${sheet.name}" no esta documentada en el esquema.`,
            explanation: 'Puede tratarse de una extension del exportador o documentacion desactualizada.',
            recommendation: 'Confirmar si la columna debe agregarse al esquema documentado.',
            location: { sheet: sheet.name, row: sheet.headerRow, column: column.column, cell: `${column.column}${sheet.headerRow}` },
            entityType: 'WORKBOOK',
            blocksImport: false,
          }),
        );
      });
    });

    [
      ...context.concepts,
      ...context.variables,
      ...context.auxiliaries,
      ...context.conventions,
    ].forEach((record) => {
      issues.push(...this.validateBaseRecord(record));
    });

    context.accumulators.forEach((record) => {
      issues.push(...this.validateBaseRecord(record, false));
      if (record.conceptId === undefined && !isBlank(record.originalValues.conceptId)) {
        issues.push(
          createIssue({
            code: IssueCodes.INVALID_IDENTIFIER,
            severity: 'ERROR',
            category: 'WORKBOOK_STRUCTURE',
            title: 'Concepto integrante invalido',
            message: `La fila ${record.row} no tiene un codigo de concepto numerico.`,
            explanation: 'Los acumuladores deben apuntar a un concepto por identificador numerico.',
            recommendation: 'Corregir el codigo del concepto integrante.',
            location: record.sourceColumns.conceptId,
            entityType: 'ACCUMULATOR',
            entityId: record.id,
            entityName: record.name,
            blocksImport: true,
          }),
        );
      }
    });

    return issues;
  }

  private validateBaseRecord(record: BaseRecord, requireName = true): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (record.id === undefined) {
      const raw = record.originalValues.id;
      issues.push(
        createIssue({
          code: isBlank(raw) ? IssueCodes.INVALID_ROW : IssueCodes.INVALID_IDENTIFIER,
          severity: 'ERROR',
          category: 'WORKBOOK_STRUCTURE',
          title: isBlank(raw) ? 'Identificador ausente' : 'Identificador no numerico',
          message: `La fila ${record.row} de "${record.sheet}" no tiene un identificador valido.`,
          explanation: 'Cada registro de negocio debe conservar un identificador numerico.',
          recommendation: 'Completar el identificador con un numero entero.',
          location: record.sourceColumns.id,
          entityType: record.entityType,
          entityName: record.name,
          blocksImport: true,
        }),
      );
    }

    if (requireName && isBlank(record.name)) {
      issues.push(
        createIssue({
          code: IssueCodes.MISSING_NAME,
          severity: 'ERROR',
          category: 'WORKBOOK_STRUCTURE',
          title: 'Nombre obligatorio ausente',
          message: `La fila ${record.row} de "${record.sheet}" no tiene nombre o detalle.`,
          explanation: 'El nombre se usa para explicar el problema al usuario.',
          recommendation: 'Completar la descripcion del registro.',
          location: record.sourceColumns.name,
          entityType: record.entityType,
          entityId: record.id,
          blocksImport: false,
        }),
      );
    }

    if (!isBlank(record.originalValues.id) && toNumberId(record.originalValues.id) === undefined) {
      issues.push(
        createIssue({
          code: IssueCodes.INVALID_IDENTIFIER,
          severity: 'ERROR',
          category: 'WORKBOOK_STRUCTURE',
          title: 'Identificador no numerico',
          message: `El identificador de la fila ${record.row} no es numerico.`,
          explanation: 'Las referencias del lenguaje usan identificadores numericos entre corchetes.',
          recommendation: 'Usar un numero entero para el identificador.',
          location: record.sourceColumns.id,
          entityType: record.entityType,
          entityId: record.originalValues.id as string,
          entityName: record.name,
          blocksImport: true,
        }),
      );
    }

    return issues;
  }
}

