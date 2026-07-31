import { ModelDescriptor } from "@shaily/core";

export const GeminiVideoModels: readonly ModelDescriptor[] = [
  {
    id: "veo-3",
    providerId: "google",
    capabilities: {
      chat: false,
      vision: false,
      imageGeneration: false,
      audioInput: false,
      audioOutput: false,
      toolCalling: false,
      jsonMode: false,
      streaming: false,
    },
    contextWindow: 0,
    maxOutput: 0,
    costMetadata: { inputCostPer1K: 0, outputCostPer1K: 0 },
    latencyMetadata: { averageLatencyMs: 25000 },
    enabled: true,
    displayName: "Gemini Veo 3 Video Generation (Google)",
    vision: false,
    tools: false,
    streaming: false,
    embeddings: false,
    JSON: false,
  },
];
