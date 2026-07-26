import { MemoryType } from "./MemoryType";
import { MemoryScope } from "./MemoryScope";
import { MemoryImportance } from "./MemoryImportance";
import { MemoryMetadata } from "./MemoryMetadata";

export class MemoryEntry<T = any> {
  public readonly id: string;
  public readonly key: string;
  public readonly namespace: string;
  public readonly value: T;
  public readonly content: string;
  public readonly type: MemoryType;
  public readonly scope: MemoryScope;
  public readonly importance: MemoryImportance;
  public readonly tags: ReadonlyArray<string>;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly timestamp: Date;
  public readonly version: number;
  public readonly metadata: MemoryMetadata;

  constructor(...args: any[]) {
    if (args.length === 7) {
      // Old constructor: key, namespace, value, createdAt, updatedAt, version, metadata
      const [key, namespace, value, createdAt, updatedAt, version, metadata] = args;
      this.id = metadata.id || "mem-" + Math.random().toString(36).substring(2, 11);
      this.key = key;
      this.namespace = namespace;
      this.value = value;
      this.content = typeof value === "string" ? value : JSON.stringify(value);
      this.type = (metadata.type as MemoryType) || "SYSTEM";
      this.scope = (metadata.scope as MemoryScope) || "GLOBAL";
      this.importance = (metadata.importance as MemoryImportance) || "NORMAL";
      this.tags = (metadata.tags as string[]) || [];
      this.createdAt = createdAt;
      this.updatedAt = updatedAt;
      this.timestamp = createdAt;
      this.version = version;
      this.metadata = metadata;
    } else {
      // New constructor: id, key, namespace, type, scope, importance, content, tags, metadata, value, createdAt, updatedAt, version
      const [
        id,
        key,
        namespace,
        type,
        scope,
        importance,
        content,
        tags,
        metadata,
        value,
        createdAt,
        updatedAt,
        version,
      ] = args;
      this.id = id || "mem-" + Math.random().toString(36).substring(2, 11);
      this.key = key || "";
      this.namespace = namespace || "";
      this.type = type || "SYSTEM";
      this.scope = scope || "GLOBAL";
      this.importance = importance || "NORMAL";
      this.content = content || "";
      this.tags = Object.freeze(tags ? [...tags] : []);
      this.metadata = Object.freeze(metadata ? { ...metadata } : {});
      this.value = value !== undefined ? value : (content as any);
      this.createdAt = createdAt || new Date();
      this.updatedAt = updatedAt || new Date();
      this.timestamp = this.createdAt;
      this.version = version || 1;
    }
    Object.freeze(this);
  }
}
