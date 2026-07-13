import { ModelCapabilities } from "./ModelCapability";

export interface ModelCostMetadata {
  readonly inputCostPer1K: number;
  readonly outputCostPer1K: number;
}

export interface ModelLatencyMetadata {
  readonly averageLatencyMs: number;
}

export interface ModelDescriptor {
  readonly id: string;
  readonly providerId: string;
  readonly capabilities: ModelCapabilities;
  readonly contextWindow: number;
  readonly maxOutput: number;
  readonly costMetadata: ModelCostMetadata;
  readonly latencyMetadata: ModelLatencyMetadata;
  readonly enabled: boolean;
}
