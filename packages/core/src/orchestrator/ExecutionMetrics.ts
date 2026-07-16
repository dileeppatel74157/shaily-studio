export interface ExecutionMetrics {
  readonly latencyMs: number;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly retryCount: number;
}
