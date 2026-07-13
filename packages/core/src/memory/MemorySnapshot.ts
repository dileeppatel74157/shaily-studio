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
  readonly totalEntriesCount: number;
  readonly namespaceCount: number;
  readonly namespaces: ReadonlyArray<string>;
  readonly entries: ReadonlyArray<MemoryEntryMetadataSnapshot>;
}
