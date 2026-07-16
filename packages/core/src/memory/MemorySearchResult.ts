import { MemoryEntry } from "./MemoryEntry";

export interface MemorySearchResult {
  readonly entry: MemoryEntry;
  readonly score: number;
}
