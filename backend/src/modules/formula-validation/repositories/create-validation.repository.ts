import { appConfig } from '../../../config/app-config';
import { InMemoryValidationRepository } from './in-memory-validation.repository';
import { MongoValidationRepository } from './mongo-validation.repository';
import { ValidationRepository } from './validation.repository';

export const createValidationRepository = (): ValidationRepository => {
  if (appConfig.mongo.enabled) {
    return new MongoValidationRepository();
  }
  return new InMemoryValidationRepository();
};
