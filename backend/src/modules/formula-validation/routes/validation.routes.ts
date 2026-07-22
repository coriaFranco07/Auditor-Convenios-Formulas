import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { appConfig } from '../../../config/app-config';
import { ValidationController } from '../controllers/validation.controller';

const allowedMimes = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

export const createValidationRouter = (controller: ValidationController): Router => {
  fs.mkdirSync(appConfig.uploadDir, { recursive: true });
  const upload = multer({
    dest: appConfig.uploadDir,
    limits: { fileSize: appConfig.maxUploadBytes, files: 1 },
    fileFilter: (_request, file, callback) => {
      const validExtension = file.originalname.toLowerCase().endsWith('.xlsx');
      const validMime = allowedMimes.has(file.mimetype);
      if (!validExtension || !validMime) {
        callback(new Error('Solo se aceptan archivos .xlsx validos.'));
        return;
      }
      callback(null, true);
    },
  });

  const router = Router();
  router.post('/', upload.single('file'), controller.analyze);
  router.post('/:validationId/issues/:issueId/explain', controller.explainIssue);
  router.get('/', controller.list);
  router.get('/:validationId', controller.get);
  router.get('/:validationId/export/json', controller.exportJson);
  router.get('/:validationId/export/csv', controller.exportCsv);
  router.get('/:validationId/export/xlsx', controller.exportXlsx);
  router.get('/:validationId/export/issues-xlsx', controller.exportIssueReportXlsx);
  router.delete('/:validationId', controller.delete);
  return router;
};
