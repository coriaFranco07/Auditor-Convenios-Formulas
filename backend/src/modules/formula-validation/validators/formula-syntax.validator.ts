import { containsExplicitDivisionByZero } from '../parsers/formula-parser';
import { createIssue } from '../domain/issue-factory';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

export class FormulaSyntaxValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    context.formulaCells.forEach((formulaCell) => {
      if (formulaCell.parseResult.syntaxErrors.length > 0 && this.looksLikePlainText(formulaCell.formula)) {
        issues.push(
          createIssue({
            code: IssueCodes.FORMULA_TEXT_IN_CALCULATION_COLUMN,
            severity: 'WARNING',
            category: 'FUNCTIONAL_AUDIT',
            title: 'Texto en columna de calculo',
            message: `La columna ${formulaCell.column} espera una formula segun el PDF, pero contiene el texto "${formulaCell.formula}".`,
            explanation:
              'El PDF documenta formulas con referencias, operadores y funciones SI/Y/O/NO. Un texto libre puede ser una rutina especial del sistema o una descripcion cargada en la columna incorrecta.',
            recommendation:
              'Confirmar si el texto es una rutina valida. Si lo es, documentarla en el catalogo funcional; si no, reemplazarlo por la formula tecnica o moverlo a una columna descriptiva.',
            location: formulaCell,
            entityType: formulaCell.entityType,
            entityId: formulaCell.entityId,
            entityName: formulaCell.entityName,
            formula: formulaCell.formula,
            invalidFragment: formulaCell.formula,
            blocksImport: false,
          }),
        );
        return;
      }

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

  private looksLikePlainText(formula: string): boolean {
    const normalized = formula.trim();
    if (!/[A-Za-z]/.test(normalized)) {
      return false;
    }
    if (/\b[NIARUL]\s*\[/i.test(normalized)) {
      return false;
    }
    if (/[+\-*/<>=();\[\]]/.test(normalized)) {
      return false;
    }
    return true;
  }
}
