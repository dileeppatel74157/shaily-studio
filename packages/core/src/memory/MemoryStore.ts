import { IMemoryStore } from "./IMemoryStore";
import { MemoryEntry } from "./MemoryEntry";
import { MemoryCollection } from "./MemoryCollection";
import { MemorySerializer } from "./MemorySerializer";
import { MemoryValidator } from "./MemoryValidator";
import { MemorySnapshot } from "./MemorySnapshot";
import { MemoryEntryBuilder } from "./MemoryEntryBuilder";

export class MemoryStore implements IMemoryStore {
  private readonly _collection = new MemoryCollection();
  private readonly _serializer: MemorySerializer;
  private readonly _validator: MemoryValidator;

  constructor(serializer?: MemorySerializer, validator?: MemoryValidator) {
    this._serializer = serializer ?? new MemorySerializer();
    this._validator = validator ?? new MemoryValidator();
  }

  public async set<T = any>(
    namespace: string,
    key: string,
    value: T,
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry<T>> {
    this._validator.validateNamespace(namespace);
    this._validator.validateKey(key);
    this._validator.validateValue(value);

    // Deep clone and deep freeze inputs to guarantee immutability
    const clonedValue = this._serializer.freeze(this._serializer.clone(value));
    const clonedMeta = this._serializer.freeze(this._serializer.clone(metadata || {}));

    const ns = this._collection.getNamespace(namespace);
    const existing = ns.get(key);

    const version = existing ? existing.version + 1 : 1;
    const createdAt = existing ? existing.createdAt : new Date();
    const updatedAt = new Date();

    const entry = new MemoryEntryBuilder<T>()
      .withKey(key)
      .withNamespace(namespace)
      .withValue(clonedValue)
      .withCreatedAt(createdAt)
      .withUpdatedAt(updatedAt)
      .withVersion(version)
      .withMetadata(clonedMeta)
      .build();

    ns.set(key, entry);
    return entry;
  }

  public async get<T = any>(namespace: string, key: string): Promise<MemoryEntry<T> | undefined> {
    this._validator.validateNamespace(namespace);
    this._validator.validateKey(key);

    const ns = this._collection.getNamespace(namespace);
    const entry = ns.get(key);

    if (!entry) {
      return undefined;
    }

    // Since the entry and its contents are deep-frozen, we can safely return the entry directly
    return entry as MemoryEntry<T>;
  }

  public async has(namespace: string, key: string): Promise<boolean> {
    this._validator.validateNamespace(namespace);
    this._validator.validateKey(key);

    const ns = this._collection.getNamespace(namespace);
    return ns.has(key);
  }

  public async delete(namespace: string, key: string): Promise<boolean> {
    this._validator.validateNamespace(namespace);
    this._validator.validateKey(key);

    const ns = this._collection.getNamespace(namespace);
    return ns.delete(key);
  }

  public async clear(namespace?: string): Promise<void> {
    if (namespace) {
      this._validator.validateNamespace(namespace);
      const ns = this._collection.getNamespace(namespace);
      ns.clear();
    } else {
      this._collection.clear();
    }
  }

  public async keys(namespace?: string): Promise<string[]> {
    if (namespace) {
      this._validator.validateNamespace(namespace);
      const ns = this._collection.getNamespace(namespace);
      return ns.keys();
    } else {
      const allKeys: string[] = [];
      for (const nsName of this._collection.getNamespaces()) {
        const ns = this._collection.getNamespace(nsName);
        for (const key of ns.keys()) {
          allKeys.push(`${nsName}:${key}`);
        }
      }
      return allKeys;
    }
  }

  public async entries(namespace?: string): Promise<[string, MemoryEntry][]> {
    if (namespace) {
      this._validator.validateNamespace(namespace);
      const ns = this._collection.getNamespace(namespace);
      return ns.entries();
    } else {
      const allEntries: [string, MemoryEntry][] = [];
      for (const nsName of this._collection.getNamespaces()) {
        const ns = this._collection.getNamespace(nsName);
        for (const [key, entry] of ns.entries()) {
          allEntries.push([`${nsName}:${key}`, entry]);
        }
      }
      return allEntries;
    }
  }

  public async snapshot(): Promise<MemorySnapshot> {
    const namespaces = this._collection.getNamespaces();
    const allEntries = this._collection.getAllEntries();

    const entrySnapshots = allEntries.map((entry) =>
      Object.freeze({
        key: entry.key,
        namespace: entry.namespace,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
        version: entry.version,
        metadata: Object.freeze(JSON.parse(JSON.stringify(entry.metadata))),
      })
    );

    return Object.freeze({
      timestamp: new Date(),
      totalEntriesCount: allEntries.length,
      namespaceCount: namespaces.length,
      namespaces: Object.freeze(namespaces),
      entries: Object.freeze(entrySnapshots),
    });
  }
}
