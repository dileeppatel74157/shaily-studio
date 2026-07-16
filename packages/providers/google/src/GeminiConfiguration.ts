import { ProviderConfiguration } from "@shaily/core";

export interface GeminiConfiguration extends ProviderConfiguration {
  readonly apiKey: string;
  readonly baseUrl?: string;
}
