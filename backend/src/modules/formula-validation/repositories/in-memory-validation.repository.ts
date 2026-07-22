import { appConfig } from '../../../config/app-config';
import { StoredValidationResult, ValidationHistoryItem } from '../types/validation.types';
import { ValidationRepository } from './validation.repository';

export class InMemoryValidationRepository implements ValidationRepository {
  private readonly results = new Map<string, StoredValidationResult>();

  async save(result: StoredValidationResult): Promise<StoredValidationResult> {
    await this.deleteExpired();
    this.results.set(result.id, result);
    return result;
  }

  async findById(id: string): Promise<StoredValidationResult | undefined> {
    await this.deleteExpired();
    return this.results.get(id);
  }

  async list(): Promise<ValidationHistoryItem[]> {
    await this.deleteExpired();
    return [...this.results.values()]
      .map(({ sourceBuffer: _sourceBuffer, issues: _issues, ...historyItem }) => historyItem)
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  }

  async deleteById(id: string): Promise<boolean> {
    await this.deleteExpired();
    return this.results.delete(id);
  }

  async deleteExpired(now = new Date()): Promise<void> {
    const nowMs = now.getTime();
    this.results.forEach((result, id) => {
      const expiresAt = new Date(result.expiresAt).getTime();
      if (Number.isFinite(expiresAt) && expiresAt <= nowMs) {
        this.results.delete(id);
      }
    });
  }

  expiresAt(from = new Date()): string {
    return new Date(from.getTime() + appConfig.validationTtlMs).toISOString();
  }
}
