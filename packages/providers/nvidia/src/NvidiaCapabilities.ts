import { ProviderFeature } from "@shaily/core";

export const NvidiaCapabilities: readonly ProviderFeature[] = [
  ProviderFeature.Streaming,
  ProviderFeature.JSONMode,
  ProviderFeature.Tools,
  ProviderFeature.Vision,
  ProviderFeature.StructuredOutput,
];
