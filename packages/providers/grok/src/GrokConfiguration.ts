import { ProviderConfiguration } from "@shaily/core";

export interface GrokConfiguration extends ProviderConfiguration {
  readonly apiKey: string;
  readonly baseUrl?: string;
}
