export interface ExecutionBudget {
  readonly tokens: number;
  readonly cost: number;
  readonly executionTimeMs: number;
  readonly apiCalls: number;
  readonly providerUsage: Record<string, number>;
}
