export interface SkillConfiguration {
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly custom?: Record<string, unknown>;
}
