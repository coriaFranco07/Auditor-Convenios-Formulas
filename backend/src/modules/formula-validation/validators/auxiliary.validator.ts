import { documentedCatalogs } from '../../../config/schema';
import { createIssue } from '../domain/issue-factory';
import { isBlank } from '../domain/normalization';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { AuxiliaryRecord, WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class AuxiliaryValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    context.auxiliaries.forEach((auxiliary) => {
      issues.push(...this.validateAuxiliary(auxiliary));
    });

    return issues;
  }

  private validateAuxiliary(auxiliary: AuxiliaryRecord): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (isBlank(auxiliary.class)) {
      issues.push(this.issue(auxiliary, 'Clase ausente', 'El auxiliar no declara clase.', 'Completar la clase del auxiliar.'));
    } else if (!documentedCatalogs.auxiliaryClass.includes(String(auxiliary.class))) {
      issues.push(
        createIssue({
          code: IssueCodes.INVALID_AUXILIARY_ROW,
          severity: 'ERROR',
          category: 'AUXILIARIES',
          title: 'Clase de auxiliar desconocida',
          message: `La clase "${auxiliary.class}" no esta documentada.`,
          explanation: 'El sistema solo puede validar clases conocidas.',
          recommendation: 'Confirmar si la clase debe agregarse al catalogo o corregir el valor.',
          location: auxiliary.sourceColumns.class,
          entityType: 'AUXILIARY',
          entityId: auxiliary.id,
          entityName: auxiliary.name,
          blocksImport: false,
        }),
      );
    }

    if (auxiliary.class === 'F' && isBlank(auxiliary.trueFormula) && isBlank(auxiliary.value)) {
      issues.push(
        this.issue(
          auxiliary,
          'Formula ausente',
          'El auxiliar de clase F no tiene algoritmo verdadero ni valor.',
          'Completar la formula o revisar la clase asignada.',
        ),
      );
    }

    if (!isBlank(auxiliary.falseFormula) && isBlank(auxiliary.condition)) {
      issues.push(
        this.issue(
          auxiliary,
          'Algoritmo falso sin condicion',
          'Existe algoritmo falso pero no condicion que decida cuando usarlo.',
          'Agregar la condicion correspondiente o quitar el algoritmo falso.',
        ),
      );
    }

    if (!isBlank(auxiliary.condition) && isBlank(auxiliary.trueFormula)) {
      issues.push(
        this.issue(
          auxiliary,
          'Condicion sin algoritmo verdadero',
          'Existe condicion pero no algoritmo verdadero.',
          'Agregar el algoritmo verdadero o revisar si la condicion esta en la columna correcta.',
        ),
      );
    }

    return issues;
  }

  private issue(auxiliary: AuxiliaryRecord, title: string, message: string, recommendation: string): ValidationIssue {
    return createIssue({
      code: IssueCodes.INVALID_AUXILIARY_ROW,
      severity: 'ERROR',
      category: 'AUXILIARIES',
      title,
      message,
      explanation: 'La fila del auxiliar no cumple las reglas minimas de consistencia.',
      recommendation,
      location: auxiliary.sourceColumns.id,
      entityType: 'AUXILIARY',
      entityId: auxiliary.id,
      entityName: auxiliary.name,
      blocksImport: false,
    });
  }
}
