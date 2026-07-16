import { ProviderConfiguration } from "@shaily/core";

export interface OpenAIConfiguration extends ProviderConfiguration {
  readonly apiKey: string;
  readonly baseUrl?: string;
}
