export interface ConfigSource {
  readonly name: string;
  load(): Promise<Record<string, unknown>>;
}
