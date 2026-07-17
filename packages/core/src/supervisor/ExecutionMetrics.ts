export interface ExecutionMetrics {
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly aiCallsCount: number;
  readonly toolCallsCount: number;
  readonly recursionDepth: number;
  readonly retriesCount: number;
}
