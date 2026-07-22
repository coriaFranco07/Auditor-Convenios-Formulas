import { StoredValidationResult, ValidationHistoryItem } from '../types/validation.types';

export interface ValidationRepository {
  save(result: StoredValidationResult): Promise<StoredValidationResult>;
  list(): Promise<ValidationHistoryItem[]>;
  findById(id: string): Promise<StoredValidationResult | undefined>;
  deleteById(id: string): Promise<boolean>;
  deleteExpired(now?: Date): Promise<void>;
  expiresAt(from?: Date): string;
}
