import { createIssue } from '../domain/issue-factory';
import { groupById } from '../domain/symbol-table';
import { recordSignature } from '../domain/normalization';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { BaseRecord, WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class DuplicateValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    // Concept sheet numbers are liquidation order values, so they can repeat.
    issues.push(...this.validateEntityDuplicates('AUXILIARY', context.auxiliaries));
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
      const entityName = this.duplicateEntityName(definitions);
      issues.push(
        createIssue({
          code: conflict ? IssueCodes.DUPLICATE_CONFLICT : IssueCodes.DUPLICATE_IDENTICAL,
          severity: conflict ? 'CRITICAL' : 'INFO',
          category: 'DUPLICATES',
          title: conflict ? `${this.entityTypeLabel(entityLabel)} duplicado con diferencias` : `${this.entityTypeLabel(entityLabel)} duplicado identico`,
          message: conflict
            ? `El numero de ${this.entityTypeLabel(entityLabel).toLowerCase()} ${id} aparece en ${definitions.length} filas con nombres o definiciones distintas: ${this.rowNamesLabel(definitions)}.`
            : `El numero de ${this.entityTypeLabel(entityLabel).toLowerCase()} ${id} aparece ${definitions.length} veces con la misma definicion. Filas: ${this.rowsLabel(definitions)}.`,
          explanation: conflict
            ? 'El mismo identificador esta usado para mas de una definicion. Al importar, el sistema no puede saber cual corresponde usar.'
            : 'Las filas repetidas contienen la misma definicion normalizada.',
          recommendation: conflict
            ? 'Elegir una unica definicion para ese numero o cambiar el identificador de la fila que corresponda.'
            : 'Eliminar duplicados identicos para reducir ambiguedad.',
          location: first.sourceColumns.id,
          entityType: first.entityType,
          entityId: id,
          entityName,
          relatedLocations,
          blocksImport: conflict,
        }),
      );
    });
    return issues;
  }

  private entityTypeLabel(entityLabel: string): string {
    const labels: Record<string, string> = {
      CONCEPT: 'Concepto',
      AUXILIARY: 'Auxiliar',
    };
    return labels[entityLabel] ?? entityLabel;
  }

  private rowNamesLabel(records: BaseRecord[]): string {
    return records.map((record) => `fila ${record.row}${record.name ? ` "${record.name}"` : ''}`).join('; ');
  }

  private rowsLabel(records: BaseRecord[]): string {
    return records.map((record) => String(record.row)).join(', ');
  }

  private duplicateEntityName(records: BaseRecord[]): string | undefined {
    const names = [...new Set(records.map((record) => record.name?.trim()).filter(Boolean))] as string[];
    if (names.length === 0) {
      return undefined;
    }
    if (names.length <= 3) {
      return names.join(' / ');
    }
    return `${names.slice(0, 3).join(' / ')} / ...`;
  }
}
