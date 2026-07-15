import { StorageBucket } from "./StorageBucket";
import { StorageObject } from "./StorageObject";
import { StorageQuery } from "./StorageQuery";
import { StorageResult } from "./StorageResult";
import { StorageValidationException } from "./types";

export interface StorageProvider {
  readonly name: string;
  createBucket(bucket: StorageBucket): Promise<void>;
  deleteBucket(bucketId: string): Promise<void>;
  hasBucket(bucketId: string): boolean;
  getBucket(bucketId: string): StorageBucket | undefined;
  listBuckets(): readonly StorageBucket[];
  putObject(bucketId: string, object: StorageObject): Promise<void>;
  getObject(bucketId: string, objectId: string): StorageObject | undefined;
  deleteObject(bucketId: string, objectId: string): Promise<void>;
  listObjects(bucketId: string, query?: StorageQuery): readonly StorageResult[];
}

export class InMemoryStorageProvider implements StorageProvider {
  public readonly name = "in-memory";
  private readonly _buckets = new Map<string, StorageBucket>();
  private readonly _objects = new Map<string, Map<string, StorageObject>>();

  public async createBucket(bucket: StorageBucket): Promise<void> {
    if (this._buckets.has(bucket.id)) {
      throw new StorageValidationException(`Bucket with ID "${bucket.id}" already exists`);
    }
    this._buckets.set(bucket.id, bucket);
    this._objects.set(bucket.id, new Map<string, StorageObject>());
  }

  public async deleteBucket(bucketId: string): Promise<void> {
    if (!this._buckets.has(bucketId)) {
      throw new StorageValidationException(`Bucket with ID "${bucketId}" does not exist`);
    }
    this._buckets.delete(bucketId);
    this._objects.delete(bucketId);
  }

  public hasBucket(bucketId: string): boolean {
    return this._buckets.has(bucketId);
  }

  public getBucket(bucketId: string): StorageBucket | undefined {
    return this._buckets.get(bucketId);
  }

  public listBuckets(): readonly StorageBucket[] {
    return Array.from(this._buckets.values());
  }

  public async putObject(bucketId: string, object: StorageObject): Promise<void> {
    if (!this._buckets.has(bucketId)) {
      throw new StorageValidationException(`Bucket with ID "${bucketId}" does not exist`);
    }
    const bucketObjects = this._objects.get(bucketId)!;
    if (bucketObjects.has(object.id)) {
      throw new StorageValidationException(`Object with ID "${object.id}" already exists inside bucket "${bucketId}"`);
    }
    bucketObjects.set(object.id, object);
  }

  public getObject(bucketId: string, objectId: string): StorageObject | undefined {
    if (!this._buckets.has(bucketId)) {
      throw new StorageValidationException(`Bucket with ID "${bucketId}" does not exist`);
    }
    return this._objects.get(bucketId)?.get(objectId);
  }

  public async deleteObject(bucketId: string, objectId: string): Promise<void> {
    if (!this._buckets.has(bucketId)) {
      throw new StorageValidationException(`Bucket with ID "${bucketId}" does not exist`);
    }
    const bucketObjects = this._objects.get(bucketId)!;
    if (!bucketObjects.has(objectId)) {
      throw new StorageValidationException(`Object with ID "${objectId}" does not exist inside bucket "${bucketId}"`);
    }
    bucketObjects.delete(objectId);
  }

  public listObjects(bucketId: string, query?: StorageQuery): readonly StorageResult[] {
    if (!this._buckets.has(bucketId)) {
      throw new StorageValidationException(`Bucket with ID "${bucketId}" does not exist`);
    }
    const bucketObjects = this._objects.get(bucketId)!;
    let list = Array.from(bucketObjects.values());

    if (query) {
      if (query.prefix) {
        list = list.filter((o) => o.id.startsWith(query.prefix!));
      }
      if (query.tags && query.tags.length > 0) {
        list = list.filter((o) => {
          const tags = o.metadata.tags || [];
          return query.tags!.every((t) => tags.includes(t));
        });
      }
      if (query.createdBefore) {
        list = list.filter((o) => o.metadata.created.getTime() < query.createdBefore!.getTime());
      }
      if (query.createdAfter) {
        list = list.filter((o) => o.metadata.created.getTime() > query.createdAfter!.getTime());
      }
      if (query.metadata) {
        list = list.filter((o) => {
          const custom = o.metadata.custom || {};
          return Object.keys(query.metadata!).every(
            (k) => custom[k] === query.metadata![k]
          );
        });
      }
    }

    list.sort((a, b) => a.id.localeCompare(b.id));

    return list.map((o) => ({
      objectId: o.id,
      bucketId: o.bucketId,
      metadata: o.metadata,
    }));
  }

  public getObjectsCount(): number {
    let count = 0;
    this._objects.forEach((bucketMap) => {
      count += bucketMap.size;
    });
    return count;
  }
}
