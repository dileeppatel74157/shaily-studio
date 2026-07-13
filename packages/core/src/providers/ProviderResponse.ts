export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface ProviderResponse {
  readonly text: string;
  readonly finishReason: "stop" | "length" | "tool_calls" | "content_filter" | "error" | string;
  readonly tokenUsage?: TokenUsage;
  readonly latency: number; // in milliseconds
  readonly model: string;
  readonly provider: string;
  readonly metadata?: Record<string, unknown>;
}
