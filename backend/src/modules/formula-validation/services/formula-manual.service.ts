import { uniqueReferences } from '../domain/formula-analysis';
import { buildSymbolTables, SymbolTables } from '../domain/symbol-table';
import { isBlank } from '../domain/normalization';
import { FormulaParser, normalizeWordOperators } from '../parsers/formula-parser';
import { Expression, FormulaParseResult, FormulaReference, ReferenceType } from '../types/formula.types';
import {
  FormulaManualItem,
  FormulaManualResponse,
  ManualAccumulatorConcept,
  ManualAttribute,
  ManualAuxiliaryDetail,
  ManualFormulaBlock,
  ManualFormulaExample,
  ManualReference,
  ManualRelatedIssue,
} from '../types/formula-manual.types';
import { StoredValidationResult, ValidationIssue } from '../types/validation.types';
import {
  AccumulatorRecord,
  AuxiliaryRecord,
  CellLocation,
  ConceptRecord,
  WorkbookContext,
} from '../types/workbook.types';

interface FormulaSource {
  id: string;
  title: string;
  role: ManualFormulaBlock['role'];
  sourceLabel: string;
  value?: unknown;
  location?: CellLocation;
}

type EvaluationValue = number | boolean;

export class FormulaManualService {
  private readonly parser = new FormulaParser();

  build(context: WorkbookContext, result: StoredValidationResult): FormulaManualResponse {
    const symbols = buildSymbolTables(context);
    const concepts = context.concepts.map((concept) => this.conceptManual(concept, context, symbols, result.issues));
    const auxiliaries = context.auxiliaries.map((auxiliary) =>
      this.auxiliaryManual(auxiliary, context, symbols, result.issues),
    );

    return {
      validationId: result.id,
      fileName: result.fileName,
      generatedAt: new Date().toISOString(),
      totals: {
        concepts: concepts.length,
        auxiliaries: auxiliaries.length,
        items: concepts.length + auxiliaries.length,
      },
      items: [...concepts, ...auxiliaries],
    };
  }

  private conceptManual(
    concept: ConceptRecord,
    context: WorkbookContext,
    symbols: SymbolTables,
    issues: ValidationIssue[],
  ): FormulaManualItem {
    const formulas = this.buildFormulaBlocks(this.conceptFormulaSources(concept), symbols);
    const references = this.uniqueReferencesFromBlocks(formulas);
    return {
      id: `CONCEPT-${concept.id ?? concept.row}`,
      entityType: 'CONCEPT',
      entityId: concept.id,
      name: concept.name ?? 'Concepto sin nombre',
      title: `Concepto ${concept.id ?? '?'} ${concept.name ?? 'sin nombre'}`,
      sheet: concept.sheet,
      row: concept.row,
      objective: `Determinar el importe o las unidades del concepto "${concept.name ?? concept.id ?? 'sin nombre'}" dentro de la liquidacion de sueldos.`,
      summary: this.conceptSummary(concept, formulas),
      attributes: [
        this.attribute('Activacion', concept.activation),
        this.attribute('Alcance', concept.scope),
        this.attribute('Totaliza', concept.totalizes),
        this.attribute('Secuencia', concept.sequence),
      ],
      formulas,
      references,
      auxiliaryDetails: this.auxiliaryDetailsFor(references, context),
      relatedIssues: this.relatedIssuesFor('CONCEPT', concept, issues),
      reviewNotes: [
        'Revisar primero la condicion. Si existe, la Formula (V) se interpreta cuando la condicion se cumple y la Formula (F) cuando no se cumple.',
        'La unidad mensual o jornal explica la cantidad que multiplica o acompana el importe del concepto.',
        'Las referencias A[], R[], U[] y L[] deben poder leerse contra auxiliares, conceptos o variables del mismo archivo.',
      ],
    };
  }

  private auxiliaryManual(
    auxiliary: AuxiliaryRecord,
    context: WorkbookContext,
    symbols: SymbolTables,
    issues: ValidationIssue[],
  ): FormulaManualItem {
    const formulas = this.buildFormulaBlocks(this.auxiliaryFormulaSources(auxiliary), symbols);
    const references = this.uniqueReferencesFromBlocks(formulas);
    return {
      id: `AUXILIARY-${auxiliary.id ?? auxiliary.row}`,
      entityType: 'AUXILIARY',
      entityId: auxiliary.id,
      name: auxiliary.name ?? 'Auxiliar sin nombre',
      title: `Auxiliar A[${auxiliary.id ?? '?'}] ${auxiliary.name ?? 'sin nombre'}`,
      sheet: auxiliary.sheet,
      row: auxiliary.row,
      objective: `Explicar como se obtiene el valor intermedio A[${auxiliary.id ?? '?'}] para usarlo en conceptos u otros auxiliares.`,
      summary: this.auxiliarySummary(auxiliary, context),
      attributes: [
        this.attribute('Tipo de auxiliar', this.auxiliaryTypeLabel(auxiliary.class)),
        this.attribute('Clase original', auxiliary.class),
        this.attribute('Valor fijo', auxiliary.value),
      ],
      formulas,
      references,
      auxiliaryDetails: this.auxiliaryDetailsFor(references, context),
      relatedIssues: this.relatedIssuesFor('AUXILIARY', auxiliary, issues),
      reviewNotes: [
        'Si la clase es F, el valor se obtiene desde el algoritmo verdadero o falso segun la condicion cargada.',
        'Si la clase es V, el dato deberia salir del campo Valor.',
        'Si la clase es A, los conceptos del acumulador se muestran solo como apoyo documental; no se auditan como errores de formulas.',
      ],
    };
  }

  private conceptFormulaSources(concept: ConceptRecord): FormulaSource[] {
    return [
      {
        id: 'monthlyUnit',
        title: 'Unidad mensual',
        role: 'UNIT',
        sourceLabel: 'Hoja 1, columna H',
        value: concept.monthlyUnit,
        location: concept.sourceColumns.monthlyUnit,
      },
      {
        id: 'monthlyCondition',
        title: 'Condicion mensual',
        role: 'CONDITION',
        sourceLabel: 'Hoja 1, columna E',
        value: concept.monthlyCondition,
        location: concept.sourceColumns.monthlyCondition,
      },
      {
        id: 'monthlyFormulaTrue',
        title: 'Formula mensual si se cumple',
        role: 'FORMULA',
        sourceLabel: 'Hoja 1, columna F',
        value: concept.monthlyFormulaTrue,
        location: concept.sourceColumns.monthlyFormulaTrue,
      },
      {
        id: 'monthlyFormulaFalse',
        title: 'Formula mensual caso contrario',
        role: 'FORMULA',
        sourceLabel: 'Hoja 1, columna G',
        value: concept.monthlyFormulaFalse,
        location: concept.sourceColumns.monthlyFormulaFalse,
      },
      {
        id: 'dailyUnit',
        title: 'Unidad jornal',
        role: 'UNIT',
        sourceLabel: 'Hoja 1, columna L',
        value: concept.dailyUnit,
        location: concept.sourceColumns.dailyUnit,
      },
      {
        id: 'dailyCondition',
        title: 'Condicion jornal',
        role: 'CONDITION',
        sourceLabel: 'Hoja 1, columna I',
        value: concept.dailyCondition,
        location: concept.sourceColumns.dailyCondition,
      },
      {
        id: 'dailyFormulaTrue',
        title: 'Formula jornal si se cumple',
        role: 'FORMULA',
        sourceLabel: 'Hoja 1, columna J',
        value: concept.dailyFormulaTrue,
        location: concept.sourceColumns.dailyFormulaTrue,
      },
      {
        id: 'dailyFormulaFalse',
        title: 'Formula jornal caso contrario',
        role: 'FORMULA',
        sourceLabel: 'Hoja 1, columna K',
        value: concept.dailyFormulaFalse,
        location: concept.sourceColumns.dailyFormulaFalse,
      },
      {
        id: 'preFormula',
        title: 'Pre-formula',
        role: 'PRE_POST',
        sourceLabel: 'Hoja 1, columna N',
        value: concept.preFormula,
        location: concept.sourceColumns.preFormula,
      },
      {
        id: 'postFormula',
        title: 'Post-formula',
        role: 'PRE_POST',
        sourceLabel: 'Hoja 1, columna O',
        value: concept.postFormula,
        location: concept.sourceColumns.postFormula,
      },
    ];
  }

  private auxiliaryFormulaSources(auxiliary: AuxiliaryRecord): FormulaSource[] {
    return [
      {
        id: 'condition',
        title: 'Cuando se usa',
        role: 'CONDITION',
        sourceLabel: 'Hoja 3, columna E',
        value: auxiliary.condition,
        location: auxiliary.sourceColumns.condition,
      },
      {
        id: 'trueFormula',
        title: 'Algoritmo verdadero',
        role: 'FORMULA',
        sourceLabel: 'Hoja 3, columna C',
        value: auxiliary.trueFormula,
        location: auxiliary.sourceColumns.trueFormula,
      },
      {
        id: 'falseFormula',
        title: 'Algoritmo falso',
        role: 'FORMULA',
        sourceLabel: 'Hoja 3, columna D',
        value: auxiliary.falseFormula,
        location: auxiliary.sourceColumns.falseFormula,
      },
    ];
  }

  private buildFormulaBlocks(sources: FormulaSource[], symbols: SymbolTables): ManualFormulaBlock[] {
    return sources
      .map((source) => this.formulaBlock(source, symbols))
      .filter((block): block is ManualFormulaBlock => Boolean(block));
  }

  private formulaBlock(source: FormulaSource, symbols: SymbolTables): ManualFormulaBlock | undefined {
    const formula = this.cleanText(source.value);
    if (!formula) {
      return undefined;
    }

    const parseResult = this.parser.parse(formula);
    const references = uniqueReferences(parseResult.references).map((reference) =>
      this.resolveReference(reference, symbols),
    );

    return {
      id: source.id,
      title: source.title,
      role: source.role,
      sourceLabel: source.sourceLabel,
      formula,
      readable: this.readableFormula(formula, references),
      inferredType: parseResult.inferredType,
      location: source.location,
      references,
      example: this.exampleFor(formula, references, parseResult),
    };
  }

  private resolveReference(reference: FormulaReference, symbols: SymbolTables): ManualReference {
    const token = `${reference.type}[${reference.id ?? reference.rawId}]`;
    if (reference.id === undefined) {
      return {
        token,
        type: reference.type,
        label: 'Referencia sin identificador numerico',
        meaning: 'La referencia no tiene un identificador numerico que pueda buscarse en el Excel.',
        status: 'No encontrada',
      };
    }

    if (reference.type === 'A') {
      const auxiliary = symbols.auxiliaries.get(reference.id)?.[0];
      return auxiliary
        ? {
            token,
            type: reference.type,
            id: reference.id,
            label: `Auxiliar ${reference.id} ${auxiliary.name ?? ''}`.trim(),
            meaning: `Resultado del calculo auxiliar ${reference.id}${auxiliary.name ? ` - ${auxiliary.name}` : ''}.`,
            status: 'Encontrada',
            sheet: auxiliary.sheet,
            row: auxiliary.row,
            formula: this.joinFormulaParts([auxiliary.condition, auxiliary.trueFormula, auxiliary.falseFormula, auxiliary.value]),
          }
        : this.missingReference(token, reference.type, reference.id, 'calculo auxiliar');
    }

    if (reference.type === 'L') {
      const variable = symbols.variables.get(reference.id)?.[0];
      return variable
        ? {
            token,
            type: reference.type,
            id: reference.id,
            label: `Variable ${reference.id} ${variable.name ?? ''}`.trim(),
            meaning: `Dato del legajo del empleado: ${variable.name ?? `variable ${reference.id}`}.`,
            status: 'Encontrada',
            sheet: variable.sheet,
            row: variable.row,
          }
        : this.missingReference(token, reference.type, reference.id, 'variable de legajo');
    }

    const concept = symbols.concepts.get(reference.id)?.[0];
    const conceptLabel = concept?.name ? `concepto ${reference.id} - ${concept.name}` : `concepto ${reference.id}`;
    const meaningByType: Record<ReferenceType, string> = {
      R: `Importe calculado del ${conceptLabel}.`,
      U: `Unidad calculada del ${conceptLabel}.`,
      N: `Novedad en unidades vinculada al ${conceptLabel}.`,
      I: `Importe de novedad vinculado al ${conceptLabel}.`,
      A: '',
      L: '',
    };

    if (!concept) {
      const target = reference.type === 'N' || reference.type === 'I' ? 'novedad/concepto' : 'concepto';
      return {
        ...this.missingReference(token, reference.type, reference.id, target),
        status: reference.type === 'N' || reference.type === 'I' ? 'Novedad externa' : 'No encontrada',
      };
    }

    return {
      token,
      type: reference.type,
      id: reference.id,
      label: conceptLabel,
      meaning: meaningByType[reference.type],
      status: reference.type === 'N' || reference.type === 'I' ? 'Novedad externa' : 'Encontrada',
      sheet: concept.sheet,
      row: concept.row,
      formula: this.joinFormulaParts([
        concept.monthlyCondition,
        concept.monthlyFormulaTrue,
        concept.monthlyFormulaFalse,
        concept.monthlyUnit,
        concept.dailyCondition,
        concept.dailyFormulaTrue,
        concept.dailyFormulaFalse,
        concept.dailyUnit,
      ]),
    };
  }

  private missingReference(token: string, type: ReferenceType, id: number, target: string): ManualReference {
    return {
      token,
      type,
      id,
      label: `${target} ${id}`,
      meaning: `No se encontro ${token} en la tabla esperada de ${target}.`,
      status: 'No encontrada',
    };
  }

  private readableFormula(formula: string, references: ManualReference[]): string {
    const referenceByToken = new Map(references.map((reference) => [reference.token, reference.meaning]));
    return normalizeWordOperators(formula)
      .replace(/\bSI\s*\(/gi, 'Si se cumple (')
      .replace(/\bY\s*\(/gi, 'todas estas condiciones (')
      .replace(/\bO\s*\(/gi, 'alguna de estas condiciones (')
      .replace(/\bNO\s*\(/gi, 'no se cumple (')
      .replace(/;/g, '; entonces ')
      .replace(/\b([NIARUL])\[(\d+)\]/g, (match) => referenceByToken.get(match) ?? match)
      .replace(/\s*([+*/])\s*/g, ' $1 ')
      .replace(/([)\]\d])\s*-\s*([A-Za-z0-9_(])/g, '$1 - $2')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private exampleFor(
    formula: string,
    references: ManualReference[],
    parseResult: FormulaParseResult,
  ): ManualFormulaExample | undefined {
    if (parseResult.syntaxErrors.length > 0 || references.length === 0) {
      return undefined;
    }

    const assignments = new Map<string, number>();
    references.forEach((reference) => assignments.set(reference.token, this.sampleValueFor(reference)));
    const result = this.evaluate(parseResult.ast, assignments);
    if (result === undefined) {
      return undefined;
    }

    return {
      title: 'Ejemplo numerico orientativo',
      assumptions: references.map((reference) => this.attribute(reference.token, assignments.get(reference.token))),
      expression: formula.replace(/\b[NIARUL]\[\d+\]/g, (token) => String(assignments.get(token) ?? token)),
      result: this.formatValue(result),
      note: 'Es un ejemplo con valores supuestos para entender la mecanica. El resultado real lo calcula e-Sueldos con datos del empleado y novedades reales.',
    };
  }

  private evaluate(expression: Expression, assignments: Map<string, number>): EvaluationValue | undefined {
    switch (expression.kind) {
      case 'NumericLiteral':
        return expression.value;
      case 'ReferenceExpression':
        return assignments.get(`${expression.referenceType}[${expression.referenceId ?? expression.rawId}]`);
      case 'UnaryExpression': {
        const value = this.evaluate(expression.argument, assignments);
        if (value === undefined) {
          return undefined;
        }
        if (expression.operator === '!') {
          return !value;
        }
        return expression.operator === '-' ? -Number(value) : Number(value);
      }
      case 'BinaryExpression': {
        const left = this.evaluate(expression.left, assignments);
        const right = this.evaluate(expression.right, assignments);
        if (typeof left !== 'number' || typeof right !== 'number') {
          return undefined;
        }
        if (expression.operator === '+') {
          return left + right;
        }
        if (expression.operator === '-') {
          return left - right;
        }
        if (expression.operator === '*') {
          return left * right;
        }
        return right === 0 ? undefined : left / right;
      }
      case 'ComparisonExpression': {
        const left = this.evaluate(expression.left, assignments);
        const right = this.evaluate(expression.right, assignments);
        if (typeof left !== 'number' || typeof right !== 'number') {
          return undefined;
        }
        return this.compareValues(left, right, expression.operator);
      }
      case 'LogicalExpression': {
        const left = this.evaluate(expression.left, assignments);
        const right = this.evaluate(expression.right, assignments);
        if (left === undefined || right === undefined) {
          return undefined;
        }
        return expression.operator === '&&'
          ? this.truthy(left) && this.truthy(right)
          : this.truthy(left) || this.truthy(right);
      }
      case 'FunctionCallExpression':
        return this.evaluateFunction(expression.name, expression.args, assignments);
      default:
        return undefined;
    }
  }

  private evaluateFunction(
    name: string,
    args: Expression[],
    assignments: Map<string, number>,
  ): EvaluationValue | undefined {
    const values = args.map((arg) => this.evaluate(arg, assignments));
    if (values.some((value) => value === undefined)) {
      return undefined;
    }
    const safeValues = values as EvaluationValue[];
    if (name === 'SI') {
      return safeValues[0] ? safeValues[1] : safeValues[2];
    }
    if (name === 'Y') {
      return safeValues.every((value) => this.truthy(value));
    }
    if (name === 'O') {
      return safeValues.some((value) => this.truthy(value));
    }
    if (name === 'NO') {
      return !safeValues[0];
    }
    return undefined;
  }

  private compareValues(left: number, right: number, operator: string): boolean {
    if (operator === '>') {
      return left > right;
    }
    if (operator === '<') {
      return left < right;
    }
    if (operator === '>=') {
      return left >= right;
    }
    if (operator === '<=') {
      return left <= right;
    }
    if (operator === '!=') {
      return left !== right;
    }
    return left === right;
  }

  private truthy(value: EvaluationValue): boolean {
    return value !== false && value !== 0;
  }

  private sampleValueFor(reference: ManualReference): number {
    if (reference.type === 'N' || reference.type === 'U') {
      return 20;
    }
    if (reference.type === 'A') {
      const numericValue = this.firstNumber(reference.formula);
      return numericValue ?? 1;
    }
    if (reference.type === 'R' || reference.type === 'I') {
      return 10000;
    }
    return 100000;
  }

  private uniqueReferencesFromBlocks(blocks: ManualFormulaBlock[]): ManualReference[] {
    const seen = new Set<string>();
    return blocks
      .flatMap((block) => block.references)
      .filter((reference) => {
        if (seen.has(reference.token)) {
          return false;
        }
        seen.add(reference.token);
        return true;
      });
  }

  private auxiliaryDetailsFor(references: ManualReference[], context: WorkbookContext): ManualAuxiliaryDetail[] {
    return references
      .filter((reference) => reference.type === 'A' && reference.id !== undefined)
      .map((reference) => context.auxiliaries.find((auxiliary) => auxiliary.id === reference.id))
      .filter((auxiliary): auxiliary is AuxiliaryRecord => Boolean(auxiliary))
      .map((auxiliary) => ({
        token: `A[${auxiliary.id}]`,
        name: auxiliary.name ?? 'Auxiliar sin nombre',
        type: this.auxiliaryTypeLabel(auxiliary.class),
        sheet: auxiliary.sheet,
        row: auxiliary.row,
        condition: this.cleanText(auxiliary.condition),
        trueFormula: this.cleanText(auxiliary.trueFormula),
        falseFormula: this.cleanText(auxiliary.falseFormula),
        value: this.cleanText(auxiliary.value),
        accumulatorConcepts: this.accumulatorConceptsFor(auxiliary, context.accumulators),
      }));
  }

  private accumulatorConceptsFor(
    auxiliary: AuxiliaryRecord,
    accumulators: AccumulatorRecord[],
  ): ManualAccumulatorConcept[] {
    if (auxiliary.id === undefined) {
      return [];
    }
    return accumulators
      .filter((accumulator) => accumulator.id === auxiliary.id)
      .map((accumulator) => ({
        conceptId: accumulator.conceptId,
        conceptName: accumulator.conceptName,
        operation: accumulator.operation,
      }));
  }

  private relatedIssuesFor(
    entityType: 'CONCEPT' | 'AUXILIARY',
    record: ConceptRecord | AuxiliaryRecord,
    issues: ValidationIssue[],
  ): ManualRelatedIssue[] {
    return issues
      .filter(
        (issue) =>
          (issue.entityType === entityType && issue.entityId === record.id) ||
          (issue.sheet === record.sheet && issue.row === record.row),
      )
      .slice(0, 8)
      .map((issue) => ({
        title: issue.title,
        message: issue.message,
        recommendation: issue.recommendation,
        location: issue.sheet
          ? { sheet: issue.sheet, row: issue.row ?? record.row, column: issue.column, cell: issue.cell }
          : undefined,
      }));
  }

  private conceptSummary(concept: ConceptRecord, formulas: ManualFormulaBlock[]): string {
    const parts = [
      concept.activation ? `Se activa de forma ${concept.activation}.` : undefined,
      concept.scope ? `Tiene alcance ${concept.scope}.` : undefined,
      formulas.length > 0
        ? `El manual encontro ${formulas.length} campo${formulas.length === 1 ? '' : 's'} con formula, condicion o unidad para explicar.`
        : 'No tiene formulas registradas en las columnas documentadas por el PDF.',
    ].filter(Boolean);
    return parts.join(' ');
  }

  private auxiliarySummary(auxiliary: AuxiliaryRecord, context: WorkbookContext): string {
    const type = this.auxiliaryTypeLabel(auxiliary.class);
    if (String(auxiliary.class ?? '').trim().toUpperCase() === 'A') {
      const count = this.accumulatorConceptsFor(auxiliary, context.accumulators).length;
      return `${type}. ${count > 0 ? `El manual encontro ${count} concepto${count === 1 ? '' : 's'} vinculado${count === 1 ? '' : 's'} en Acumuladores (4).` : 'No se encontraron conceptos vinculados en Acumuladores (4).'}`;
    }
    if (String(auxiliary.class ?? '').trim().toUpperCase() === 'V') {
      return `${type}. Su valor documentado es ${this.cleanText(auxiliary.value) ?? 'no informado'}.`;
    }
    return `${type}. Se explica desde condicion, algoritmo verdadero y algoritmo falso cuando esten cargados.`;
  }

  private auxiliaryTypeLabel(value: unknown): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'F') {
      return 'Formula';
    }
    if (normalized === 'A') {
      return 'Acumulador';
    }
    if (normalized === 'V') {
      return 'Valor constante';
    }
    return normalized ? `Clase ${normalized}` : 'Tipo no informado';
  }

  private attribute(label: string, value: unknown): ManualAttribute {
    return {
      label,
      value: this.cleanText(value) ?? '-',
    };
  }

  private cleanText(value: unknown): string | undefined {
    if (isBlank(value)) {
      return undefined;
    }
    return String(value).trim();
  }

  private joinFormulaParts(values: unknown[]): string | undefined {
    const parts = values.map((value) => this.cleanText(value)).filter(Boolean);
    return parts.length > 0 ? parts.join(' | ') : undefined;
  }

  private firstNumber(value?: string): number | undefined {
    const match = /-?\d+([.,]\d+)?/.exec(value ?? '');
    return match ? Number(match[0].replace(',', '.')) : undefined;
  }

  private formatValue(value: EvaluationValue): string {
    if (typeof value === 'boolean') {
      return value ? 'Verdadero' : 'Falso';
    }
    return value.toLocaleString('es-AR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    });
  }
}
