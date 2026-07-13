import { ConfigSchema } from "./ConfigSchema";
import { ConfigSnapshot, ImmutableConfigSnapshot } from "./ConfigSnapshot";
import { ConfigSource } from "./ConfigSource";
import { ConfigValidator } from "./ConfigValidator";
import { IConfig } from "./IConfig";

export class Config implements IConfig {
  private readonly _schema: ConfigSchema;
  private readonly _sources: ConfigSource[];
  private readonly _validator: ConfigValidator;
  private _data: Record<string, unknown> = {};
  private _snapshot!: ConfigSnapshot;

  constructor(schema: ConfigSchema, sources: ConfigSource[], validator: ConfigValidator) {
    this._schema = schema;
    this._sources = sources;
    this._validator = validator;
  }

  public async reload(): Promise<void> {
    const merged: Record<string, unknown> = {};

    for (const source of this._sources) {
      try {
        const sourceData = await source.load();
        for (const [key, value] of Object.entries(sourceData)) {
          if (value !== undefined) {
            merged[key] = value;
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to load config source "${source.name}":`, error);
      }
    }

    this._validator.validate(merged, this._schema);

    this._data = merged;
    this._snapshot = new ImmutableConfigSnapshot(this._data);
  }

  public get<T>(key: string): T {
    const val = this._data[key];
    if (val === undefined) {
      throw new Error(`Configuration key "${key}" not found.`);
    }
    return val as T;
  }

  public has(key: string): boolean {
    return this._data[key] !== undefined;
  }

  public snapshot(): ConfigSnapshot {
    return this._snapshot;
  }

  public validate(): void {
    this._validator.validate(this._data, this._schema);
  }
}
