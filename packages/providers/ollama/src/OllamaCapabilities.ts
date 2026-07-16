import { ProviderFeature } from "@shaily/core";

export const OllamaCapabilities: readonly ProviderFeature[] = [
  ProviderFeature.Streaming,
  ProviderFeature.JSONMode,
  ProviderFeature.Tools,
  ProviderFeature.Vision,
  ProviderFeature.Embeddings,
];
