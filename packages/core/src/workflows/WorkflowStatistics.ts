export interface WorkflowStatistics {
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly durationMs: number;
  readonly stepCount: number;
  readonly aiCallsCount: number;
  readonly tokensUsed: number;
  readonly executionTimeMap?: Record<string, number>;
}
