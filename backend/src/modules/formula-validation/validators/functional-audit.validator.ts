import { createIssue } from '../domain/issue-factory';
import { uniqueReferences } from '../domain/formula-analysis';
import { isBlank } from '../domain/normalization';
import { FormulaReference } from '../types/formula.types';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import {
  AuxiliaryRecord,
  CellLocation,
  ConceptRecord,
  FormulaCell,
  WorkbookContext,
} from '../types/workbook.types';
import { ValidationRule } from './validation-rule';

type ConceptFormulaKey =
  | 'monthlyCondition'
  | 'monthlyFormulaTrue'
  | 'monthlyFormulaFalse'
  | 'monthlyUnit'
  | 'dailyCondition'
  | 'dailyFormulaTrue'
  | 'dailyFormulaFalse'
  | 'dailyUnit'
  | 'preFormula'
  | 'postFormula';

export class FunctionalAuditValidator implements ValidationRule {
  validate(context: WorkbookContext): ValidationIssue[] {
    return [
      ...this.validateFormulaRoleReferences(context),
      ...this.validateConceptPdfFields(context),
      ...this.validateAuxiliaryPdfRules(context),
    ];
  }

  private validateFormulaRoleReferences(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    context.formulaCells.forEach((formulaCell) => {
      if (formulaCell.parseResult.syntaxErrors.length > 0) {
        return;
      }
      const references = uniqueReferences(formulaCell.parseResult.references);

      if (formulaCell.role === 'UNIT') {
        const amountReferences = references.filter((reference) => reference.type === 'R' || reference.type === 'I');
        if (amountReferences.length > 0) {
          issues.push(
            this.formulaIssue({
              formulaCell,
              code: IssueCodes.UNIT_USES_AMOUNT_REFERENCE,
              title: 'Unidad calculada con importes',
              message: `La unidad usa ${this.referenceList(amountReferences)}, que representan importes y no unidades.`,
              explanation:
                'Segun el PDF, la unidad mensual o jornal deberia representar cantidades: novedades en unidades, unidades del concepto o calculos auxiliares de cantidad.',
              recommendation:
                'Confirmar si la columna correcta era Formula de importe. Si realmente es una unidad, revisar si corresponde usar N[], U[] o un auxiliar A[] de cantidad.',
              severity: 'WARNING',
              reference: amountReferences[0],
            }),
          );
        }
      }

    });

    return issues;
  }

  private validateConceptPdfFields(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    context.concepts.forEach((concept) => {
      if (!isBlank(concept.totalizes) && !this.isNumericValue(concept.totalizes)) {
        issues.push(
          createIssue({
            code: IssueCodes.TOTALIZES_VALUE_INVALID,
            severity: 'WARNING',
            category: 'FUNCTIONAL_AUDIT',
            title: 'Totaliza no numerico',
            message: `El campo Totaliza del concepto ${concept.id ?? 'sin numero'} deberia ser numerico, pero contiene "${concept.totalizes}".`,
            explanation:
              'El PDF define Totaliza como un campo numerico que indica como impacta el concepto en la totalizacion de haberes.',
            recommendation:
              'Revisar el valor de Totaliza y cargar el codigo numerico esperado por e-Sueldos.',
            location: concept.sourceColumns.totalizes,
            entityType: 'CONCEPT',
            entityId: concept.id,
            entityName: concept.name,
            blocksImport: false,
          }),
        );
      }

      if (this.hasPreOrPostFormula(concept) && !this.hasMainFormula(concept)) {
        issues.push(
          createIssue({
            code: IssueCodes.PRE_POST_WITHOUT_MAIN_FORMULA,
            severity: 'WARNING',
            category: 'FUNCTIONAL_AUDIT',
            title: 'Pre/Post formula sin calculo principal',
            message: `El concepto ${concept.id ?? 'sin numero'} tiene Pre-Formula o Post-Formula, pero no tiene formula mensual/jornal principal.`,
            explanation:
              'Segun el PDF, la Pre-Formula se ejecuta antes del calculo principal y la Post-Formula despues. Si no hay calculo principal, conviene confirmar el sentido funcional.',
            recommendation:
              'Confirmar si la rutina especial debe quedar en Pre/Post Formula o si falta completar la formula principal del concepto.',
            location: concept.sourceColumns.preFormula ?? concept.sourceColumns.postFormula,
            entityType: 'CONCEPT',
            entityId: concept.id,
            entityName: concept.name,
            formula: this.firstFormulaValue(concept, ['preFormula', 'postFormula']),
            blocksImport: false,
          }),
        );
      }
    });

    return issues;
  }

  private validateAuxiliaryPdfRules(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    context.auxiliaries.forEach((auxiliary) => {
      const auxiliaryClass = this.normalizedClass(auxiliary);
      if (!auxiliaryClass) {
        return;
      }

      if (auxiliaryClass === 'V') {
        if (isBlank(auxiliary.value)) {
          issues.push(
            this.auxiliaryIssue(
              auxiliary,
              IssueCodes.AUXILIARY_VALUE_MISSING,
              'Auxiliar de valor fijo sin valor',
              `El auxiliar A[${auxiliary.id ?? '?'}] esta marcado como valor constante, pero no tiene valor cargado.`,
              'El PDF indica que un auxiliar de valor constante debe obtenerse desde el campo Valor.',
              'Completar el valor fijo o cambiar la clase si en realidad se calcula por formula o acumulador.',
              'ERROR',
              auxiliary.sourceColumns.value ?? auxiliary.sourceColumns.id,
            ),
          );
        }
        if (!isBlank(auxiliary.trueFormula) || !isBlank(auxiliary.falseFormula) || !isBlank(auxiliary.condition)) {
          issues.push(
            this.auxiliaryIssue(
              auxiliary,
              IssueCodes.AUXILIARY_VALUE_HAS_FORMULA,
              'Auxiliar de valor fijo con formula',
              `El auxiliar A[${auxiliary.id ?? '?'}] esta marcado como valor constante, pero tambien tiene formula o condicion.`,
              'La clase V deberia representar un valor fijo. Mezclarla con formulas dificulta entender cual dato manda.',
              'Confirmar si debe ser clase F o limpiar las columnas de formula/condicion.',
              'WARNING',
            ),
          );
        }
      }

      if (auxiliaryClass === 'A') {
        if (
          !isBlank(auxiliary.trueFormula) ||
          !isBlank(auxiliary.falseFormula) ||
          !isBlank(auxiliary.condition) ||
          this.hasMeaningfulAccumulatorValue(auxiliary.value)
        ) {
          issues.push(
            this.auxiliaryIssue(
              auxiliary,
              IssueCodes.AUXILIARY_ACCUMULATOR_HAS_FORMULA,
              'Auxiliar acumulador con formula o valor',
              `El auxiliar A[${auxiliary.id ?? '?'}] esta marcado como acumulador, pero tiene datos de formula, condicion o valor.`,
              'El PDF separa los auxiliares de clase A de los auxiliares calculados por formula. Mezclar clase A con formula vuelve ambigua la lectura funcional.',
              'Confirmar si debe ser clase F/V o quitar los datos que no corresponden al acumulador.',
              'WARNING',
            ),
          );
        }
      }
    });

    return issues;
  }

  private formulaIssue(input: {
    formulaCell: FormulaCell;
    code: string;
    title: string;
    message: string;
    explanation: string;
    recommendation: string;
    severity: 'ERROR' | 'WARNING';
    reference?: FormulaReference;
  }): ValidationIssue {
    return createIssue({
      code: input.code,
      severity: input.severity,
      category: 'FUNCTIONAL_AUDIT',
      title: input.title,
      message: input.message,
      explanation: input.explanation,
      recommendation: input.recommendation,
      location: input.formulaCell,
      entityType: input.formulaCell.entityType,
      entityId: input.formulaCell.entityId,
      entityName: input.formulaCell.entityName,
      formula: input.formulaCell.formula,
      invalidFragment: input.reference ? `${input.reference.type}[${input.reference.id}]` : undefined,
      referenceType: input.reference?.type,
      referenceId: input.reference?.id,
      blocksImport: false,
    });
  }

  private auxiliaryIssue(
    auxiliary: AuxiliaryRecord,
    code: string,
    title: string,
    message: string,
    explanation: string,
    recommendation: string,
    severity: 'ERROR' | 'WARNING',
    location: CellLocation | undefined = auxiliary.sourceColumns.id,
  ): ValidationIssue {
    return createIssue({
      code,
      severity,
      category: 'FUNCTIONAL_AUDIT',
      title,
      message,
      explanation,
      recommendation,
      location,
      entityType: 'AUXILIARY',
      entityId: auxiliary.id,
      entityName: auxiliary.name,
      blocksImport: severity === 'ERROR',
    });
  }

  private referenceList(references: FormulaReference[]): string {
    return references.map((reference) => `${reference.type}[${reference.id ?? reference.rawId}]`).join(', ');
  }

  private isNumericValue(value: unknown): boolean {
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    return typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim());
  }

  private hasPreOrPostFormula(concept: ConceptRecord): boolean {
    return !isBlank(concept.preFormula) || !isBlank(concept.postFormula);
  }

  private hasMainFormula(concept: ConceptRecord): boolean {
    return [
      concept.monthlyFormulaTrue,
      concept.monthlyFormulaFalse,
      concept.dailyFormulaTrue,
      concept.dailyFormulaFalse,
    ].some((value) => !isBlank(value));
  }

  private firstFormulaValue(concept: ConceptRecord, keys: ConceptFormulaKey[]): string | undefined {
    for (const key of keys) {
      const value = concept[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
    return undefined;
  }

  private normalizedClass(auxiliary: AuxiliaryRecord): string {
    return String(auxiliary.class ?? '').trim().toUpperCase();
  }

  private hasMeaningfulAccumulatorValue(value: unknown): boolean {
    if (isBlank(value)) {
      return false;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    const normalized = String(value).trim().replace(',', '.');
    return normalized !== '0' && normalized !== '0.0' && normalized !== '0.00';
  }

}
