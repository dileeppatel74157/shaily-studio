import { IProvider } from "./IProvider";
import { ProviderType } from "./ProviderType";
import { ProviderValidationException, ProviderRegistrySnapshot, deepFreeze } from "./types";
import { IProviderRegistry } from "./IProviderRegistry";

export class ProviderRegistry implements IProviderRegistry {
  private readonly _providers = new Map<string, IProvider>();
  private readonly _defaults = new Map<ProviderType, string>();

  public register(provider: IProvider): void {
    if (!provider) {
      throw new ProviderValidationException("Provider cannot be null.");
    }
    if (this._providers.has(provider.id)) {
      throw new ProviderValidationException(`Provider with ID "${provider.id}" is already registered.`);
    }
    this._providers.set(provider.id, provider);
  }

  public unregister(id: string): boolean {
    // Clean up defaults referencing this provider
    for (const [type, defaultId] of this._defaults.entries()) {
      if (defaultId === id) {
        this._defaults.delete(type);
      }
    }
    return this._providers.delete(id);
  }

  public get(id: string): IProvider {
    const provider = this._providers.get(id);
    if (!provider) {
      throw new ProviderValidationException(`Provider with ID "${id}" is not registered.`);
    }
    return provider;
  }

  public has(id: string): boolean {
    return this._providers.has(id);
  }

  public list(): readonly IProvider[] {
    return Array.from(this._providers.values());
  }

  public default(type: ProviderType): IProvider | undefined {
    const defaultId = this._defaults.get(type);
    if (!defaultId) {
      // Return first registered provider matching the type if no explicit default is configured
      return this.list().find((p) => p.type === type);
    }
    return this._providers.get(defaultId);
  }

  public setDefault(type: ProviderType, id: string): void {
    if (!this._providers.has(id)) {
      throw new ProviderValidationException(`Cannot set default: Provider with ID "${id}" is not registered.`);
    }
    const provider = this.get(id);
    if (provider.type !== type) {
      throw new ProviderValidationException(
        `Cannot set default: Provider "${id}" type "${provider.type}" does not match default type "${type}".`
      );
    }
    this._defaults.set(type, id);
  }

  public async execute(providerId: string, request: any): Promise<any> {
    const provider = this.get(providerId);
    return await provider.execute(request);
  }

  public snapshot(): ProviderRegistrySnapshot {
    const snaps = this.list().map((p) => p.snapshot());
    return deepFreeze({
      timestamp: new Date(),
      count: snaps.length,
      providers: snaps,
      defaults: Object.fromEntries(this._defaults),
    } as any);
  }
}
