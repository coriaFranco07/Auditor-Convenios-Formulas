import { containsExplicitDivisionByZero } from '../parsers/formula-parser';
import { createIssue } from '../domain/issue-factory';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class FormulaSyntaxValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    context.formulaCells.forEach((formulaCell) => {
      formulaCell.parseResult.syntaxErrors.forEach((error) => {
        issues.push(
          createIssue({
            code: IssueCodes.INVALID_FORMULA_SYNTAX,
            severity: 'ERROR',
            category: 'FORMULA_SYNTAX',
            title: 'Sintaxis de formula invalida',
            message: error.message,
            explanation: 'La expresion no puede transformarse en un AST confiable.',
            recommendation: 'Revisar parentesis, corchetes, operadores y funciones de la formula.',
            location: formulaCell,
            entityType: formulaCell.entityType,
            entityId: formulaCell.entityId,
            entityName: formulaCell.entityName,
            formula: formulaCell.formula,
            invalidFragment: error.fragment,
            blocksImport: false,
          }),
        );
      });

      if (containsExplicitDivisionByZero(formulaCell.parseResult.ast)) {
        issues.push(
          createIssue({
            code: IssueCodes.INVALID_FORMULA_SYNTAX,
            severity: 'ERROR',
            category: 'FORMULA_SYNTAX',
            title: 'Division explicita por cero',
            message: 'La formula contiene una division cuyo divisor literal es cero.',
            explanation: 'Aunque el sistema no evalua formulas, una division literal por cero es inconsistente.',
            recommendation: 'Corregir el divisor o reemplazarlo por una condicion que evite cero.',
            location: formulaCell,
            entityType: formulaCell.entityType,
            entityId: formulaCell.entityId,
            entityName: formulaCell.entityName,
            formula: formulaCell.formula,
            invalidFragment: '/ 0',
            blocksImport: false,
          }),
        );
      }
    });
    return issues;
  }
}

