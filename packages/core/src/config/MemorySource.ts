import { ConfigSource } from "./ConfigSource";

export class MemorySource implements ConfigSource {
  public readonly name = "MemorySource";
  private readonly _data: Record<string, unknown>;

  constructor(data: Record<string, unknown>) {
    this._data = { ...data };
  }

  public async load(): Promise<Record<string, unknown>> {
    return { ...this._data };
  }
}
