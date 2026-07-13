import { ModelDescriptor } from "./ModelDescriptor";

export class ModelRegistry {
  private readonly _models = new Map<string, ModelDescriptor>();

  public register(model: ModelDescriptor): void {
    if (this._models.has(model.id)) {
      throw new Error(`Model with ID ${model.id} is already registered.`);
    }
    this._models.set(model.id, model);
  }

  public unregister(modelId: string): boolean {
    return this._models.delete(modelId);
  }

  public get(modelId: string): ModelDescriptor | undefined {
    return this._models.get(modelId);
  }

  public has(modelId: string): boolean {
    return this._models.has(modelId);
  }

  public list(): ReadonlyArray<ModelDescriptor> {
    return Array.from(this._models.values());
  }

  public clear(): void {
    this._models.clear();
  }
}
