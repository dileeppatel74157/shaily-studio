import { ModelDescriptor } from "@shaily/core";

export const GeminiImageModels: readonly ModelDescriptor[] = [
  {
    id: "gemini-2.5-flash-image-preview",
    providerId: "google",
    capabilities: {
      chat: false,
      vision: false,
      imageGeneration: true,
      audioInput: false,
      audioOutput: false,
      toolCalling: false,
      jsonMode: false,
      streaming: false,
    },
    contextWindow: 0,
    maxOutput: 0,
    costMetadata: { inputCostPer1K: 0, outputCostPer1K: 0 },
    latencyMetadata: { averageLatencyMs: 3000 },
    enabled: true,
    displayName: "Gemini 2.5 Flash Image Preview (Google)",
    vision: false,
    tools: false,
    streaming: false,
    embeddings: false,
    JSON: false,
  },
];
