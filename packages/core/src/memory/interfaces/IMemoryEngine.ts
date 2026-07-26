import { MemoryEntry } from "../models/MemoryEntry";
import { MemorySearch } from "../models/MemorySearch";
import { MemorySearchResult } from "../models/MemorySearchResult";
import { MemorySnapshot } from "../models/MemorySnapshot";
import { LearningRecord } from "../models/LearningRecord";
import { LearningPattern } from "../models/LearningPattern";
import { Reflection } from "../models/Reflection";

export interface IMemoryEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  store(
    entry: Omit<MemoryEntry, "id" | "timestamp" | "value" | "createdAt" | "updatedAt" | "version">
  ): Promise<MemoryEntry>;
  update(id: string, entry: Partial<MemoryEntry>): Promise<MemoryEntry>;
  delete(id: string): Promise<boolean>;

  search(criteria: MemorySearch): Promise<ReadonlyArray<MemorySearchResult>>;
  retrieve(id: string): Promise<MemoryEntry | undefined>;
  summarize(scope: string): Promise<string>;

  reflect(executionId: string, output: unknown): Promise<Reflection>;
  learn(sourceId: string, details: Record<string, unknown>): Promise<LearningRecord>;

  snapshot(): MemorySnapshot;
}
