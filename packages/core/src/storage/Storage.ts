import { IStorage } from "./IStorage";
import { StorageBucket } from "./StorageBucket";
import { StorageObject } from "./StorageObject";
import { StorageQuery } from "./StorageQuery";
import { StorageResult } from "./StorageResult";
import { StorageSnapshot } from "./StorageSnapshot";
import { StorageContext } from "./StorageContext";
import { StorageProvider } from "./StorageProvider";
import { StorageValidator } from "./StorageValidator";
import { StorageState } from "./StorageState";
import {
  StorageValidationException,
  InvalidStorageStateException,
  deepFreeze,
} from "./types";

export class Storage implements IStorage {
  private readonly _context: StorageContext;
  private readonly _provider: StorageProvider;
  private readonly _metadata: Readonly<Record<string, unknown>>;
  private _state: StorageState = StorageState.CREATED;

  constructor(
    context: StorageContext,
    provider: StorageProvider,
    metadata?: Record<string, unknown>
  ) {
    StorageValidator.validateContext(context);
    if (!provider) {
      throw new StorageValidationException("StorageProvider is required");
    }
    this._context = context;
    this._provider = provider;
    this._metadata = metadata ? { ...metadata } : {};
  }

  public async initialize(): Promise<void> {
    if (this._state !== StorageState.CREATED) {
      throw new InvalidStorageStateException("initialize", this._state);
    }
    try {
      this._state = StorageState.READY;
    } catch (err) {
      this._state = StorageState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== StorageState.READY) {
      throw new InvalidStorageStateException("start", this._state);
    }
    try {
      this._state = StorageState.RUNNING;
    } catch (err) {
      this._state = StorageState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("stop", this._state);
    }
    try {
      this._state = StorageState.STOPPED;
    } catch (err) {
      this._state = StorageState.FAILED;
      throw err;
    }
  }

  public async createBucket(bucket: StorageBucket): Promise<void> {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("createBucket", this._state);
    }
    StorageValidator.validateBucket(bucket);
    await this._provider.createBucket(bucket);
  }

  public async deleteBucket(bucketId: string): Promise<void> {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("deleteBucket", this._state);
    }
    StorageValidator.validateIdentifier(bucketId, "Bucket ID");
    await this._provider.deleteBucket(bucketId);
  }

  public hasBucket(bucketId: string): boolean {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("hasBucket", this._state);
    }
    StorageValidator.validateIdentifier(bucketId, "Bucket ID");
    return this._provider.hasBucket(bucketId);
  }

  public getBucket(bucketId: string): StorageBucket | undefined {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("getBucket", this._state);
    }
    StorageValidator.validateIdentifier(bucketId, "Bucket ID");
    const bucket = this._provider.getBucket(bucketId);
    return bucket ? deepFreeze(bucket) : undefined;
  }

  public listBuckets(): readonly StorageBucket[] {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("listBuckets", this._state);
    }
    const buckets = this._provider.listBuckets();
    return deepFreeze(buckets);
  }

  public async putObject(bucketId: string, object: StorageObject): Promise<void> {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("putObject", this._state);
    }
    StorageValidator.validateIdentifier(bucketId, "Bucket ID");
    StorageValidator.validateObject(object);
    if (object.bucketId !== bucketId) {
      throw new StorageValidationException(
        `Object bucketId "${object.bucketId}" does not match target bucketId "${bucketId}"`
      );
    }
    await this._provider.putObject(bucketId, object);
  }

  public getObject(bucketId: string, objectId: string): StorageObject | undefined {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("getObject", this._state);
    }
    StorageValidator.validateIdentifier(bucketId, "Bucket ID");
    StorageValidator.validateIdentifier(objectId, "Object ID");
    const obj = this._provider.getObject(bucketId, objectId);
    return obj ? deepFreeze(obj) : undefined;
  }

  public async deleteObject(bucketId: string, objectId: string): Promise<void> {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("deleteObject", this._state);
    }
    StorageValidator.validateIdentifier(bucketId, "Bucket ID");
    StorageValidator.validateIdentifier(objectId, "Object ID");
    await this._provider.deleteObject(bucketId, objectId);
  }

  public listObjects(bucketId: string, query?: StorageQuery): readonly StorageResult[] {
    if (this._state !== StorageState.RUNNING) {
      throw new InvalidStorageStateException("listObjects", this._state);
    }
    StorageValidator.validateIdentifier(bucketId, "Bucket ID");
    const list = this._provider.listObjects(bucketId, query);
    return deepFreeze(list);
  }

  public snapshot(): StorageSnapshot {
    if (this._state !== StorageState.RUNNING && this._state !== StorageState.STOPPED) {
      throw new InvalidStorageStateException("snapshot", this._state);
    }

    const buckets = this._provider.listBuckets();
    const count = typeof (this._provider as any).getObjectsCount === "function" 
      ? (this._provider as any).getObjectsCount() 
      : 0;

    const snapshotObj: StorageSnapshot = {
      timestamp: new Date(),
      buckets,
      objectsCount: count,
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return deepFreeze(snapshotObj);
  }
}
