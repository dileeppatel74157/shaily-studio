export interface ProviderMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly name?: string;
}

export interface ProviderRequest {
  readonly requestId?: string;
  readonly providerId?: string;
  readonly model?: string;
  readonly messages?: readonly any[];
  readonly systemPrompt?: string;
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly stopSequences?: readonly string[];
  readonly stream?: boolean;
  readonly tools?: readonly any[];
  readonly attachments?: readonly any[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  // Backward compatibility fields
  readonly prompt?: string;
  readonly stop?: readonly string[];
  readonly jsonMode?: boolean;
}
