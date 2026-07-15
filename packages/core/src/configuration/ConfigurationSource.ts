export interface ConfigurationSource {
  readonly name: string;
  get(key: string): unknown;
  has(key: string): boolean;
  getAll(): Record<string, unknown>;
}
