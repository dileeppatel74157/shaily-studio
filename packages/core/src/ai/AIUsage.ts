export interface AIUsage {
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly estimatedLatencyMs: number;
  readonly executionDurationMs: number;
  readonly finishReason?: string;
}
