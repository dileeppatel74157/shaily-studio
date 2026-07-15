import { IServiceProvider } from "./IServiceProvider";

export interface IServiceCollection {
  addSingleton(token: string, implementation: any, factory?: (provider: IServiceProvider) => any): this;
  addScoped(token: string, implementation: any, factory?: (provider: IServiceProvider) => any): this;
  addTransient(token: string, implementation: any, factory?: (provider: IServiceProvider) => any): this;
  remove(token: string): boolean;
  contains(token: string): boolean;
  build(): IServiceProvider;
}
