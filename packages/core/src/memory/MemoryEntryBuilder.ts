import { MemoryEntry } from "./MemoryEntry";

export class MemoryEntryBuilder<T = any> {
  private _key?: string;
  private _namespace?: string;
  private _value!: T;
  private _createdAt = new Date();
  private _updatedAt = new Date();
  private _version = 1;
  private _metadata: Record<string, unknown> = {};

  public withKey(key: string): this {
    this._key = key;
    return this;
  }

  public withNamespace(namespace: string): this {
    this._namespace = namespace;
    return this;
  }

  public withValue(value: T): this {
    this._value = value;
    return this;
  }

  public withCreatedAt(createdAt: Date): this {
    this._createdAt = createdAt;
    return this;
  }

  public withUpdatedAt(updatedAt: Date): this {
    this._updatedAt = updatedAt;
    return this;
  }

  public withVersion(version: number): this {
    this._version = version;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public build(): MemoryEntry<T> {
    if (!this._key) {
      throw new Error("Key is required to build a MemoryEntry.");
    }
    if (!this._namespace) {
      throw new Error("Namespace is required to build a MemoryEntry.");
    }
    return new MemoryEntry<T>(
      this._key,
      this._namespace,
      this._value,
      this._createdAt,
      this._updatedAt,
      this._version,
      this._metadata
    );
  }
}
