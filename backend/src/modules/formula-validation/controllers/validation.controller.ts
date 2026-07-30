import fs from 'node:fs/promises';
import path from 'node:path';
import { Request, Response } from 'express';
import { exportCsv } from '../exporters/csv.exporter';
import { exportIssueReportXlsx as buildIssueReportXlsx } from '../exporters/issue-report-xlsx.exporter';
import { exportJson } from '../exporters/json.exporter';
import { exportMarkedXlsx } from '../exporters/marked-xlsx.exporter';
import { ValidationService } from '../services/validation.service';

export class ValidationController {
  constructor(private readonly service: ValidationService) {}

  analyze = async (request: Request, response: Response): Promise<void> => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: 'El campo file es obligatorio.' });
      return;
    }

    try {
      const result = await this.service.analyze(file.path, file.originalname);
      response.status(result.summary.status === 'FAILED' ? 400 : 201).json(this.service.publicResult(result));
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  };

  get = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.get(request.params.validationId);
    if (!result) {
      response.status(404).json({ message: 'Resultado no encontrado o expirado.' });
      return;
    }
    response.json(this.service.publicResult(result));
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    response.json(await this.service.list());
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const deleted = await this.service.delete(request.params.validationId);
    if (!deleted) {
      response.status(404).json({ message: 'Resultado no encontrado o expirado.' });
      return;
    }
    response.status(204).send();
  };

  explainIssue = async (request: Request, response: Response): Promise<void> => {
    try {
      const issue = await this.service.explainIssue(request.params.validationId, request.params.issueId);
      if (!issue) {
        response.status(404).json({ message: 'Hallazgo no encontrado o resultado expirado.' });
        return;
      }
      response.json(issue);
    } catch (error) {
      response.status(503).json({
        message: error instanceof Error ? error.message : 'No se pudo generar la explicacion con IA.',
      });
    }
  };

  manual = async (request: Request, response: Response): Promise<void> => {
    const manual = await this.service.manual(request.params.validationId);
    if (!manual) {
      response.status(404).json({ message: 'Manual no disponible para este analisis.' });
      return;
    }
    response.json(manual);
  };

  exportJson = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.get(request.params.validationId);
    if (!result) {
      response.status(404).json({ message: 'Resultado no encontrado o expirado.' });
      return;
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.id}.json"`);
    response.send(exportJson(result));
  };

  exportCsv = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.get(request.params.validationId);
    if (!result) {
      response.status(404).json({ message: 'Resultado no encontrado o expirado.' });
      return;
    }
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${result.id}.csv"`);
    response.send(exportCsv(result));
  };

  exportXlsx = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.get(request.params.validationId);
    if (!result) {
      response.status(404).json({ message: 'Resultado no encontrado o expirado.' });
      return;
    }
    const buffer = await exportMarkedXlsx(result);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', `attachment; filename="${result.id}-marcado.xlsx"`);
    response.send(buffer);
  };

  exportIssueReportXlsx = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.get(request.params.validationId);
    if (!result) {
      response.status(404).json({ message: 'Resultado no encontrado o expirado.' });
      return;
    }
    const buffer = await buildIssueReportXlsx(result);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', `attachment; filename="${exportedErrorsFileName(result.fileName)}"`);
    response.send(buffer);
  };
}

const exportedErrorsFileName = (originalFileName: string): string => {
  const parsed = path.parse(originalFileName);
  const baseName = sanitizeFileName(parsed.name || originalFileName.replace(/\.xlsx$/i, '')) || 'Reporte';
  return `${baseName}-Errores.xlsx`;
};

const sanitizeFileName = (value: string): string =>
  Array.from(value)
    .map((character) => (isForbiddenFileNameCharacter(character) ? '-' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();

const isForbiddenFileNameCharacter = (character: string): boolean =>
  character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character);
