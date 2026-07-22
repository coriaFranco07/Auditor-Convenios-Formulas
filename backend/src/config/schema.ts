import { FormulaColumnRole, SheetKey } from '../modules/formula-validation/types/workbook.types';

export interface ColumnSchema {
  key: string;
  label: string;
  aliases?: string[];
  required: boolean;
  role?: FormulaColumnRole;
  entityField?: string;
}

export interface SheetSchema {
  key: SheetKey;
  canonicalName: string;
  aliases: string[];
  required: boolean;
  minHeaderRow: number;
  maxHeaderRow: number;
  columns: ColumnSchema[];
}

export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const normalizeSheetName = (value: string): string =>
  normalizeText(value).replace(/[()]/g, '').replace(/\s+/g, ' ');

const column = (
  key: string,
  label: string,
  required: boolean,
  options: Partial<ColumnSchema> = {},
): ColumnSchema => ({
  key,
  label,
  required,
  ...options,
});

export const workbookSchema: SheetSchema[] = [
  {
    key: 'concepts',
    canonicalName: 'Conceptos y Formulas (1)',
    aliases: ['Conceptos y Fórmulas (1)', 'Conceptos y Formulas', 'Conceptos y Fórmulas'],
    required: true,
    minHeaderRow: 1,
    maxHeaderRow: 5,
    columns: [
      column('number', 'N°', true, { aliases: ['N', 'Numero', 'Número'], entityField: 'id' }),
      column('name', 'Concepto', true, { entityField: 'name' }),
      column('activation', 'Activación', true, { aliases: ['Activacion'], entityField: 'activation' }),
      column('scope', 'Alcance', true, { entityField: 'scope' }),
      column('monthlyCondition', 'Condición Mensual', false, {
        aliases: ['Condicion Mensual'],
        role: 'CONDITION',
        entityField: 'monthlyCondition',
      }),
      column('monthlyFormulaTrue', 'Fórmula Mensual (V)', false, {
        aliases: ['Formula Mensual (V)'],
        role: 'FORMULA',
        entityField: 'monthlyFormulaTrue',
      }),
      column('monthlyFormulaFalse', 'Fórmula Mensual (F)', false, {
        aliases: ['Formula Mensual (F)'],
        role: 'FORMULA',
        entityField: 'monthlyFormulaFalse',
      }),
      column('monthlyUnit', 'Unidad Mensual', false, {
        role: 'UNIT',
        entityField: 'monthlyUnit',
      }),
      column('dailyCondition', 'Condición Jornal', false, {
        aliases: ['Condicion Jornal'],
        role: 'CONDITION',
        entityField: 'dailyCondition',
      }),
      column('dailyFormulaTrue', 'Fórmula Jornal (V)', false, {
        aliases: ['Formula Jornal (V)'],
        role: 'FORMULA',
        entityField: 'dailyFormulaTrue',
      }),
      column('dailyFormulaFalse', 'Fórmula Jornal (F)', false, {
        aliases: ['Formula Jornal (F)'],
        role: 'FORMULA',
        entityField: 'dailyFormulaFalse',
      }),
      column('dailyUnit', 'Unidad Jornal', false, { role: 'UNIT', entityField: 'dailyUnit' }),
      column('totalizes', 'Totaliza', false, { entityField: 'totalizes' }),
      column('preFormula', 'Pre-Fórmula', false, {
        aliases: ['Pre-Formula'],
        role: 'FORMULA',
        entityField: 'preFormula',
      }),
      column('postFormula', 'Post - Fórmula', false, {
        aliases: ['Post - Formula', 'Post Fórmula', 'Post Formula'],
        role: 'FORMULA',
        entityField: 'postFormula',
      }),
      column('sequence', 'Secuentica', false, {
        aliases: ['Secuencia', 'Secuentica'],
        entityField: 'sequence',
      }),
    ],
  },
  {
    key: 'variables',
    canonicalName: 'Variables de Legajos (2)',
    aliases: ['Variables de Legajo (2)', 'Variables de Legajos'],
    required: true,
    minHeaderRow: 1,
    maxHeaderRow: 5,
    columns: [
      column('code', 'Código', true, { aliases: ['Codigo'], entityField: 'id' }),
      column('detail', 'Detalle', true, { entityField: 'name' }),
      column('abbreviation', 'Abreviatura', false, { entityField: 'abbreviation' }),
    ],
  },
  {
    key: 'auxiliaries',
    canonicalName: 'Calculo Auxiliares (3)',
    aliases: ['Cálculo Auxiliares (3)', 'Calculos Auxiliares (3)', 'Calculo Auxiliares'],
    required: true,
    minHeaderRow: 1,
    maxHeaderRow: 3,
    columns: [
      column('code', 'Cod', true, { aliases: ['Código', 'Codigo'], entityField: 'id' }),
      column('items', 'Items', true, { aliases: ['Item'], entityField: 'name' }),
      column('trueAlgorithm', 'Algorit.Verdadero', false, {
        aliases: ['Algoritmo Verdadero', 'Algorit Verdadero'],
        role: 'FORMULA',
        entityField: 'trueFormula',
      }),
      column('falseAlgorithm', 'Algorit.Falso', false, {
        aliases: ['Algoritmo Falso', 'Algorit Falso'],
        role: 'FORMULA',
        entityField: 'falseFormula',
      }),
      column('condition', 'Condicion', false, {
        aliases: ['Condición'],
        role: 'CONDITION',
        entityField: 'condition',
      }),
      column('value', 'Valor', false, { entityField: 'value' }),
      column('class', 'Clase', true, { entityField: 'class' }),
    ],
  },
  {
    key: 'accumulators',
    canonicalName: 'Acumuladores (4)',
    aliases: ['Acumuladores'],
    required: true,
    minHeaderRow: 1,
    maxHeaderRow: 3,
    columns: [
      column('code', 'Acumulador Código', true, {
        aliases: ['', 'Codigo', 'Código', 'Cod'],
        entityField: 'id',
      }),
      column('accumulator', 'Acumulador', true, { entityField: 'name' }),
      column('conceptCode', 'Codigo De Concepto', true, {
        aliases: ['Código De Concepto', 'Codigo de Concepto'],
        entityField: 'conceptId',
      }),
      column('concept', 'Concepto', false, { entityField: 'conceptName' }),
      column('operation', 'Valor', true, { aliases: ['Operacion', 'Operación'], entityField: 'operation' }),
    ],
  },
  {
    key: 'conventions',
    canonicalName: 'Convenios (5)',
    aliases: ['Convenios'],
    required: true,
    minHeaderRow: 1,
    maxHeaderRow: 3,
    columns: [
      column('code', 'CÓDIGO', true, { aliases: ['Código', 'Codigo'], entityField: 'id' }),
      column('detail', 'DETALLE', true, { aliases: ['Detalle'], entityField: 'name' }),
    ],
  },
];

export const documentedCatalogs = {
  activation: ['Automática', 'Manual'],
  scope: ['Mensual', 'Jornal', 'General'],
  auxiliaryClass: ['A', 'F', 'V'],
  accumulatorOperation: ['Suma', 'Resta'],
};

export const formulaReferenceTypes = ['N', 'I', 'A', 'R', 'U', 'L'] as const;

