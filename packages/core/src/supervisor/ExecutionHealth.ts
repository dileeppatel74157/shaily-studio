export interface ExecutionHealth {
  readonly latencyMs: number;
  readonly failuresCount: number;
  readonly retryCount: number;
  readonly memoryUsageBytes: number;
  readonly queueLength: number;
  readonly providerFailuresCount: number;
  readonly toolFailuresCount: number;
}
