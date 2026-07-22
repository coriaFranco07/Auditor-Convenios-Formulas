import { createIssue } from '../domain/issue-factory';
import { groupById } from '../domain/symbol-table';
import { recordSignature } from '../domain/normalization';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { BaseRecord, WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class DuplicateValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    issues.push(...this.validateEntityDuplicates('CONCEPT', context.concepts));
    issues.push(...this.validateEntityDuplicates('AUXILIARY', context.auxiliaries));
    issues.push(...this.validateAccumulatorDuplicates(context));
    return issues;
  }

  private validateEntityDuplicates(entityLabel: string, records: BaseRecord[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const groups = groupById(records);
    groups.forEach((definitions, id) => {
      if (definitions.length < 2) {
        return;
      }
      const signatures = new Set(definitions.map(recordSignature));
      const conflict = signatures.size > 1;
      const first = definitions[0];
      const relatedLocations = definitions.map((record) => record.sourceColumns.id).filter(Boolean);
      issues.push(
        createIssue({
          code: conflict ? IssueCodes.DUPLICATE_CONFLICT : IssueCodes.DUPLICATE_IDENTICAL,
          severity: conflict ? 'CRITICAL' : 'INFO',
          category: 'DUPLICATES',
          title: conflict ? 'Duplicado conflictivo' : 'Duplicado identico',
          message: `${entityLabel} ${id} aparece ${definitions.length} veces.`,
          explanation: conflict
            ? 'Las definiciones no son equivalentes y no se puede determinar una definicion unica.'
            : 'Las filas repetidas contienen la misma definicion normalizada.',
          recommendation: conflict
            ? 'Unificar la definicion o eliminar las filas contradictorias.'
            : 'Eliminar duplicados identicos para reducir ambiguedad.',
          location: first.sourceColumns.id,
          entityType: first.entityType,
          entityId: id,
          entityName: first.name,
          relatedLocations,
          blocksImport: conflict,
        }),
      );
    });
    return issues;
  }

  private validateAccumulatorDuplicates(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const groups = new Map<string, typeof context.accumulators>();
    context.accumulators.forEach((record) => {
      const key = `${record.id ?? 'sin-id'}|${record.conceptId ?? 'sin-concepto'}|${record.operation ?? ''}`;
      const current = groups.get(key) ?? [];
      current.push(record);
      groups.set(key, current);
    });
    groups.forEach((records) => {
      if (records.length < 2) {
        return;
      }
      const first = records[0];
      const relatedLocations = records.map((record) => record.sourceColumns.id).filter(Boolean);
      issues.push(
        createIssue({
          code: IssueCodes.DUPLICATE_IDENTICAL,
          severity: 'WARNING',
          category: 'ACCUMULATORS',
          title: 'Registro de acumulador duplicado',
          message: `El acumulador ${first.id} repite el concepto ${first.conceptId} con operacion ${first.operation}.`,
          explanation: 'La misma combinacion de acumulador, concepto y operacion aparece mas de una vez.',
          recommendation: 'Confirmar si la repeticion es intencional; si no, eliminar la fila duplicada.',
          location: first.sourceColumns.id,
          entityType: 'ACCUMULATOR',
          entityId: first.id,
          entityName: first.name,
          relatedLocations,
          blocksImport: false,
        }),
      );
    });
    return issues;
  }
}
