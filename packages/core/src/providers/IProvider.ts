import { ProviderMetadata } from "./ProviderMetadata";
import { ProviderState } from "./ProviderState";
import { ProviderRequest } from "./ProviderRequest";
import { ProviderResponse } from "./ProviderResponse";
import { ProviderSnapshot } from "./ProviderSnapshot";

export interface IProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly state: ProviderState;
  readonly metadata: ProviderMetadata;

  initialize(): Promise<void>;
  execute(request: ProviderRequest): Promise<ProviderResponse>;
  health(): Promise<{ isHealthy: boolean; details?: Record<string, unknown> }>;
  snapshot(): ProviderSnapshot;
}
