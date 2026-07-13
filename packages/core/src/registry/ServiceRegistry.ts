import { ServiceToken } from "../kernel/ServiceToken";
import { IServiceRegistry, ServiceRegistrySnapshot } from "./IServiceRegistry";
import { ServiceDescriptor } from "./ServiceDescriptor";
import { ServiceFactory } from "./ServiceFactory";
import { ServiceLifetime } from "./ServiceLifetime";

export class ServiceRegistry implements IServiceRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _descriptors = new Map<ServiceToken<any>, ServiceDescriptor<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _singletons = new Map<ServiceToken<any>, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _resolutionStack: ServiceToken<any>[] = [];

  public register<T>(token: ServiceToken<T>, instance: T): void {
    if (this._descriptors.has(token)) {
      throw new Error(`Service "${token.description}" has already been registered.`);
    }

    const descriptor: ServiceDescriptor<T> = {
      token,
      lifetime: ServiceLifetime.SINGLETON,
      factory: () => instance,
    };

    this._descriptors.set(token, descriptor);
    this._singletons.set(token, instance);
  }

  public registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT
  ): void {
    if (this._descriptors.has(token)) {
      throw new Error(`Service "${token.description}" has already been registered.`);
    }

    const descriptor: ServiceDescriptor<T> = {
      token,
      lifetime,
      factory,
    };

    this._descriptors.set(token, descriptor);
  }

  public resolve<T>(token: ServiceToken<T>): T {
    if (this._resolutionStack.includes(token)) {
      const path = [...this._resolutionStack, token].map((t) => t.description).join(" -> ");
      throw new Error(`Circular dependency detected: ${path}`);
    }

    const descriptor = this._descriptors.get(token);
    if (!descriptor) {
      throw new Error(`Service "${token.description}" was not found in registry.`);
    }

    if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
      if (this._singletons.has(token)) {
        return this._singletons.get(token) as T;
      }
    }

    this._resolutionStack.push(token);

    try {
      const resolvedInstance = descriptor.factory(this);

      if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
        this._singletons.set(token, resolvedInstance);
      }

      return resolvedInstance as T;
    } finally {
      this._resolutionStack.pop();
    }
  }

  public has(token: ServiceToken<any>): boolean {
    return this._descriptors.has(token);
  }

  public remove(token: ServiceToken<any>): boolean {
    this._singletons.delete(token);
    return this._descriptors.delete(token);
  }

  public clear(): void {
    this._descriptors.clear();
    this._singletons.clear();
  }

  public snapshot(): ServiceRegistrySnapshot {
    const registrations = Array.from(this._descriptors.values()).map((desc) => ({
      tokenDescription: desc.token.description,
      lifetime: desc.lifetime,
      isResolved: desc.lifetime === ServiceLifetime.SINGLETON && this._singletons.has(desc.token),
    }));

    return Object.freeze({
      timestamp: new Date(),
      registrations: Object.freeze(registrations),
    });
  }
}
