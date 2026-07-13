import { IServiceRegistry } from "./IServiceRegistry";

export type ServiceFactory<T> = (registry: IServiceRegistry) => T;
