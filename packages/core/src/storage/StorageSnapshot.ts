import { StorageBucket } from "./StorageBucket";

export interface StorageSnapshot {
  readonly timestamp: Date;
  readonly buckets: readonly StorageBucket[];
  readonly objectsCount: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}
