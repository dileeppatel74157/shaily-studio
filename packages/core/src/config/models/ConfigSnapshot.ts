export interface ConfigSnapshot {
  readonly timestamp: Date;
  get<T>(key: string): T;
  has(key: string): boolean;
  asRecord(): Record<string, unknown>;
}

export class ImmutableConfigSnapshot implements ConfigSnapshot {
  public readonly timestamp: Date;
  private readonly _data: Readonly<Record<string, unknown>>;

  constructor(data: Record<string, unknown>) {
    this.timestamp = new Date();
    this._data = Object.freeze(JSON.parse(JSON.stringify(data)));
  }

  public get<T>(key: string): T {
    const val = this._data[key];
    if (val === undefined) {
      throw new Error(`Config property "${key}" not found in snapshot.`);
    }
    return val as T;
  }

  public has(key: string): boolean {
    return this._data[key] !== undefined;
  }

  public asRecord(): Record<string, unknown> {
    return Object.freeze({ ...this._data });
  }
}
