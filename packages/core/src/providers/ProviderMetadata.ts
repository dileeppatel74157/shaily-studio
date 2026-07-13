import { ProviderCapabilities } from "./ProviderCapability";

export interface ProviderMetadata {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: ProviderCapabilities;
}
