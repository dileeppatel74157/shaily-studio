export interface PlatformConfiguration {
  readonly features: readonly string[];
  readonly settings: Readonly<Record<string, unknown>>;
}
