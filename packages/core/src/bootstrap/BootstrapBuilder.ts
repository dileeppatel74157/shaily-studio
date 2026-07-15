import { IBootstrapper } from "./IBootstrapper";
import { Bootstrapper } from "./Bootstrapper";
import { BootstrapContext } from "./BootstrapContext";
import { ModuleLoader } from "./ModuleLoader";
import { KernelModule } from "../kernel/KernelModule";
import { BootstrapValidationException } from "./types";

export class BootstrapBuilder {
  private _context?: BootstrapContext;
  private readonly _loader = new ModuleLoader();
  private _metadata: Record<string, unknown> = {};

  public withContext(context: BootstrapContext): this {
    this._context = context;
    return this;
  }

  public withModuleFactory(
    moduleId: string,
    factory: (config?: Record<string, unknown>) => KernelModule
  ): this {
    this._loader.registerFactory(moduleId, factory);
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IBootstrapper {
    if (!this._context) {
      throw new BootstrapValidationException("BootstrapContext is required to build Bootstrapper.");
    }

    return new Bootstrapper(
      this._context,
      this._loader,
      this._metadata
    );
  }
}
