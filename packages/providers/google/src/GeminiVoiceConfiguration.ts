import { ProviderConfiguration } from "@shaily/core";

export interface GeminiVoiceConfiguration extends ProviderConfiguration {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly ttsBaseUrl?: string;
  readonly sttBaseUrl?: string;
}
