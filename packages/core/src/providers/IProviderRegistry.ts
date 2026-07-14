import { IProvider } from "./IProvider";
import { ProviderRegistrySnapshot } from "./types";

export interface IProviderRegistry {
  register(provider: IProvider): void;
  unregister(providerId: string): boolean;
  get(providerId: string): IProvider | undefined;
  has(providerId: string): boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(providerId: string, request: any): Promise<any>;
  snapshot(): ProviderRegistrySnapshot;
}
