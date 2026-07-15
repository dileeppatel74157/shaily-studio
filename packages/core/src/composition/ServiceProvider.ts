import { IServiceProvider } from "./IServiceProvider";
import { ServiceDescriptor } from "./ServiceDescriptor";
import { ServiceLifetime } from "./ServiceLifetime";
import { CompositionSnapshot } from "./CompositionSnapshot";
import {
  CompositionException,
  CircularDependencyException,
  ServiceResolutionException,
  deepFreeze,
} from "./types";

export class ServiceProvider implements IServiceProvider {
  private readonly _descriptors: Map<string, ServiceDescriptor>;
  private readonly _parent?: ServiceProvider;
  private readonly _instances = new Map<string, any>();
  private readonly _resolutionStack = new Set<string>();
  private _disposed = false;

  constructor(descriptors: Map<string, ServiceDescriptor>, parent?: ServiceProvider) {
    this._descriptors = descriptors;
    this._parent = parent;
  }

  public resolve<T>(token: string): T {
    if (this._disposed) {
      throw new CompositionException("ServiceProvider has been disposed.");
    }
    if (!token || token.trim() === "") {
      throw new ServiceResolutionException("", "Token cannot be empty or null");
    }

    if (this._resolutionStack.has(token)) {
      const path = Array.from(this._resolutionStack).concat(token).join(" -> ");
      throw new CircularDependencyException(path);
    }

    this._resolutionStack.add(token);
    try {
      const descriptor = this._descriptors.get(token);
      if (!descriptor) {
        if (this._parent) {
          return this._parent.resolve<T>(token);
        }
        throw new ServiceResolutionException(token, "Service token is not registered");
      }

      switch (descriptor.lifetime) {
        case ServiceLifetime.Singleton: {
          // Resolve and cache at the root provider
          let root: ServiceProvider = this;
          while (root._parent) {
            root = root._parent;
          }
          if (!root._instances.has(token)) {
            const instance = root.instantiate(descriptor);
            root._instances.set(token, instance);
          }
          return root._instances.get(token);
        }
        case ServiceLifetime.Scoped: {
          // Resolve and cache at the current scope provider
          if (!this._instances.has(token)) {
            const instance = this.instantiate(descriptor);
            this._instances.set(token, instance);
          }
          return this._instances.get(token);
        }
        case ServiceLifetime.Transient:
        default:
          return this.instantiate(descriptor);
      }
    } finally {
      this._resolutionStack.delete(token);
    }
  }

  public tryResolve<T>(token: string): T | undefined {
    try {
      if (!token || !this.hasDescriptor(token)) {
        return undefined;
      }
      return this.resolve<T>(token);
    } catch {
      return undefined;
    }
  }

  public createScope(): IServiceProvider {
    if (this._disposed) {
      throw new CompositionException("ServiceProvider has been disposed.");
    }
    return new ServiceProvider(this._descriptors, this);
  }

  public async dispose(): Promise<void> {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._instances.clear();
    this._resolutionStack.clear();
  }

  public snapshot(): CompositionSnapshot {
    if (this._disposed) {
      throw new CompositionException("ServiceProvider has been disposed.");
    }

    const services = Array.from(this._descriptors.values());
    let singletonCount = 0;
    let scopedCount = 0;
    let transientCount = 0;

    const graph: Record<string, string[]> = {};

    for (const desc of services) {
      if (desc.lifetime === ServiceLifetime.Singleton) {
        singletonCount++;
      } else if (desc.lifetime === ServiceLifetime.Scoped) {
        scopedCount++;
      } else {
        transientCount++;
      }

      const inject = (desc.implementation as any)?.inject || [];
      graph[desc.token] = inject;
    }

    const snapshotObj: CompositionSnapshot = {
      timestamp: new Date(),
      services,
      singletonCount,
      scopedCount,
      transientCount,
      dependencyGraph: graph,
      metadata: {},
    };

    return deepFreeze(snapshotObj);
  }

  private hasDescriptor(token: string): boolean {
    if (this._descriptors.has(token)) {
      return true;
    }
    if (this._parent) {
      return this._parent.hasDescriptor(token);
    }
    return false;
  }

  private instantiate(descriptor: ServiceDescriptor): any {
    if (descriptor.factory) {
      return descriptor.factory(this);
    }

    const impl = descriptor.implementation;
    if (typeof impl !== "function" || !impl.prototype) {
      return impl;
    }

    const inject = (impl as any).inject || [];
    const args = inject.map((tok: string) => this.resolve(tok));
    return new impl(...args);
  }
}
