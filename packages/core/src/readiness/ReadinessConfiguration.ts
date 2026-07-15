export interface ReadinessConfiguration {
  readonly checks: readonly string[];
  readonly timeoutMs?: number;
  readonly settings: Readonly<Record<string, unknown>>;
}
