import { MemoryEntry } from "./MemoryEntry";

export class MemoryNamespace {
  private readonly _entries = new Map<string, MemoryEntry>();

  constructor(public readonly name: string) {}

  public get(key: string): MemoryEntry | undefined {
    return this._entries.get(key);
  }

  public set(key: string, entry: MemoryEntry): void {
    this._entries.set(key, entry);
  }

  public has(key: string): boolean {
    return this._entries.has(key);
  }

  public delete(key: string): boolean {
    return this._entries.delete(key);
  }

  public clear(): void {
    this._entries.clear();
  }

  public keys(): string[] {
    return Array.from(this._entries.keys());
  }

  public entries(): [string, MemoryEntry][] {
    return Array.from(this._entries.entries());
  }

  public get size(): number {
    return this._entries.size;
  }
}
