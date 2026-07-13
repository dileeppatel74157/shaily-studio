import { MemoryEntry } from "./MemoryEntry";
import { MemorySnapshot } from "./MemorySnapshot";

export interface IMemoryStore {
  set<T = any>(
    namespace: string,
    key: string,
    value: T,
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry<T>>;

  get<T = any>(namespace: string, key: string): Promise<MemoryEntry<T> | undefined>;

  has(namespace: string, key: string): Promise<boolean>;

  delete(namespace: string, key: string): Promise<boolean>;

  clear(namespace?: string): Promise<void>;

  keys(namespace?: string): Promise<string[]>;

  entries(namespace?: string): Promise<[string, MemoryEntry][]>;

  snapshot(): Promise<MemorySnapshot>;
}
