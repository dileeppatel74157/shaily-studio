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

    let descriptor = this._descriptors.get(token);
    let resolvedToken = token;
    if (!descriptor && token && typeof token === "object") {
      const matchedKey = Array.from(this._descriptors.keys()).find(
        (k) =>
          ((k as any).name !== undefined && (k as any).name !== null && (k as any).name === (token as any).name) ||
          ((k as any).description !== undefined && (k as any).description !== null && (k as any).description === (token as any).description)
      );
      if (matchedKey) {
        descriptor = this._descriptors.get(matchedKey);
        resolvedToken = matchedKey;
      }
    }

    if (!descriptor) {
      throw new Error(`Service "${token.description || (token as any).name}" was not found in registry.`);
    }

    if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
      if (this._singletons.has(resolvedToken)) {
        return this._singletons.get(resolvedToken) as T;
      }
    }

    this._resolutionStack.push(resolvedToken);

    try {
      const resolvedInstance = descriptor.factory(this);

      if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
        this._singletons.set(resolvedToken, resolvedInstance);
      }

      return resolvedInstance as T;
    } finally {
      this._resolutionStack.pop();
    }
  }

  public has(token: ServiceToken<any>): boolean {
    if (this._descriptors.has(token)) return true;
    if (token && typeof token === "object") {
      return Array.from(this._descriptors.keys()).some(
        (k) =>
          ((k as any).name !== undefined && (k as any).name !== null && (k as any).name === (token as any).name) ||
          ((k as any).description !== undefined && (k as any).description !== null && (k as any).description === (token as any).description)
      );
    }
    return false;
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
