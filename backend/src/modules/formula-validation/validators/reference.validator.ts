import { createIssue } from '../domain/issue-factory';
import { buildSymbolTables } from '../domain/symbol-table';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { FormulaCell, WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class ReferenceValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const tables = buildSymbolTables(context);
    const issues: ValidationIssue[] = [];

    context.formulaCells.forEach((formulaCell) => {
      formulaCell.parseResult.references.forEach((reference) => {
        if (reference.id === undefined) {
          return;
        }
        const exists = this.referenceExists(reference.type, reference.id, tables);
        if (exists) {
          return;
        }
        issues.push(this.createMissingReferenceIssue(formulaCell, reference.type, reference.id));
      });
    });

    return issues;
  }

  private referenceExists(
    type: string,
    id: number,
    tables: ReturnType<typeof buildSymbolTables>,
  ): boolean {
    if (type === 'L') {
      return tables.variables.has(id);
    }
    if (type === 'A') {
      return tables.auxiliaries.has(id);
    }
    if (type === 'R' || type === 'U' || type === 'N' || type === 'I') {
      return tables.concepts.has(id);
    }
    return false;
  }

  private createMissingReferenceIssue(
    formulaCell: FormulaCell,
    referenceType: 'N' | 'I' | 'A' | 'R' | 'U' | 'L',
    referenceId: number,
  ): ValidationIssue {
    const codeByType = {
      L: IssueCodes.MISSING_LEG_VARIABLE_REFERENCE,
      A: IssueCodes.MISSING_AUXILIARY_REFERENCE,
      R: IssueCodes.MISSING_CONCEPT_REFERENCE,
      U: IssueCodes.MISSING_CONCEPT_REFERENCE,
      N: IssueCodes.MISSING_CONCEPT_REFERENCE,
      I: IssueCodes.MISSING_CONCEPT_REFERENCE,
    };
    const labelByType = {
      L: 'variable de legajo',
      A: 'calculo auxiliar',
      R: 'concepto',
      U: 'concepto',
      N: 'novedad/concepto',
      I: 'novedad/concepto',
    };

    return createIssue({
      code: codeByType[referenceType],
      severity: 'CRITICAL',
      category: 'REFERENCES',
      title: 'Referencia inexistente',
      message: `La formula referencia ${referenceType}[${referenceId}], pero no existe en la tabla de ${labelByType[referenceType]}.`,
      explanation: 'Una referencia inexistente impide resolver la dependencia de forma deterministica.',
      recommendation: 'Crear la definicion faltante o corregir el identificador usado en la formula.',
      location: formulaCell,
      entityType: formulaCell.entityType,
      entityId: formulaCell.entityId,
      entityName: formulaCell.entityName,
      formula: formulaCell.formula,
      invalidFragment: `${referenceType}[${referenceId}]`,
      referenceType,
      referenceId,
      blocksImport: true,
    });
  }
}

