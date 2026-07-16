import { ProviderFeature } from "@shaily/core";

export const GeminiCapabilities: readonly ProviderFeature[] = [
  ProviderFeature.Streaming,
  ProviderFeature.JSONMode,
  ProviderFeature.Tools,
  ProviderFeature.Vision,
  ProviderFeature.Embeddings,
];
