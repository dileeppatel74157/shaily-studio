export class LogMetadata {
  private readonly _fields: Readonly<Record<string, unknown>>;

  constructor(fields: Record<string, unknown> = {}) {
    this._fields = Object.freeze(JSON.parse(JSON.stringify(fields)));
  }

  public get fields(): Readonly<Record<string, unknown>> {
    return this._fields;
  }

  public get(key: string): unknown {
    return this._fields[key];
  }
}
