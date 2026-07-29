import { documentedCatalogs } from '../../../config/schema';
import { createIssue } from '../domain/issue-factory';
import { isBlank } from '../domain/normalization';
import { buildSymbolTables } from '../domain/symbol-table';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { AccumulatorRecord, WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class AccumulatorValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const tables = buildSymbolTables(context);

    context.accumulators.forEach((accumulator) => {
      if (accumulator.id === undefined) {
        issues.push(
          createIssue({
            code: IssueCodes.MISSING_ACCUMULATOR_ID,
            severity: 'ERROR',
            category: 'ACCUMULATORS',
            title: 'Codigo de acumulador ausente',
            message: `La fila ${accumulator.row} no tiene codigo de acumulador.`,
            explanation: 'La hoja de acumuladores necesita agrupar componentes por codigo.',
            recommendation: 'Completar el codigo de acumulador.',
            location: accumulator.sourceColumns.id,
            entityType: 'ACCUMULATOR',
            blocksImport: true,
          }),
        );
      }

      if (accumulator.conceptId === undefined) {
        issues.push(this.invalid(accumulator, 'Concepto integrante ausente', 'Completar el codigo de concepto integrante.'));
      } else if (!tables.concepts.has(accumulator.conceptId)) {
        issues.push(
          createIssue({
            code: IssueCodes.MISSING_CONCEPT_REFERENCE,
            severity: 'CRITICAL',
            category: 'ACCUMULATORS',
            title: 'Concepto de acumulador inexistente',
            message: `El acumulador ${accumulator.id} usa el concepto ${accumulator.conceptId}, que no existe.`,
            explanation: 'El componente no puede resolverse contra la tabla de conceptos.',
            recommendation: 'Corregir el concepto integrante o agregar su definicion.',
            location: accumulator.sourceColumns.conceptId,
            entityType: 'ACCUMULATOR',
            entityId: accumulator.id,
            entityName: accumulator.name,
            referenceType: 'R',
            referenceId: accumulator.conceptId,
            blocksImport: true,
          }),
        );
      }

      if (
        !isBlank(accumulator.operation) &&
        !documentedCatalogs.accumulatorOperation.includes(String(accumulator.operation))
      ) {
        issues.push(this.invalid(accumulator, 'Operacion desconocida', 'Usar una operacion documentada: Suma o Resta.'));
      }
    });

    return issues;
  }

  private invalid(record: AccumulatorRecord, title: string, recommendation: string): ValidationIssue {
    return createIssue({
      code: IssueCodes.INVALID_ACCUMULATOR_ROW,
      severity: 'ERROR',
      category: 'ACCUMULATORS',
      title,
      message: `La fila ${record.row} del acumulador ${record.id ?? 'sin codigo'} es incompleta.`,
      explanation: 'Los acumuladores deben indicar codigo, concepto integrante y operacion.',
      recommendation,
      location: record.sourceColumns.id,
      entityType: 'ACCUMULATOR',
      entityId: record.id,
      entityName: record.name,
      blocksImport: false,
    });
  }
}
