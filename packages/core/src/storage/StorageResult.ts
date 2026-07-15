import { StorageMetadata } from "./StorageMetadata";

export interface StorageResult {
  readonly objectId: string;
  readonly bucketId: string;
  readonly metadata: StorageMetadata;
}
