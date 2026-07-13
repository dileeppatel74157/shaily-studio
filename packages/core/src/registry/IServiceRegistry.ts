import { ServiceToken } from "../kernel/ServiceToken";
import { ServiceFactory } from "./ServiceFactory";
import { ServiceLifetime } from "./ServiceLifetime";

export interface ServiceRegistrySnapshot {
  readonly timestamp: Date;
  readonly registrations: ReadonlyArray<{
    readonly tokenDescription: string;
    readonly lifetime: ServiceLifetime;
    readonly isResolved: boolean;
  }>;
}

export interface IServiceRegistry {
  register<T>(token: ServiceToken<T>, instance: T): void;
  registerFactory<T>(token: ServiceToken<T>, factory: ServiceFactory<T>, lifetime: ServiceLifetime): void;
  resolve<T>(token: ServiceToken<T>): T;
  has(token: ServiceToken<any>): boolean;
  remove(token: ServiceToken<any>): boolean;
  clear(): void;
  snapshot(): ServiceRegistrySnapshot;
}
