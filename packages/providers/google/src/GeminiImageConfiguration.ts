import { ProviderConfiguration } from "@shaily/core";

export interface GeminiImageConfiguration extends ProviderConfiguration {
  readonly apiKey: string;
  readonly baseUrl?: string;
}
