import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import { createWorkbookFixture } from './helpers/workbook-fixture';

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
    const buffer = await createWorkbookFixture({ omitVariablesSheet: true });
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

  it('detecta referencias inexistentes, duplicados, tipos y ciclos', async () => {
    const buffer = await createWorkbookFixture({
      missingReference: true,
      duplicateConflict: true,
      invalidCondition: true,
      selfReference: true,
      indirectCycle: true,
      invalidAuxiliary: true,
      incompleteAccumulator: true,
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
    expect(codes).toContain('DUPLICATE_CONFLICT');
    expect(codes).toContain('INVALID_CONDITION_TYPE');
    expect(codes).toContain('SELF_REFERENCE');
    expect(codes).toContain('CIRCULAR_DEPENDENCY');
    expect(codes).toContain('INVALID_AUXILIARY_ROW');
    expect(codes).toContain('INVALID_ACCUMULATOR_ROW');

    const duplicate = response.body.issues.find((issue: { code: string }) => issue.code === 'DUPLICATE_CONFLICT');
    expect(duplicate.message).toBe('CONCEPT 1 aparece 2 veces.');
    expect(duplicate.relatedLocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sheet: 'Conceptos y Formulas (1)', row: 3, cell: 'A3' }),
        expect.objectContaining({ sheet: 'Conceptos y Formulas (1)', row: 4, cell: 'A4' }),
      ]),
    );
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
