import { ProviderFeature } from "@shaily/core";

export const OpenAICapabilities: readonly ProviderFeature[] = [
  ProviderFeature.Streaming,
  ProviderFeature.JSONMode,
  ProviderFeature.Tools,
  ProviderFeature.Vision,
  ProviderFeature.StructuredOutput,
  ProviderFeature.Embeddings,
];
