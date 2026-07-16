import { IProvider } from "./IProvider";
import { ProviderType } from "./ProviderType";
import { ProviderValidationException, ProviderRegistrySnapshot, deepFreeze } from "./types";
import { IProviderRegistry } from "./IProviderRegistry";
import { ProviderFeature } from "./ProviderFeature";
import { ModelDescriptor } from "../router/ModelDescriptor";

export class ProviderRegistry implements IProviderRegistry {
  private readonly _providers = new Map<string, IProvider>();
  private readonly _defaults = new Map<ProviderType, string>();
  private _healthCallbacks: ((providerId: string, health: any) => void)[] = [];

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

  public modelLookup(modelId: string): { provider: IProvider; model: ModelDescriptor } | undefined {
    for (const provider of this.list()) {
      if (provider.models) {
        const foundModel = provider.models.find((m) => m.id === modelId);
        if (foundModel) {
          return { provider, model: foundModel };
        }
      }
    }
    return undefined;
  }

  public capabilityLookup(feature: ProviderFeature): readonly IProvider[] {
    return this.list().filter((p) => p.capabilities.includes(feature));
  }

  public providerLookup(id: string): IProvider | undefined {
    return this._providers.get(id);
  }

  public notifyHealthUpdate(providerId: string, health: any): void {
    for (const cb of this._healthCallbacks) {
      try {
        cb(providerId, health);
      } catch (_) {
        // Safe execution
      }
    }
  }

  public onHealthUpdate(callback: (providerId: string, health: any) => void): void {
    this._healthCallbacks.push(callback);
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
