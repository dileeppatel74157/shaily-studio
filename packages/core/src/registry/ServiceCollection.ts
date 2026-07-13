import { ServiceToken } from "../kernel/ServiceToken";
import { ServiceDescriptor } from "./ServiceDescriptor";
import { ServiceFactory } from "./ServiceFactory";
import { ServiceLifetime } from "./ServiceLifetime";

export class ServiceCollection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _descriptors: ServiceDescriptor<any>[] = [];

  public add<T>(token: ServiceToken<T>, instance: T): this {
    this._descriptors.push({
      token,
      lifetime: ServiceLifetime.SINGLETON,
      factory: () => instance,
    });
    return this;
  }

  public addFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    lifetime: ServiceLifetime = ServiceLifetime.TRANSIENT
  ): this {
    this._descriptors.push({
      token,
      lifetime,
      factory,
    });
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get descriptors(): ReadonlyArray<ServiceDescriptor<any>> {
    return this._descriptors;
  }
}
