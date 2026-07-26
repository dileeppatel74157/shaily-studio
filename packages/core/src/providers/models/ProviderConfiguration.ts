export interface ProviderConfiguration {
  readonly models: readonly string[];
  readonly settings: Readonly<Record<string, unknown>>;
}
