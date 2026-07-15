import { ServiceLifetime } from "./ServiceLifetime";
import { IServiceProvider } from "./IServiceProvider";

export interface ServiceDescriptor {
  readonly token: string;
  readonly implementation: any;
  readonly lifetime: ServiceLifetime;
  readonly factory?: (provider: IServiceProvider) => any;
}
