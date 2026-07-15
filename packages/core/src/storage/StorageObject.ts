import { StorageMetadata } from "./StorageMetadata";

export interface StorageObject {
  readonly id: string;
  readonly bucketId: string;
  readonly content: Uint8Array | string;
  readonly metadata: StorageMetadata;
}
