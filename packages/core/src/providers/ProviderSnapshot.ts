import { ProviderState } from "./ProviderState";
import { ProviderCapabilities } from "./ProviderCapability";

export interface ProviderSnapshot {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly state: ProviderState;
  readonly capabilities: ProviderCapabilities;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: Date;
}
