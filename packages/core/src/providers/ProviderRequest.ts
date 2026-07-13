export interface ProviderMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly name?: string;
}

export interface ProviderRequest {
  readonly prompt?: string;
  readonly systemPrompt?: string;
  readonly messages?: ReadonlyArray<ProviderMessage>;
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly stop?: ReadonlyArray<string>;
  readonly jsonMode?: boolean;
  readonly stream?: boolean;
  readonly attachments?: ReadonlyArray<{
    readonly type: string;
    readonly data: string; // Base64 encoded or URL
  }>;
  readonly metadata?: Record<string, unknown>;
}
