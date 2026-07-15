import { StorageBucket } from "./StorageBucket";
import { StorageObject } from "./StorageObject";
import { StorageQuery } from "./StorageQuery";
import { StorageResult } from "./StorageResult";
import { StorageSnapshot } from "./StorageSnapshot";

export interface IStorage {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  createBucket(bucket: StorageBucket): Promise<void>;
  deleteBucket(bucketId: string): Promise<void>;

  hasBucket(bucketId: string): boolean;
  getBucket(bucketId: string): StorageBucket | undefined;
  listBuckets(): readonly StorageBucket[];

  putObject(bucketId: string, object: StorageObject): Promise<void>;

  getObject(bucketId: string, objectId: string): StorageObject | undefined;

  deleteObject(bucketId: string, objectId: string): Promise<void>;

  listObjects(bucketId: string, query?: StorageQuery): readonly StorageResult[];

  snapshot(): StorageSnapshot;
}
