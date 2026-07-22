import { Binary, Collection, MongoClient, WithId } from 'mongodb';
import { appConfig } from '../../../config/app-config';
import { StoredValidationResult, ValidationHistoryItem } from '../types/validation.types';
import { ValidationRepository } from './validation.repository';

interface MongoValidationDocument extends Omit<StoredValidationResult, 'sourceBuffer'> {
  _id: string;
  sourceBuffer?: Binary;
}

export class MongoValidationRepository implements ValidationRepository {
  private readonly client: MongoClient;
  private collectionPromise?: Promise<Collection<MongoValidationDocument>>;

  constructor(
    private readonly uri = appConfig.mongo.uri,
    private readonly databaseName = appConfig.mongo.database,
    private readonly collectionName = appConfig.mongo.collection,
  ) {
    if (!uri) {
      throw new Error('MONGO_URI no esta configurado.');
    }
    this.client = new MongoClient(uri);
  }

  async save(result: StoredValidationResult): Promise<StoredValidationResult> {
    await this.deleteExpired();
    const collection = await this.collection();
    const { sourceBuffer, ...document } = result;
    await collection.updateOne(
      { _id: result.id },
      {
        $set: {
          ...document,
          _id: result.id,
          ...(sourceBuffer ? { sourceBuffer: new Binary(sourceBuffer) } : {}),
        },
      },
      { upsert: true },
    );
    return result;
  }

  async list(): Promise<ValidationHistoryItem[]> {
    await this.deleteExpired();
    const collection = await this.collection();
    return collection
      .find(
        {},
        {
          projection: {
            _id: 0,
            id: 1,
            fileName: 1,
            summary: 1,
            createdAt: 1,
            expiresAt: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray() as Promise<ValidationHistoryItem[]>;
  }

  async findById(id: string): Promise<StoredValidationResult | undefined> {
    await this.deleteExpired();
    const collection = await this.collection();
    const document = await collection.findOne({ _id: id });
    return document ? this.toStoredResult(document) : undefined;
  }

  async deleteById(id: string): Promise<boolean> {
    const collection = await this.collection();
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async deleteExpired(now = new Date()): Promise<void> {
    const collection = await this.collection();
    await collection.deleteMany({ expiresAt: { $lte: now.toISOString() } });
  }

  expiresAt(from = new Date()): string {
    return new Date(from.getTime() + appConfig.validationTtlMs).toISOString();
  }

  private async collection(): Promise<Collection<MongoValidationDocument>> {
    if (!this.collectionPromise) {
      this.collectionPromise = this.openCollection();
    }
    return this.collectionPromise;
  }

  private async openCollection(): Promise<Collection<MongoValidationDocument>> {
    await this.client.connect();
    const collection = this.client.db(this.databaseName).collection<MongoValidationDocument>(this.collectionName);
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ expiresAt: 1 });
    return collection;
  }

  private toStoredResult(document: WithId<MongoValidationDocument>): StoredValidationResult {
    const { _id: _documentId, sourceBuffer, ...result } = document;
    return {
      ...result,
      sourceBuffer: sourceBuffer ? Buffer.from(sourceBuffer.buffer) : undefined,
    };
  }
}
