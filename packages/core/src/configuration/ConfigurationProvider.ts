export interface ConfigurationProvider {
  readonly name: string;
  readonly priority: number;
  load(): Promise<Record<string, unknown>>;
}

export class MemoryConfigurationProvider implements ConfigurationProvider {
  private readonly _data: Record<string, unknown>;
  public readonly name: string;
  public readonly priority: number;

  constructor(name: string, priority: number, data: Record<string, unknown> = {}) {
    this.name = name;
    this.priority = priority;
    this._data = { ...data };
  }

  public async load(): Promise<Record<string, unknown>> {
    return { ...this._data };
  }

  public set(key: string, value: unknown): void {
    this._data[key] = value;
  }

  public remove(key: string): void {
    delete this._data[key];
  }
}
