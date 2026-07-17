export interface ExecutionLimits {
  readonly maxTokens: number;
  readonly maxCost: number;
  readonly maxExecutionTimeMs: number;
  readonly maxWorkflowDepth: number;
  readonly maxRecursion: number;
  readonly maxParallelJobs: number;
  readonly maxRetries: number;
  readonly maxAiCalls: number;
  readonly maxToolCalls: number;
}
