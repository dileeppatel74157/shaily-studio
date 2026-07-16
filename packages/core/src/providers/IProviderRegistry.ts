import { IProvider } from "./IProvider";
import { ProviderRegistrySnapshot } from "./types";
import { ProviderFeature } from "./ProviderFeature";
import { ModelDescriptor } from "../router/ModelDescriptor";

export interface IProviderRegistry {
  register(provider: IProvider): void;
  unregister(providerId: string): boolean;
  get(providerId: string): IProvider;
  has(providerId: string): boolean;
  list(): readonly IProvider[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(providerId: string, request: any): Promise<any>;
  snapshot(): ProviderRegistrySnapshot;

  // V2 methods
  modelLookup(modelId: string): { provider: IProvider; model: ModelDescriptor } | undefined;
  capabilityLookup(feature: ProviderFeature): readonly IProvider[];
  providerLookup(id: string): IProvider | undefined;
}
