import { createIssue } from '../domain/issue-factory';
import { isBlank } from '../domain/normalization';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import { CellLocation, ConceptRecord, WorkbookContext } from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

type ConceptFormulaGroup = {
  condition?: unknown;
  trueFormula?: unknown;
  falseFormula?: unknown;
  unit?: unknown;
  conditionLocation?: CellLocation;
  trueFormulaLocation?: CellLocation;
  falseFormulaLocation?: CellLocation;
  label: string;
};

export class FormulaSemanticValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    return [
      ...this.validateExpressionTypeErrors(context),
      ...this.validateConceptConditionalPairs(context),
      ...this.validateConceptScope(context),
    ];
  }

  private validateExpressionTypeErrors(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    context.formulaCells.forEach((formulaCell) => {
      if (formulaCell.parseResult.syntaxErrors.length > 0) {
        return;
      }
      formulaCell.parseResult.typeErrors.forEach((error) => {
        issues.push(
          createIssue({
            code: IssueCodes.FORMULA_TYPE_MISMATCH,
            severity: 'ERROR',
            category: 'FORMULA_SEMANTICS',
            title: 'Formula con tipos incompatibles',
            message: error.message,
            explanation:
              'La formula se puede leer, pero mezcla valores numericos y condiciones logicas de una manera que puede calcular mal.',
            recommendation:
              'Revisar los argumentos de funciones como SI, Y, O y NO, y confirmar que cada comparacion devuelva verdadero/falso.',
            location: formulaCell,
            entityType: formulaCell.entityType,
            entityId: formulaCell.entityId,
            entityName: formulaCell.entityName,
            formula: formulaCell.formula,
            invalidFragment: this.fragmentAt(formulaCell.formula, error.position),
            blocksImport: false,
          }),
        );
      });
    });
    return issues;
  }

  private validateConceptConditionalPairs(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    context.concepts.forEach((concept) => {
      [this.monthlyGroup(concept), this.dailyGroup(concept)].forEach((group) => {
        if (!isBlank(group.falseFormula) && isBlank(group.condition)) {
          issues.push(
            this.conceptIssue({
              concept,
              code: IssueCodes.INCOMPLETE_CONDITIONAL_FORMULA,
              title: `${group.label}: formula falsa sin condicion`,
              message: `El concepto ${concept.id} tiene formula alternativa, pero no tiene condicion ${group.label.toLowerCase()}.`,
              explanation:
                'La formula falsa solo tiene sentido cuando existe una condicion que indique cuando aplicar la verdadera o la alternativa.',
              recommendation:
                'Agregar la condicion correspondiente o quitar la formula alternativa si no debe usarse.',
              location: group.falseFormulaLocation,
              severity: 'ERROR',
            }),
          );
        }

        if (!isBlank(group.condition) && isBlank(group.trueFormula)) {
          issues.push(
            this.conceptIssue({
              concept,
              code: IssueCodes.INCOMPLETE_CONDITIONAL_FORMULA,
              title: `${group.label}: condicion sin formula verdadera`,
              message: `El concepto ${concept.id} tiene condicion ${group.label.toLowerCase()}, pero no tiene formula verdadera.`,
              explanation:
                'Si hay una condicion, el sistema necesita saber que calcular cuando esa condicion se cumple.',
              recommendation:
                'Completar la formula verdadera o mover la condicion a la columna correcta.',
              location: group.conditionLocation,
              severity: 'ERROR',
            }),
          );
        }
      });
    });
    return issues;
  }

  private validateConceptScope(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    context.concepts.forEach((concept) => {
      const scope = this.normalizeScope(concept.scope);
      if (scope === 'mensual' && this.hasAnyDailyFormula(concept)) {
        issues.push(
          this.conceptIssue({
            concept,
            code: IssueCodes.FORMULA_SCOPE_MISMATCH,
            title: 'Formula jornal en concepto mensual',
            message: `El concepto ${concept.id} tiene alcance mensual, pero carga formulas o unidad jornal.`,
            explanation:
              'El alcance define que bloque de formulas deberia usarse. Mezclar bloques puede hacer que el concepto se liquide en un caso no esperado.',
            recommendation:
              'Confirmar si el alcance debe ser General/Jornal o limpiar las columnas jornales que no correspondan.',
            location: concept.sourceColumns.scope,
            severity: 'WARNING',
          }),
        );
      }

      if (scope === 'jornal' && this.hasAnyMonthlyFormula(concept)) {
        issues.push(
          this.conceptIssue({
            concept,
            code: IssueCodes.FORMULA_SCOPE_MISMATCH,
            title: 'Formula mensual en concepto jornal',
            message: `El concepto ${concept.id} tiene alcance jornal, pero carga formulas o unidad mensual.`,
            explanation:
              'El alcance define que bloque de formulas deberia usarse. Mezclar bloques puede hacer que el concepto se liquide en un caso no esperado.',
            recommendation:
              'Confirmar si el alcance debe ser General/Mensual o limpiar las columnas mensuales que no correspondan.',
            location: concept.sourceColumns.scope,
            severity: 'WARNING',
          }),
        );
      }
    });
    return issues;
  }

  private monthlyGroup(concept: ConceptRecord): ConceptFormulaGroup {
    return {
      condition: concept.monthlyCondition,
      trueFormula: concept.monthlyFormulaTrue,
      falseFormula: concept.monthlyFormulaFalse,
      unit: concept.monthlyUnit,
      conditionLocation: concept.sourceColumns.monthlyCondition,
      trueFormulaLocation: concept.sourceColumns.monthlyFormulaTrue,
      falseFormulaLocation: concept.sourceColumns.monthlyFormulaFalse,
      label: 'Mensual',
    };
  }

  private dailyGroup(concept: ConceptRecord): ConceptFormulaGroup {
    return {
      condition: concept.dailyCondition,
      trueFormula: concept.dailyFormulaTrue,
      falseFormula: concept.dailyFormulaFalse,
      unit: concept.dailyUnit,
      conditionLocation: concept.sourceColumns.dailyCondition,
      trueFormulaLocation: concept.sourceColumns.dailyFormulaTrue,
      falseFormulaLocation: concept.sourceColumns.dailyFormulaFalse,
      label: 'Jornal',
    };
  }

  private hasAnyMonthlyFormula(concept: ConceptRecord): boolean {
    const group = this.monthlyGroup(concept);
    return [group.condition, group.trueFormula, group.falseFormula, group.unit].some((value) => !isBlank(value));
  }

  private hasAnyDailyFormula(concept: ConceptRecord): boolean {
    const group = this.dailyGroup(concept);
    return [group.condition, group.trueFormula, group.falseFormula, group.unit].some((value) => !isBlank(value));
  }

  private normalizeScope(scope: unknown): string {
    return String(scope ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private fragmentAt(formula: string, position: number): string | undefined {
    if (position < 0 || position >= formula.length) {
      return undefined;
    }
    return formula.slice(position, Math.min(formula.length, position + 16)).trim() || undefined;
  }

  private conceptIssue(input: {
    concept: ConceptRecord;
    code: string;
    title: string;
    message: string;
    explanation: string;
    recommendation: string;
    location?: CellLocation;
    severity: 'ERROR' | 'WARNING';
  }): ValidationIssue {
    return createIssue({
      code: input.code,
      severity: input.severity,
      category: 'FORMULA_SEMANTICS',
      title: input.title,
      message: input.message,
      explanation: input.explanation,
      recommendation: input.recommendation,
      location: input.location,
      entityType: 'CONCEPT',
      entityId: input.concept.id,
      entityName: input.concept.name,
      blocksImport: false,
    });
  }
}
