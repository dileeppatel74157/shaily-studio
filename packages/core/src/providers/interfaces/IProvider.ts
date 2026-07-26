import { ProviderType } from "../models/ProviderType";
import { ProviderFeature } from "../models/ProviderFeature";
import { ProviderHealth } from "../models/ProviderHealth";
import { ProviderRequest } from "../models/ProviderRequest";
import { ProviderResponse, ProviderResponseChunk } from "../models/ProviderResponse";
import { ProviderSnapshot } from "../models/ProviderSnapshot";
import { ProviderState } from "../models/ProviderState";
import { ProviderMetadata } from "../models/ProviderMetadata";
import { ModelDescriptor } from "../router/ModelDescriptor";

export interface IProvider {
  readonly id: string;
  readonly name: string;
  readonly type: ProviderType;
  readonly capabilities: readonly ProviderFeature[];
  readonly state: ProviderState; // For backward compatibility
  readonly version: string; // For backward compatibility
  readonly metadata: ProviderMetadata; // For backward compatibility
  readonly models: readonly ModelDescriptor[];

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  health(): ProviderHealth;
  execute(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk>;
  snapshot(): ProviderSnapshot;
}
