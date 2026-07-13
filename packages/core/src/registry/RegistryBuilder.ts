import { IServiceRegistry } from "./IServiceRegistry";
import { ServiceCollection } from "./ServiceCollection";
import { ServiceRegistry } from "./ServiceRegistry";

export class RegistryBuilder {
  private readonly _collection: ServiceCollection;

  constructor(collection = new ServiceCollection()) {
    this._collection = collection;
  }

  public get collection(): ServiceCollection {
    return this._collection;
  }

  public build(): IServiceRegistry {
    const registry = new ServiceRegistry();
    for (const descriptor of this._collection.descriptors) {
      registry.registerFactory(descriptor.token, descriptor.factory, descriptor.lifetime);
    }
    return registry;
  }
}
