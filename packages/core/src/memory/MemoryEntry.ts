export class MemoryEntry<T = any> {
  constructor(
    public readonly key: string,
    public readonly namespace: string,
    public readonly value: T,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
    public readonly metadata: Record<string, unknown>
  ) {
    Object.freeze(this);
  }
}
