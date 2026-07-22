import { createIssue } from '../domain/issue-factory';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { FormulaCell, WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class TypeValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    context.formulaCells.forEach((formulaCell) => {
      if (formulaCell.parseResult.syntaxErrors.length > 0) {
        return;
      }
      if (formulaCell.role === 'CONDITION' && formulaCell.parseResult.inferredType !== 'BOOLEAN') {
        issues.push(this.createTypeIssue(formulaCell, 'BOOLEAN', IssueCodes.INVALID_CONDITION_TYPE));
      }
      if (
        (formulaCell.role === 'FORMULA' || formulaCell.role === 'UNIT') &&
        formulaCell.parseResult.inferredType === 'BOOLEAN'
      ) {
        issues.push(this.createTypeIssue(formulaCell, 'NUMBER', IssueCodes.INVALID_FORMULA_TYPE));
      }
    });
    return issues;
  }

  private createTypeIssue(
    formulaCell: FormulaCell,
    expected: 'NUMBER' | 'BOOLEAN',
    code: string,
  ): ValidationIssue {
    return createIssue({
      code,
      severity: 'ERROR',
      category: 'FORMULA_TYPE',
      title: expected === 'BOOLEAN' ? 'Condicion no booleana' : 'Formula no numerica',
      message: `La expresion devuelve ${formulaCell.parseResult.inferredType}, pero la columna espera ${expected}.`,
      explanation:
        expected === 'BOOLEAN'
          ? 'Las columnas de condicion deben producir verdadero o falso.'
          : 'Las columnas de formula o unidad deben producir un valor numerico.',
      recommendation:
        expected === 'BOOLEAN'
          ? 'Revisar si la expresion fue colocada en la columna incorrecta o agregar una comparacion.'
          : 'Revisar la formula para que devuelva un importe o unidad numerica.',
      location: formulaCell,
      entityType: formulaCell.entityType,
      entityId: formulaCell.entityId,
      entityName: formulaCell.entityName,
      formula: formulaCell.formula,
      blocksImport: false,
    });
  }
}

