import { ProviderResponse } from "../providers/ProviderResponse";

export interface RouterResponse {
  readonly providerId: string;
  readonly modelId: string;
  readonly providerResponse: ProviderResponse;
  readonly routingReason: string;
  readonly latency: number; // overall execution latency
  readonly metadata?: Record<string, unknown>;
}
