import { ProviderType } from "./ProviderType";
import { ProviderFeature } from "./ProviderFeature";
import { ProviderHealth } from "./ProviderHealth";
import { ProviderRequest } from "./ProviderRequest";
import { ProviderResponse } from "./ProviderResponse";
import { ProviderSnapshot } from "./ProviderSnapshot";
import { ProviderState } from "./ProviderState";
import { ProviderMetadata } from "./ProviderMetadata";

export interface IProvider {
  readonly id: string;
  readonly name: string;
  readonly type: ProviderType;
  readonly capabilities: readonly ProviderFeature[];
  readonly state: ProviderState; // For backward compatibility
  readonly version: string; // For backward compatibility
  readonly metadata: ProviderMetadata; // For backward compatibility

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  health(): ProviderHealth;
  execute(request: ProviderRequest): Promise<ProviderResponse>;
  snapshot(): ProviderSnapshot;
}
