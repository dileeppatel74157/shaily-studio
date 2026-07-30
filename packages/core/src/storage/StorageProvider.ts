import { StorageBucket } from "./StorageBucket";
import { StorageObject } from "./StorageObject";
import { StorageQuery } from "./StorageQuery";
import { StorageResult } from "./StorageResult";
import { StorageValidationException } from "./types";
import * as fs from "fs";
import * as path from "path";

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

export class FileSystemStorageProvider implements StorageProvider {
  public readonly name = "file-system";
  private readonly _rootDir: string;
  private readonly _buckets = new Map<string, StorageBucket>();

  constructor(rootDir?: string) {
    this._rootDir = rootDir || path.join(process.cwd(), "storage");
    if (!fs.existsSync(this._rootDir)) {
      fs.mkdirSync(this._rootDir, { recursive: true });
    }
    this._loadBuckets();
  }

  private _loadBuckets(): void {
    try {
      const items = fs.readdirSync(this._rootDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const bucketId = item.name;
          const bucketPath = path.join(this._rootDir, bucketId);
          let name = bucketId;
          let description = "";
          const metaFile = path.join(bucketPath, ".bucket-metadata.json");
          if (fs.existsSync(metaFile)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
              name = meta.name || name;
              description = meta.description || "";
            } catch (e) {}
          }
          this._buckets.set(bucketId, { id: bucketId, name, description, created: new Date() });
        }
      }
    } catch (e) {}
  }

  public async createBucket(bucket: StorageBucket): Promise<void> {
    if (this._buckets.has(bucket.id)) {
      throw new StorageValidationException(`Bucket with ID "${bucket.id}" already exists`);
    }
    const bucketPath = path.join(this._rootDir, bucket.id);
    if (!fs.existsSync(bucketPath)) {
      fs.mkdirSync(bucketPath, { recursive: true });
    }
    const metaFile = path.join(bucketPath, ".bucket-metadata.json");
    fs.writeFileSync(metaFile, JSON.stringify(bucket, null, 2), "utf-8");

    this._buckets.set(bucket.id, bucket);
  }

  public async deleteBucket(bucketId: string): Promise<void> {
    if (!this._buckets.has(bucketId)) {
      throw new StorageValidationException(`Bucket with ID "${bucketId}" does not exist`);
    }
    const bucketPath = path.join(this._rootDir, bucketId);
    if (fs.existsSync(bucketPath)) {
      fs.rmSync(bucketPath, { recursive: true, force: true });
    }
    this._buckets.delete(bucketId);
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
    const bucketPath = path.join(this._rootDir, bucketId);
    const objectPath = path.join(bucketPath, object.id);

    const objectDir = path.dirname(objectPath);
    if (!fs.existsSync(objectDir)) {
      fs.mkdirSync(objectDir, { recursive: true });
    }

    const content = typeof object.content === "string" ? object.content : Buffer.from(object.content);
    fs.writeFileSync(objectPath, content);

    const metaPath = objectPath + ".metadata.json";
    const metadata = {
      id: object.id,
      bucketId: object.bucketId,
      metadata: object.metadata,
      sizeBytes: content.length,
      mimeType: object.metadata.mimeType
    };
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf-8");
  }

  public getObject(bucketId: string, objectId: string): StorageObject | undefined {
    if (!this._buckets.has(bucketId)) {
      throw new StorageValidationException(`Bucket with ID "${bucketId}" does not exist`);
    }
    const bucketPath = path.join(this._rootDir, bucketId);
    const objectPath = path.join(bucketPath, objectId);

    if (!fs.existsSync(objectPath)) {
      return undefined;
    }

    const content = fs.readFileSync(objectPath);
    let metadata: any = {
      mimeType: "application/octet-stream",
      created: new Date(),
      updated: new Date()
    };

    const metaPath = objectPath + ".metadata.json";
    if (fs.existsSync(metaPath)) {
      try {
        const stored = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        metadata = stored.metadata || metadata;
        if (metadata.created) metadata.created = new Date(metadata.created);
        if (metadata.updated) metadata.updated = new Date(metadata.updated);
      } catch (e) {}
    }

    return {
      id: objectId,
      bucketId,
      content: content,
      metadata
    };
  }

  public async deleteObject(bucketId: string, objectId: string): Promise<void> {
    if (!this._buckets.has(bucketId)) {
      throw new StorageValidationException(`Bucket with ID "${bucketId}" does not exist`);
    }
    const bucketPath = path.join(this._rootDir, bucketId);
    const objectPath = path.join(bucketPath, objectId);

    if (!fs.existsSync(objectPath)) {
      throw new StorageValidationException(`Object with ID "${objectId}" does not exist inside bucket "${bucketId}"`);
    }

    fs.rmSync(objectPath, { force: true });
    const metaPath = objectPath + ".metadata.json";
    if (fs.existsSync(metaPath)) {
      fs.rmSync(metaPath, { force: true });
    }
  }

  public listObjects(bucketId: string, query?: StorageQuery): readonly StorageResult[] {
    if (!this._buckets.has(bucketId)) {
      throw new StorageValidationException(`Bucket with ID "${bucketId}" does not exist`);
    }
    const bucketPath = path.join(this._rootDir, bucketId);
    const results: StorageResult[] = [];

    const recurse = (dir: string) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          recurse(fullPath);
        } else if (item.isFile() && !item.name.endsWith(".metadata.json") && !item.name.startsWith(".bucket-metadata")) {
          const relativeId = path.relative(bucketPath, fullPath).replace(/\\/g, "/");

          let metadata: any = {
            mimeType: "application/octet-stream",
            created: new Date(),
            updated: new Date()
          };
          const metaPath = fullPath + ".metadata.json";
          if (fs.existsSync(metaPath)) {
            try {
              const stored = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
              metadata = stored.metadata || metadata;
              if (metadata.created) metadata.created = new Date(metadata.created);
              if (metadata.updated) metadata.updated = new Date(metadata.updated);
            } catch (e) {}
          }

          results.push({
            objectId: relativeId,
            bucketId,
            metadata
          });
        }
      }
    };

    if (fs.existsSync(bucketPath)) {
      recurse(bucketPath);
    }

    let filtered = results;
    if (query) {
      if (query.prefix) {
        filtered = filtered.filter((o) => o.objectId.startsWith(query.prefix!));
      }
      if (query.tags && query.tags.length > 0) {
        filtered = filtered.filter((o) => {
          const tags = o.metadata.tags || [];
          return query.tags!.every((t) => tags.includes(t));
        });
      }
      if (query.createdBefore) {
        filtered = filtered.filter((o) => o.metadata.created.getTime() < query.createdBefore!.getTime());
      }
      if (query.createdAfter) {
        filtered = filtered.filter((o) => o.metadata.created.getTime() > query.createdAfter!.getTime());
      }
      if (query.metadata) {
        filtered = filtered.filter((o) => {
          const custom = o.metadata.custom || {};
          return Object.keys(query.metadata!).every(
            (k) => custom[k] === query.metadata![k]
          );
        });
      }
    }

    filtered.sort((a, b) => a.objectId.localeCompare(b.objectId));
    return filtered;
  }
}
