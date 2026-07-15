import { IServiceCollection } from "./IServiceCollection";
import { IServiceProvider } from "./IServiceProvider";
import { ServiceDescriptor } from "./ServiceDescriptor";
import { ServiceLifetime } from "./ServiceLifetime";
import { ServiceProvider } from "./ServiceProvider";
import { CompositionValidationException } from "./types";
import { CompositionValidator } from "./CompositionValidator";


export class ServiceCollection implements IServiceCollection {
  private readonly _descriptors = new Map<string, ServiceDescriptor>();

  public addSingleton(token: string, implementation: any, factory?: (provider: IServiceProvider) => any): this {
    this.register(token, ServiceLifetime.Singleton, implementation, factory);
    return this;
  }

  public addScoped(token: string, implementation: any, factory?: (provider: IServiceProvider) => any): this {
    this.register(token, ServiceLifetime.Scoped, implementation, factory);
    return this;
  }

  public addTransient(token: string, implementation: any, factory?: (provider: IServiceProvider) => any): this {
    this.register(token, ServiceLifetime.Transient, implementation, factory);
    return this;
  }

  public remove(token: string): boolean {
    if (!token) {
      throw new CompositionValidationException("Token cannot be empty or null");
    }
    return this._descriptors.delete(token);
  }

  public contains(token: string): boolean {
    if (!token) {
      throw new CompositionValidationException("Token cannot be empty or null");
    }
    return this._descriptors.has(token);
  }

  public build(): IServiceProvider {
    CompositionValidator.validate(this._descriptors);
    return new ServiceProvider(new Map(this._descriptors));
  }


  private register(token: string, lifetime: ServiceLifetime, implementation: any, factory?: (provider: IServiceProvider) => any): void {
    if (!token || token.trim() === "") {
      throw new CompositionValidationException("Service token cannot be empty or null");
    }
    if ((implementation === null || implementation === undefined) && !factory) {
      throw new CompositionValidationException(`Implementation/Class constructor or factory for token "${token}" cannot be null or undefined`);
    }

    if (this._descriptors.has(token)) {
      throw new CompositionValidationException(`Service with token "${token}" is already registered`);
    }

    const descriptor: ServiceDescriptor = {
      token,
      implementation,
      lifetime,
      factory,
    };
    this._descriptors.set(token, descriptor);
  }
}
