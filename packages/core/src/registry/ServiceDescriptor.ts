import { ServiceToken } from "../kernel/ServiceToken";
import { ServiceFactory } from "./ServiceFactory";
import { ServiceLifetime } from "./ServiceLifetime";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ServiceDescriptor<T = any> {
  readonly token: ServiceToken<T>;
  readonly lifetime: ServiceLifetime;
  readonly factory: ServiceFactory<T>;
}
