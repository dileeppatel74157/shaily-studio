import { ProviderConfiguration } from "@shaily/core";

export interface NvidiaConfiguration extends ProviderConfiguration {
  readonly apiKey: string;
  readonly baseUrl?: string;
}
