import { ProviderDescriptor } from "./ProviderDescriptor";
import { ProviderConfiguration } from "./ProviderConfiguration";
import { ProviderHealth } from "./ProviderHealth";
import { ProviderState } from "./ProviderState";

export interface ProviderSnapshot {
  readonly descriptor: ProviderDescriptor;
  readonly configuration: ProviderConfiguration;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly health: ProviderHealth;
  readonly capabilities: any;
  readonly lifecycle: ProviderState;
  // Backward compatibility fields
  readonly id?: string;
  readonly name?: string;
  readonly version?: string;
  readonly state?: ProviderState;
  readonly timestamp?: Date;
}
