import { IProvider } from "./IProvider";
import { ProviderRegistrySnapshot } from "./types";
import { IProviderRegistry } from "./IProviderRegistry";

export class ProviderRegistry implements IProviderRegistry {
  private readonly _providers = new Map<string, IProvider>();

  public register(provider: IProvider): void {
    if (this._providers.has(provider.id)) {
      throw new Error(`Provider with ID ${provider.id} is already registered.`);
    }
    this._providers.set(provider.id, provider);
  }

  public unregister(providerId: string): boolean {
    return this._providers.delete(providerId);
  }

  public get(providerId: string): IProvider | undefined {
    return this._providers.get(providerId);
  }

  public has(providerId: string): boolean {
    return this._providers.has(providerId);
  }

  public async execute(providerId: string, request: any): Promise<any> {
    const provider = this._providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider with ID ${providerId} is not registered.`);
    }
    return await provider.execute(request);
  }

  public snapshot(): ProviderRegistrySnapshot {
    const snaps = Array.from(this._providers.values()).map((p) => p.snapshot());
    return Object.freeze({
      timestamp: new Date(),
      count: snaps.length,
      providers: Object.freeze(snaps),
    });
  }
}
