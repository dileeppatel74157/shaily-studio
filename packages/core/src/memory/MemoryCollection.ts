import { MemoryNamespace } from "./MemoryNamespace";
import { MemoryEntry } from "./MemoryEntry";

export class MemoryCollection {
  private readonly _namespaces = new Map<string, MemoryNamespace>();

  public getNamespace(name: string): MemoryNamespace {
    let ns = this._namespaces.get(name);
    if (!ns) {
      ns = new MemoryNamespace(name);
      this._namespaces.set(name, ns);
    }
    return ns;
  }

  public hasNamespace(name: string): boolean {
    return this._namespaces.has(name);
  }

  public deleteNamespace(name: string): boolean {
    return this._namespaces.delete(name);
  }

  public clear(): void {
    this._namespaces.clear();
  }

  public getNamespaces(): string[] {
    return Array.from(this._namespaces.keys());
  }

  public getAllEntriesCount(): number {
    let count = 0;
    for (const ns of this._namespaces.values()) {
      count += ns.size;
    }
    return count;
  }

  public getAllEntries(): MemoryEntry[] {
    const list: MemoryEntry[] = [];
    for (const ns of this._namespaces.values()) {
      for (const [, entry] of ns.entries()) {
        list.push(entry);
      }
    }
    return list;
  }
}
