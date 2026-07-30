import ExcelJS from 'exceljs';

const conceptHeaders = [
  'N°',
  'Concepto',
  'Activación',
  'Alcance',
  'Condición Mensual',
  'Fórmula Mensual (V)',
  'Fórmula Mensual (F)',
  'Unidad Mensual',
  'Condición Jornal',
  'Fórmula Jornal (V)',
  'Fórmula Jornal (F)',
  'Unidad Jornal',
  'Totaliza',
  'Pre-Fórmula',
  'Post - Fórmula',
  'Secuentica',
];

export interface FixtureOptions {
  omitVariablesSheet?: boolean;
  omitAuxiliariesSheet?: boolean;
  missingReference?: boolean;
  duplicateConflict?: boolean;
  invalidCondition?: boolean;
  selfReference?: boolean;
  indirectCycle?: boolean;
  incompleteAccumulator?: boolean;
  invalidAuxiliary?: boolean;
  semanticTypeMismatch?: boolean;
  incompleteConceptFormula?: boolean;
  scopeMismatch?: boolean;
  wordOperatorFormula?: boolean;
  pdfFunctionalIssues?: boolean;
  repeatedConceptNameForAccumulator?: boolean;
  externalNoveltyReferences?: boolean;
  repeatedMissingReference?: boolean;
  accumulatorAuxiliaryWithZeroValue?: boolean;
  sameMissingReferenceAcrossColumns?: boolean;
  multipleMissingReferencesInOneFormula?: boolean;
}

export const createWorkbookFixture = async (options: FixtureOptions = {}): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();

  const concepts = workbook.addWorksheet('Conceptos y Formulas (1)');
  concepts.addRow(['e-Sueldos_datos_exportados_test']);
  concepts.addRow(conceptHeaders);
  concepts.addRow([
    1,
    'SUELDO BASICO',
    'Automática',
    'Mensual',
    options.incompleteConceptFormula ? null : options.invalidCondition ? 'L[10] * 1.5' : 'L[10] > 0',
    options.wordOperatorFormula
      ? 'L[10] mas N[1]'
      : options.semanticTypeMismatch
      ? 'SI(L[10]; 1; 0)'
      : options.missingReference || options.sameMissingReferenceAcrossColumns
      ? 'A[6] / 24 * N[1]'
      : 'L[10]',
    options.incompleteConceptFormula ? '0' : null,
    'N[1]',
    null,
    options.sameMissingReferenceAcrossColumns ? 'A[6] / 24 * N[1]' : options.scopeMismatch ? 'L[10]' : null,
    null,
    null,
    12,
    options.pdfFunctionalIssues ? 'Retencion de Alimentos' : null,
    null,
    1,
  ]);
  if (options.duplicateConflict) {
    concepts.addRow([1, 'SUELDO BASICO OTRO', 'Automática', 'Mensual', null, 'L[10] * 2', null, null, null, null, null, null, 12, null, null, 2]);
  }
  if (options.indirectCycle) {
    concepts.addRow([2, 'CICLO', 'Automática', 'Mensual', null, 'A[10]', null, null, null, null, null, null, 12, null, null, 2]);
  }
  if (options.selfReference) {
    concepts.addRow([3, 'AUTOREFERENCIA', 'Automática', 'Mensual', null, 'R[3]', null, null, null, null, null, null, 12, null, null, 3]);
  }

  if (options.pdfFunctionalIssues) {
    concepts.addRow([2, 'CONCEPTO ORDENADO ANTES', 'Automatica', 'Mensual', null, 'R[3]', null, 'R[1]', null, null, null, null, 'Si', null, null, 2]);
    concepts.addRow([3, 'CONCEPTO POSTERIOR', 'Automatica', 'Mensual', null, 'L[10]', null, null, null, null, null, null, 12, null, null, 3]);
  }

  if (options.repeatedConceptNameForAccumulator) {
    concepts.addRow([445, 'ANTIGUEDAD S/ ACUERDO 2020', 'Automatica', 'Mensual', null, 'L[10]', null, null, null, null, null, null, 12, null, null, 67]);
    concepts.addRow([445, 'ANTIGUEDAD s/ACUERDO NR 2', 'Automatica', 'Mensual', null, 'L[10]', null, null, null, null, null, null, 12, null, null, 68]);
  }

  if (options.externalNoveltyReferences) {
    concepts.addRow([20, 'NOVEDADES EXTERNAS', 'Automatica', 'Mensual', null, 'N[999] + I[998]', null, null, null, null, null, null, 12, null, null, 20]);
  }

  if (options.repeatedMissingReference) {
    concepts.addRow([21, 'REFERENCIA REPETIDA', 'Automatica', 'Mensual', null, 'U[999] + U[999]', null, null, null, null, null, null, 12, null, null, 21]);
  }

  if (options.multipleMissingReferencesInOneFormula) {
    concepts.addRow([22, 'MULTIPLES REFERENCIAS', 'Automatica', 'Mensual', null, 'R[991] + R[992] + R[993]', null, null, null, null, null, null, 12, null, null, 22]);
  }

  if (!options.omitVariablesSheet) {
    const variables = workbook.addWorksheet('Variables de Legajos (2)');
    variables.addRow(['e-Sueldos_datos_exportados_test']);
    variables.addRow(['Código', 'Detalle', 'Abreviatura']);
    variables.addRow([10, 'ASIGNACION MENSUAL', 'ASIG']);
  }

  if (!options.omitAuxiliariesSheet) {
    const auxiliaries = workbook.addWorksheet('Calculo Auxiliares (3)');
    auxiliaries.addRow(['Cod', 'Items', 'Algorit.Verdadero', 'Algorit.Falso', 'Condicion', 'Valor', 'Clase']);
    if (options.indirectCycle) {
      auxiliaries.addRow([10, 'AUX CICLO', 'R[2]', null, null, null, 'F']);
    }
    if (options.invalidAuxiliary) {
      auxiliaries.addRow([20, 'AUX INVALIDO', null, 'L[10]', null, null, 'F']);
    }

    if (options.pdfFunctionalIssues) {
      auxiliaries.addRow([30, 'VALOR FIJO SIN VALOR', null, null, null, null, 'V']);
      auxiliaries.addRow([31, 'FORMULA CON COMPONENTES', 'L[10]', null, null, null, 'F']);
      auxiliaries.addRow([32, 'ACUMULADOR CON FORMULA', 'L[10]', null, null, null, 'A']);
    }
    if (options.accumulatorAuxiliaryWithZeroValue) {
      auxiliaries.addRow([60, 'ACUMULADOR CON CERO', null, null, null, 0, 'A']);
    }
  }

  const accumulators = workbook.addWorksheet('Acumuladores (4)');
  accumulators.addRow([null, 'Acumulador', 'Codigo De Concepto', 'Concepto', 'Valor']);
  if (options.incompleteAccumulator) {
    accumulators.addRow([1, 'TOTAL', null, null, 'Suma']);
  }
  if (options.pdfFunctionalIssues) {
    accumulators.addRow([31, 'FORMULA CON COMPONENTES', 1, 'SUELDO BASICO', 'Suma']);
    accumulators.addRow([40, 'TOTAL PRUEBA', 1, 'OTRO NOMBRE', 'Suma']);
    accumulators.addRow([41, 'TOTAL CANCELADO', 1, 'SUELDO BASICO', 'Suma']);
    accumulators.addRow([41, 'TOTAL CANCELADO', 1, 'SUELDO BASICO', 'Resta']);
  }
  if (options.repeatedConceptNameForAccumulator) {
    accumulators.addRow([10, 'TOTAL NO REMUNERATIVO', 445, 'ANTIGUEDAD s/ACUERDO NR 2', 'Suma']);
  }

  const conventions = workbook.addWorksheet('Convenios (5)');
  conventions.addRow(['CÓDIGO', 'DETALLE']);
  conventions.addRow([1, 'COMERCIO']);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
};
