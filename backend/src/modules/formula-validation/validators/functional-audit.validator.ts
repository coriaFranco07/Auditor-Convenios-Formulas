import { normalizeText } from '../../../config/schema';
import { createIssue } from '../domain/issue-factory';
import { collectEffectiveReferences, uniqueReferences } from '../domain/formula-analysis';
import { isBlank } from '../domain/normalization';
import { FormulaReference } from '../types/formula.types';
import { IssueCodes, ValidationIssue } from '../types/validation.types';
import {
  AccumulatorRecord,
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
      ...this.validateFormulaFlow(context),
      ...this.validateConceptPdfFields(context),
      ...this.validateAuxiliaryPdfRules(context),
      ...this.validateAccumulatorPdfRules(context),
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

      if (formulaCell.role === 'CONDITION') {
        const resultReferences = references.filter((reference) => reference.type === 'R' || reference.type === 'U' || reference.type === 'I');
        if (resultReferences.length > 0) {
          issues.push(
            this.formulaIssue({
              formulaCell,
              code: IssueCodes.CONDITION_USES_RESULT_REFERENCE,
              title: 'Condicion depende de resultados calculados',
              message: `La condicion usa ${this.referenceList(resultReferences)}, que dependen de datos liquidados o novedades de importe.`,
              explanation:
                'El PDF describe las condiciones como reglas logicas previas al calculo. Si dependen de importes o unidades ya calculadas, pueden quedar atadas al orden de liquidacion.',
              recommendation:
                'Confirmar que esos resultados ya existan cuando se evalua la condicion. Si no, mover la logica a un auxiliar o usar variables/novedades base.',
              severity: 'WARNING',
              reference: resultReferences[0],
            }),
          );
        }
      }
    });

    return issues;
  }

  private validateFormulaFlow(context: WorkbookContext): ValidationIssue[] {
    const conceptsById = this.firstById(context.concepts);
    const issues: ValidationIssue[] = [];
    const emitted = new Set<string>();

    context.formulaCells
      .filter((formulaCell) => formulaCell.entityType === 'CONCEPT' && formulaCell.entityId !== undefined)
      .forEach((formulaCell) => {
        if (formulaCell.parseResult.syntaxErrors.length > 0) {
          return;
        }
        const owner = conceptsById.get(Number(formulaCell.entityId));
        if (!owner?.sequence) {
          return;
        }

        uniqueReferences(collectEffectiveReferences(formulaCell.parseResult.ast))
          .filter((reference) => reference.id !== undefined && (reference.type === 'R' || reference.type === 'U'))
          .forEach((reference) => {
            if (reference.id === owner.id) {
              return;
            }
            const dependency = conceptsById.get(reference.id!);
            if (!dependency?.sequence || dependency.sequence < owner.sequence!) {
              return;
            }

            const key = `${owner.id}|${formulaCell.cell}|${reference.type}[${reference.id}]`;
            if (emitted.has(key)) {
              return;
            }
            emitted.add(key);

            issues.push(
              createIssue({
                code: IssueCodes.CALCULATION_ORDER_REVIEW,
                severity: 'WARNING',
                category: 'FUNCTIONAL_AUDIT',
                title: 'Secuencia de calculo a revisar',
                message: `La formula usa ${reference.type}[${reference.id}] - ${dependency.name ?? 'sin nombre'}, que tiene secuencia ${dependency.sequence}; el concepto actual tiene secuencia ${owner.sequence}.`,
                explanation:
                  'El PDF indica que la secuencia define el orden de calculo. Si una formula usa un concepto que se calcula despues, el resultado puede depender de un dato que todavia no existe.',
                recommendation:
                  'Confirmar si el motor de liquidacion resuelve esa dependencia. Si no, adelantar el concepto usado, mover la base a un auxiliar independiente o ajustar la formula.',
                location: formulaCell,
                entityType: 'CONCEPT',
                entityId: owner.id,
                entityName: owner.name,
                formula: formulaCell.formula,
                invalidFragment: `${reference.type}[${reference.id}]`,
                referenceType: reference.type,
                referenceId: reference.id,
                relatedLocations: [
                  this.recordLocation(owner),
                  this.recordLocation(dependency),
                ],
                blocksImport: false,
              }),
            );
          });
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
    const accumulatorIds = new Set(
      context.accumulators.map((accumulator) => accumulator.id).filter((id): id is number => id !== undefined),
    );

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
        if (!isBlank(auxiliary.trueFormula) || !isBlank(auxiliary.falseFormula) || !isBlank(auxiliary.condition) || !isBlank(auxiliary.value)) {
          issues.push(
            this.auxiliaryIssue(
              auxiliary,
              IssueCodes.AUXILIARY_ACCUMULATOR_HAS_FORMULA,
              'Auxiliar acumulador con formula o valor',
              `El auxiliar A[${auxiliary.id ?? '?'}] esta marcado como acumulador, pero tiene datos de formula, condicion o valor.`,
              'El PDF separa auxiliares acumuladores de auxiliares por formula. Un acumulador deberia explicarse desde sus componentes en Acumuladores.',
              'Confirmar si debe ser clase F/V o quitar los datos que no corresponden al acumulador.',
              'WARNING',
            ),
          );
        }
      }

      if (auxiliaryClass === 'F' && auxiliary.id !== undefined && accumulatorIds.has(auxiliary.id)) {
        issues.push(
          this.auxiliaryIssue(
            auxiliary,
            IssueCodes.AUXILIARY_FORMULA_HAS_ACCUMULATOR_COMPONENTS,
            'Auxiliar formula con componentes de acumulador',
            `El auxiliar A[${auxiliary.id}] esta marcado como formula, pero tambien tiene componentes en Acumuladores.`,
            'Para el PDF, clase F y clase A tienen origen distinto. Si el mismo codigo aparece como formula y como acumulador, la lectura funcional queda ambigua.',
            'Confirmar la clase correcta del auxiliar o separar los codigos.',
            'WARNING',
          ),
        );
      }
    });

    return issues;
  }

  private validateAccumulatorPdfRules(context: WorkbookContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const conceptsById = this.firstById(context.concepts);
    const accumulatorConceptOperations = new Map<string, AccumulatorRecord[]>();
    const nameMismatchEmitted = new Set<string>();

    context.accumulators.forEach((accumulator) => {
      if (accumulator.id !== undefined && accumulator.conceptId !== undefined) {
        const key = `${accumulator.id}|${accumulator.conceptId}`;
        const current = accumulatorConceptOperations.get(key) ?? [];
        current.push(accumulator);
        accumulatorConceptOperations.set(key, current);
      }

      if (accumulator.conceptId === undefined || isBlank(accumulator.conceptName)) {
        return;
      }

      const concept = conceptsById.get(accumulator.conceptId);
      const key = `${accumulator.id}|${accumulator.conceptId}`;
      if (!concept?.name || nameMismatchEmitted.has(key) || this.namesMatch(accumulator.conceptName, concept.name)) {
        return;
      }
      nameMismatchEmitted.add(key);

      issues.push(
        createIssue({
          code: IssueCodes.ACCUMULATOR_CONCEPT_NAME_MISMATCH,
          severity: 'WARNING',
          category: 'FUNCTIONAL_AUDIT',
          title: 'Nombre de concepto distinto en acumulador',
          message: `El acumulador ${accumulator.id ?? 'sin codigo'} usa el concepto ${accumulator.conceptId}, pero el nombre cargado es "${accumulator.conceptName}" y en Conceptos figura "${concept.name}".`,
          explanation:
            'El PDF usa la hoja Acumuladores para explicar que conceptos componen un auxiliar. Si el nombre no coincide, la contadora puede revisar el componente equivocado.',
          recommendation:
            'Corregir el nombre del concepto en Acumuladores o confirmar que el codigo de concepto sea el correcto.',
          location: accumulator.sourceColumns.conceptName ?? accumulator.sourceColumns.conceptId,
          entityType: 'ACCUMULATOR',
          entityId: accumulator.id,
          entityName: accumulator.name,
          referenceType: 'R',
          referenceId: accumulator.conceptId,
          relatedLocations: [
            this.recordLocation(accumulator),
            this.recordLocation(concept),
          ],
          blocksImport: false,
        }),
      );
    });

    accumulatorConceptOperations.forEach((records) => {
      const operations = new Set(records.map((record) => normalizeText(String(record.operation ?? ''))));
      if (!operations.has('suma') || !operations.has('resta')) {
        return;
      }
      const first = records[0];
      issues.push(
        createIssue({
          code: IssueCodes.ACCUMULATOR_CONTRADICTORY_OPERATION,
          severity: 'WARNING',
          category: 'FUNCTIONAL_AUDIT',
          title: 'Concepto sumado y restado en el mismo acumulador',
          message: `El acumulador ${first.id} incluye el concepto ${first.conceptId} como Suma y tambien como Resta.`,
          explanation:
            'Si un mismo componente entra con operaciones opuestas dentro del mismo acumulador, puede anularse o duplicar una correccion funcional.',
          recommendation:
            'Confirmar si la compensacion es intencional. Si no lo es, dejar una sola operacion para ese concepto dentro del acumulador.',
          location: first.sourceColumns.id,
          entityType: 'ACCUMULATOR',
          entityId: first.id,
          entityName: first.name,
          referenceType: 'R',
          referenceId: first.conceptId,
          relatedLocations: records.map((record) => this.recordLocation(record)),
          blocksImport: false,
        }),
      );
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

  private firstById<T extends { id?: number }>(records: T[]): Map<number, T> {
    const map = new Map<number, T>();
    records.forEach((record) => {
      if (record.id !== undefined && !map.has(record.id)) {
        map.set(record.id, record);
      }
    });
    return map;
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

  private namesMatch(left: unknown, right: unknown): boolean {
    const normalizeName = (value: unknown): string =>
      normalizeText(String(value ?? '')).replace(/[^a-z0-9]/g, '');
    const normalizedLeft = normalizeName(left);
    const normalizedRight = normalizeName(right);
    return (
      normalizedLeft === normalizedRight ||
      normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft)
    );
  }

  private recordLocation(record: { sheet: string; row: number; sourceColumns: Record<string, CellLocation> }): CellLocation {
    return (
      record.sourceColumns.id ??
      record.sourceColumns.conceptId ??
      record.sourceColumns.name ??
      Object.values(record.sourceColumns)[0] ?? {
        sheet: record.sheet,
        row: record.row,
      }
    );
  }
}
