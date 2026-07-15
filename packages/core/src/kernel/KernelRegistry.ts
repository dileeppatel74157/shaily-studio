import { KernelModule } from "./KernelModule";
import { KernelValidationException } from "./types";

export class KernelRegistry {
  private readonly _modules = new Map<string, KernelModule>();

  public register(module: KernelModule): void {
    if (this._modules.has(module.id)) {
      throw new KernelValidationException(`Module with ID "${module.id}" is already registered`);
    }
    this._modules.set(module.id, module);
  }

  public unregister(moduleId: string): void {
    if (!this._modules.has(moduleId)) {
      throw new KernelValidationException(`Module with ID "${moduleId}" is not registered`);
    }
    this._modules.delete(moduleId);
  }

  public has(moduleId: string): boolean {
    return this._modules.has(moduleId);
  }

  public get(moduleId: string): KernelModule | undefined {
    return this._modules.get(moduleId);
  }

  public list(): readonly KernelModule[] {
    return Array.from(this._modules.values());
  }

  public clear(): void {
    this._modules.clear();
  }
}
