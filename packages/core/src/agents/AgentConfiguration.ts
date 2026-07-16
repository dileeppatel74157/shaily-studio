export interface AgentConfiguration {
  readonly maxIterations?: number;
  readonly timeoutMs?: number;
  readonly settings?: Record<string, unknown>;
}
