import { ConfigSource } from "./ConfigSource";

export class EnvironmentSource implements ConfigSource {
  public readonly name = "EnvironmentSource";
  private readonly _prefix: string;

  constructor(prefix = "") {
    this._prefix = prefix;
  }

  public async load(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    const env = process.env || {};
    for (const key of Object.keys(env)) {
      if (key.startsWith(this._prefix)) {
        const normalizedKey = key.slice(this._prefix.length);
        const cleanKey = normalizedKey.toLowerCase().replace(/_/g, ".");
        result[cleanKey] = env[key];
        result[normalizedKey] = env[key];
      }
    }
    return result;
  }
}
