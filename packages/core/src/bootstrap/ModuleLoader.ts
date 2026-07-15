import { KernelModule } from "../kernel/KernelModule";
import { BootstrapManifest } from "./BootstrapManifest";
import { BootstrapValidationException } from "./types";

export class ModuleLoader {
  private readonly _factories = new Map<string, (config?: Record<string, unknown>) => KernelModule>();

  public registerFactory(
    moduleId: string,
    factory: (config?: Record<string, unknown>) => KernelModule
  ): void {
    this._factories.set(moduleId, factory);
  }

  public load(
    moduleId: string,
    manifest: BootstrapManifest
  ): KernelModule {
    const modConfig = manifest.modules.find((m) => m.id === moduleId);
    if (!modConfig) {
      throw new BootstrapValidationException(`Module "${moduleId}" not configured in manifest`);
    }

    const factory = this._factories.get(moduleId);
    if (!factory) {
      throw new BootstrapValidationException(`No factory registered for module "${moduleId}"`);
    }

    const rawConfig = modConfig.config || {};
    const configCopy = { ...rawConfig };

    return factory(configCopy);
  }
}
