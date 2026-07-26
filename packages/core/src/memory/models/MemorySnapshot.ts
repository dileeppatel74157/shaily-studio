import { MemoryState } from "./MemoryState";

export interface MemoryEntryMetadataSnapshot {
  readonly key: string;
  readonly namespace: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
}

export interface MemorySnapshot {
  readonly timestamp: Date;
  // Old MemoryStore stats
  readonly totalEntriesCount?: number;
  readonly namespaceCount?: number;
  readonly namespaces?: ReadonlyArray<string>;
  readonly entries?: ReadonlyArray<MemoryEntryMetadataSnapshot>;

  // New MemoryEngine stats
  readonly state?: MemoryState;
  readonly learningCount?: number;
  readonly memoryCount?: number;
  readonly patternCount?: number;
  readonly reflectionCount?: number;
  readonly cacheUsage?: number;
}
