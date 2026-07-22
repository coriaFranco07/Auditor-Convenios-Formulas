import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { createValidationRepository } from './modules/formula-validation/repositories/create-validation.repository';
import { ValidationController } from './modules/formula-validation/controllers/validation.controller';
import { ValidationService } from './modules/formula-validation/services/validation.service';
import { createValidationRouter } from './modules/formula-validation/routes/validation.routes';

export const createApp = (): express.Express => {
  const app = express();
  const repository = createValidationRepository();
  const service = new ValidationService(repository);
  const controller = new ValidationController(service);

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      version: '0.1.0',
      node: process.version,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/validations', createValidationRouter(controller));

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const message = error instanceof Error ? error.message : 'Error inesperado.';
    const status = message.includes('Solo se aceptan') || message.includes('File too large') ? 400 : 500;
    response.status(status).json({ message });
  };
  app.use(errorHandler);

  return app;
};
