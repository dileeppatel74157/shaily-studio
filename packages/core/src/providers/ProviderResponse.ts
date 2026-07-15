export interface ProviderResponse {
  readonly responseId?: string;
  readonly providerId?: string;
  readonly model?: string;
  readonly content?: string;
  readonly text?: string; // For backward compatibility
  readonly provider?: string; // For backward compatibility
  readonly tokenUsage?: any; // For backward compatibility
  readonly toolCalls?: readonly any[];
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
  readonly latency: number;
  readonly finishReason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
