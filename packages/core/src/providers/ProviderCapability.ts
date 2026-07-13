export interface ProviderCapabilities {
  readonly chat: boolean;
  readonly vision: boolean;
  readonly imageGeneration: boolean;
  readonly audioInput: boolean;
  readonly audioOutput: boolean;
  readonly toolCalling: boolean;
  readonly jsonMode: boolean;
  readonly streaming: boolean;
}
