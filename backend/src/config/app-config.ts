import path from 'node:path';
import { loadEnvFile } from './env';

loadEnvFile();

const numberFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const appConfig = {
  port: numberFromEnv('PORT', 3000),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'tmp/uploads'),
  maxUploadBytes: numberFromEnv('MAX_UPLOAD_MB', 10) * 1024 * 1024,
  validationTtlMs: numberFromEnv('VALIDATION_TTL_MS', 60 * 60 * 1000),
  mongo: {
    enabled: process.env.NODE_ENV !== 'test' && process.env.MONGO_ENABLED !== 'false' && Boolean(process.env.MONGO_URI),
    uri: process.env.MONGO_URI,
    database: process.env.MONGO_DATABASE ?? 'auditor_formulas',
    collection: process.env.MONGO_COLLECTION ?? 'analyses',
  },
  gemini: {
    enabled: process.env.GEMINI_ENABLED !== 'false' && Boolean(process.env.GEMINI_API_KEY),
    apiKey: process.env.GEMINI_API_KEY,
    endpoint: process.env.GEMINI_API_ENDPOINT ?? 'https://generativelanguage.googleapis.com/v1beta',
    models: (process.env.GEMINI_MODELS ?? 'gemini-3-flash-preview,gemini-3.1-flash-lite,gemini-2.5-flash,gemini-2.5-flash-lite')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean),
    timeoutMs: numberFromEnv('GEMINI_TIMEOUT_MS', 15000),
  },
};
