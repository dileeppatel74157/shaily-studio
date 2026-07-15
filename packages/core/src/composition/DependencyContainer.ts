import { IServiceCollection } from "./IServiceCollection";
import { IServiceProvider } from "./IServiceProvider";
import { ServiceCollection } from "./ServiceCollection";

export class DependencyContainer implements IServiceCollection {
  private readonly _collection = new ServiceCollection();

  public addSingleton(token: string, implementation: any, factory?: (provider: IServiceProvider) => any): this {
    this._collection.addSingleton(token, implementation, factory);
    return this;
  }

  public addScoped(token: string, implementation: any, factory?: (provider: IServiceProvider) => any): this {
    this._collection.addScoped(token, implementation, factory);
    return this;
  }

  public addTransient(token: string, implementation: any, factory?: (provider: IServiceProvider) => any): this {
    this._collection.addTransient(token, implementation, factory);
    return this;
  }

  public remove(token: string): boolean {
    return this._collection.remove(token);
  }

  public contains(token: string): boolean {
    return this._collection.contains(token);
  }

  public build(): IServiceProvider {
    return this._collection.build();
  }
}
