import path from 'node:path';
import ExcelJS from 'exceljs';
import request from 'supertest';
import type SuperAgentResponse from 'superagent/lib/node/response';
import { createApp } from '../src/app';
import { createWorkbookFixture } from './helpers/workbook-fixture';

const parseBinaryResponse = (
  response: SuperAgentResponse,
  callback: (error: Error | null, body?: Buffer) => void,
): void => {
  const chunks: Buffer[] = [];

  response.on('data', (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback);
};

describe('Validation API', () => {
  const app = createApp();

  it('informa health', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.node).toContain('v18.14.');
  });

  it('sube un XLSX valido', async () => {
    const buffer = await createWorkbookFixture();
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'valido.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);
    expect(response.body.summary.status).toBe('VALID');
    expect(response.body.summary.formulasAnalyzed).toBeGreaterThan(0);

    const id = response.body.id;
    const history = await request(app).get('/api/validations').expect(200);
    expect(history.body).toEqual(expect.arrayContaining([expect.objectContaining({ id, fileName: 'valido.xlsx' })]));
    await request(app).get(`/api/validations/${id}/export/json`).expect(200);
    await request(app).get(`/api/validations/${id}/export/csv`).expect(200);
    await request(app).get(`/api/validations/${id}/export/xlsx`).expect(200);
    const issueReport = await request(app).get(`/api/validations/${id}/export/issues-xlsx`).expect(200);
    expect(issueReport.headers['content-disposition']).toContain('valido-Errores.xlsx');
  });

  it('elimina un analisis del historial', async () => {
    const buffer = await createWorkbookFixture();
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'para-eliminar.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const id = response.body.id;
    await request(app).delete(`/api/validations/${id}`).expect(204);
    await request(app).get(`/api/validations/${id}`).expect(404);

    const history = await request(app).get('/api/validations').expect(200);
    expect(history.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });

  it('genera el manual explicativo de conceptos y auxiliares', async () => {
    const buffer = await createWorkbookFixture({
      missingReference: true,
      pdfFunctionalIssues: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'manual.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const manual = await request(app).get(`/api/validations/${response.body.id}/manual`).expect(200);
    expect(manual.body.totals.concepts).toBeGreaterThan(0);
    expect(manual.body.totals.auxiliaries).toBeGreaterThan(0);

    const sueldoBasico = manual.body.items.find(
      (item: { entityType?: string; entityId?: number }) => item.entityType === 'CONCEPT' && item.entityId === 1,
    );
    expect(sueldoBasico).toEqual(expect.objectContaining({ name: 'SUELDO BASICO' }));
    expect(sueldoBasico.formulas.some((formula: { title?: string }) => formula.title === 'Unidad mensual')).toBe(true);
    expect(sueldoBasico.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ token: 'A[6]', status: 'No encontrada' }),
        expect.objectContaining({ token: 'N[1]', status: 'Novedad externa' }),
      ]),
    );

    const auxiliary = manual.body.items.find(
      (item: { entityType?: string; entityId?: number }) => item.entityType === 'AUXILIARY' && item.entityId === 31,
    );
    expect(auxiliary.summary).toContain('Formula');
    expect(auxiliary.references).toEqual(expect.arrayContaining([expect.objectContaining({ token: 'L[10]' })]));
  });

  it('rechaza extension invalida', async () => {
    await request(app)
      .post('/api/validations')
      .attach('file', Buffer.from('x'), {
        filename: 'archivo.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('devuelve FAILED para XLSX corrupto', async () => {
    const response = await request(app)
      .post('/api/validations')
      .attach('file', Buffer.from('no es xlsx'), {
        filename: 'corrupto.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(400);
    expect(response.body.summary.status).toBe('FAILED');
  });

  it('rechaza archivo demasiado grande', async () => {
    const large = Buffer.alloc(11 * 1024 * 1024, 1);
    await request(app)
      .post('/api/validations')
      .attach('file', large, {
        filename: 'grande.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(400);
  });

  it('detecta hoja faltante', async () => {
    const buffer = await createWorkbookFixture({ omitAuxiliariesSheet: true });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'sin-hoja.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);
    expect(response.body.summary.status).toBe('BLOCKED');
    expect(response.body.issues.some((issue: { code: string }) => issue.code === 'MISSING_REQUIRED_SHEET')).toBe(true);
  });

  it('detecta referencias inexistentes, tipos y ciclos', async () => {
    const buffer = await createWorkbookFixture({
      missingReference: true,
      invalidCondition: true,
      selfReference: true,
      indirectCycle: true,
      invalidAuxiliary: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'errores.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);
    const codes = response.body.issues.map((issue: { code: string }) => issue.code);
    expect(codes).toContain('MISSING_AUXILIARY_REFERENCE');
    expect(codes).toContain('INVALID_CONDITION_TYPE');
    expect(codes).toContain('SELF_REFERENCE');
    expect(codes).toContain('CIRCULAR_DEPENDENCY');
    expect(codes).toContain('INVALID_AUXILIARY_ROW');
  });

  it('no trata el numero repetido de conceptos como duplicado', async () => {
    const buffer = await createWorkbookFixture({
      duplicateConflict: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'orden-repetido.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const conceptDuplicates = response.body.issues.filter(
      (issue: { category?: string; entityType?: string }) =>
        issue.category === 'DUPLICATES' && issue.entityType === 'CONCEPT',
    );
    expect(conceptDuplicates).toEqual([]);
  });

  it('detecta problemas funcionales dentro de formulas', async () => {
    const buffer = await createWorkbookFixture({
      semanticTypeMismatch: true,
      incompleteConceptFormula: true,
      scopeMismatch: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'formulas-funcionales.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);
    const codes = response.body.issues.map((issue: { code: string }) => issue.code);
    expect(codes).toContain('FORMULA_TYPE_MISMATCH');
    expect(codes).toContain('INCOMPLETE_CONDITIONAL_FORMULA');
    expect(codes).toContain('FORMULA_SCOPE_MISMATCH');
  });

  it('detecta controles funcionales pedidos por el PDF', async () => {
    const buffer = await createWorkbookFixture({
      pdfFunctionalIssues: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'auditoria-pdf.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const codes = response.body.issues.map((issue: { code: string }) => issue.code);
    expect(codes).toContain('UNIT_USES_AMOUNT_REFERENCE');
    expect(codes).toContain('TOTALIZES_VALUE_INVALID');
    expect(codes).toContain('AUXILIARY_VALUE_MISSING');
    expect(codes).toContain('AUXILIARY_ACCUMULATOR_HAS_FORMULA');
  });

  it('no marca condiciones que usan resultados calculados como problema de auditoria', async () => {
    const buffer = await createWorkbookFixture({
      pdfFunctionalIssues: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'condicion-con-resultados.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const codes = response.body.issues.map((issue: { code: string }) => issue.code);
    expect(codes).not.toContain('CONDITION_USES_RESULT_REFERENCE');
    expect(codes).not.toContain('CALCULATION_ORDER_REVIEW');
  });

  it('no usa la hoja Acumuladores para comparar nombres de conceptos', async () => {
    const buffer = await createWorkbookFixture({
      repeatedConceptNameForAccumulator: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'acumulador-concepto-repetido.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const accumulatorNameMismatch = response.body.issues.filter(
      (issue: { code?: string; referenceId?: number }) =>
        issue.code === 'ACCUMULATOR_CONCEPT_NAME_MISMATCH' && issue.referenceId === 445,
    );
    expect(accumulatorNameMismatch).toEqual([]);
  });

  it('no valida la hoja Acumuladores porque no contiene formulas auditables', async () => {
    const buffer = await createWorkbookFixture({
      incompleteAccumulator: true,
      pdfFunctionalIssues: true,
      repeatedConceptNameForAccumulator: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'acumuladores-fuera-de-alcance.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const accumulatorIssues = response.body.issues.filter(
      (issue: { category?: string; entityType?: string; code?: string }) =>
        issue.category === 'ACCUMULATORS' ||
        issue.entityType === 'ACCUMULATOR' ||
        issue.code === 'INVALID_ACCUMULATOR_ROW' ||
        issue.code === 'MISSING_ACCUMULATOR_ID' ||
        issue.code === 'ACCUMULATOR_CONCEPT_NAME_MISMATCH' ||
        issue.code === 'ACCUMULATOR_CONTRADICTORY_OPERATION',
    );

    expect(accumulatorIssues).toEqual([]);
    expect(response.body.summary.accumulatorsAnalyzed).toBe(0);
  });

  it('no marca N/I como referencias faltantes porque son novedades externas al Excel', async () => {
    const buffer = await createWorkbookFixture({
      externalNoveltyReferences: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'novedades-externas.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const missingNoveltyReferences = response.body.issues.filter(
      (issue: { code?: string; referenceType?: string }) =>
        issue.code === 'MISSING_CONCEPT_REFERENCE' && ['N', 'I'].includes(issue.referenceType ?? ''),
    );
    expect(missingNoveltyReferences).toEqual([]);
  });

  it('emite una sola vez la misma referencia faltante dentro de una celda', async () => {
    const buffer = await createWorkbookFixture({
      repeatedMissingReference: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'referencia-repetida.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const repeatedReferenceIssues = response.body.issues.filter(
      (issue: { code?: string; cell?: string; invalidFragment?: string }) =>
        issue.code === 'MISSING_CONCEPT_REFERENCE' &&
        issue.cell === 'F4' &&
        issue.invalidFragment === 'U[999]',
    );
    expect(repeatedReferenceIssues).toHaveLength(1);
  });

  it('consolida en el reporte Excel los mismos errores encontrados en varias columnas', async () => {
    const buffer = await createWorkbookFixture({
      sameMissingReferenceAcrossColumns: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'columnas-repetidas.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const issueReport = await request(app)
      .get(`/api/validations/${response.body.id}/export/issues-xlsx`)
      .buffer(true)
      .parse(parseBinaryResponse)
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(issueReport.body);

    const sheet = workbook.getWorksheet('Errores detectados');
    const rows = sheet
      ? sheet
          .getRows(2, sheet.rowCount - 1)
          ?.filter((row) => String(row.getCell(8).value ?? '').includes('A[6]')) ?? []
      : [];

    expect(rows).toHaveLength(1);
    expect(rows[0].getCell(3).value).toBe('Conceptos y Formulas (1) > Columnas F y J > Fila 3');
    expect(rows[0].getCell(5).value).toBe('F y J');
  });

  it('consolida en el reporte Excel varias referencias faltantes de una misma formula', async () => {
    const buffer = await createWorkbookFixture({
      multipleMissingReferencesInOneFormula: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'referencias-multiples.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const issueReport = await request(app)
      .get(`/api/validations/${response.body.id}/export/issues-xlsx`)
      .buffer(true)
      .parse(parseBinaryResponse)
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(issueReport.body);

    const sheet = workbook.getWorksheet('Errores detectados');
    const rows = sheet
      ? sheet
          .getRows(2, sheet.rowCount - 1)
          ?.filter(
            (row) =>
              row.getCell(2).value === 'Referencias no encontradas' &&
              String(row.getCell(7).value ?? '').includes('MULTIPLES REFERENCIAS'),
          ) ?? []
      : [];

    expect(rows).toHaveLength(1);
    expect(rows[0].getCell(3).value).toBe('Conceptos y Formulas (1) > Columna F > Fila 4');
    expect(rows[0].getCell(5).value).toBe('F');
    expect(String(rows[0].getCell(8).value)).toContain('R[991]');
    expect(String(rows[0].getCell(8).value)).toContain('R[992]');
    expect(String(rows[0].getCell(8).value)).toContain('R[993]');
  });

  it('no marca texto de Pre/Post Formula como formula invalida', async () => {
    const buffer = await createWorkbookFixture({
      pdfFunctionalIssues: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'rutina-pre-formula.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const routineTextIssues = response.body.issues.filter(
      (issue: { code?: string; cell?: string }) =>
        issue.code === 'FORMULA_TEXT_IN_CALCULATION_COLUMN' && issue.cell === 'N3',
    );
    expect(routineTextIssues).toEqual([]);
  });

  it('no marca valor cero como dato incompatible en auxiliar acumulador', async () => {
    const buffer = await createWorkbookFixture({
      accumulatorAuxiliaryWithZeroValue: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'auxiliar-acumulador-cero.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const auxiliaryZeroIssues = response.body.issues.filter(
      (issue: { code?: string; entityId?: number }) =>
        (issue.code === 'AUXILIARY_ACCUMULATOR_HAS_FORMULA' || issue.code === 'SCHEMA_DRIFT') && issue.entityId === 60,
    );
    expect(auxiliaryZeroIssues).toEqual([]);
  });

  it('no cruza Cod de auxiliares con numero de acumuladores', async () => {
    const buffer = await createWorkbookFixture({
      pdfFunctionalIssues: true,
    });
    const response = await request(app)
      .post('/api/validations')
      .attach('file', buffer, {
        filename: 'codigos-independientes.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);

    const crossedCodeIssues = response.body.issues.filter(
      (issue: { code?: string }) => issue.code === 'AUXILIARY_FORMULA_HAS_ACCUMULATOR_COMPONENTS',
    );
    expect(crossedCodeIssues).toEqual([]);
  });

  it('analiza el archivo real de referencia y permite descargas', async () => {
    const reference = path.resolve(__dirname, '../../referencias/Formulas.Comercio.xlsx');
    const response = await request(app)
      .post('/api/validations')
      .attach('file', reference)
      .expect(201);

    expect(response.body.summary.status).toBe('BLOCKED');
    expect(response.body.summary.conceptsAnalyzed).toBeGreaterThan(600);
    expect(response.body.issues.some((issue: { invalidFragment?: string }) => issue.invalidFragment === 'A[6]')).toBe(true);
    expect(response.body.issues.some((issue: { title?: string }) => issue.title === 'Auxiliar sin referencias')).toBe(false);
    expect(response.body.issues.some((issue: { code?: string }) => issue.code === 'CALCULATION_ORDER_CONFLICT')).toBe(false);

    const id = response.body.id;
    await request(app).get(`/api/validations/${id}`).expect(200);
    await request(app).get(`/api/validations/${id}/export/xlsx`).expect(200);
    await request(app).get(`/api/validations/${id}/export/issues-xlsx`).expect(200);
  }, 120000);
});
