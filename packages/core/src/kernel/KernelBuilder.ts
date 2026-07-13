import { IKernel } from "./IKernel";
import { Kernel } from "./Kernel";

export class KernelBuilder {
  private _version = "1.0.0";
  private _environment = "development";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _initialServices: Array<{ name: string; service: any }> = [];

  public withVersion(version: string): this {
    this._version = version;
    return this;
  }

  public withEnvironment(environment: string): this {
    this._environment = environment;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerService(name: string, service: any): this {
    this._initialServices.push({ name, service });
    return this;
  }

  public build(): IKernel {
    const kernel = new Kernel(this._version, this._environment);
    for (const { name, service } of this._initialServices) {
      kernel.register(name, service);
    }
    return kernel;
  }
}
