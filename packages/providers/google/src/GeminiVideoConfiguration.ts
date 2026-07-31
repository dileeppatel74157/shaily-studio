import { ProviderConfiguration } from "@shaily/core";

export interface GeminiVideoConfiguration extends ProviderConfiguration {
  readonly apiKey: string;
  readonly baseUrl?: string;
}
