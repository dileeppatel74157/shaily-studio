import { IKernel } from "./IKernel";
import { Kernel } from "./Kernel";
import { ServiceToken } from "./ServiceToken";
import { Version } from "./Version";

export class KernelBuilder {
  private _version: Version = new Version(1, 0, 0);
  private _environment = "development";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _initialServices: Array<{ token: ServiceToken<any>; service: any }> = [];

  public withVersion(version: Version | string): this {
    this._version = typeof version === "string" ? Version.parse(version) : version;
    return this;
  }

  public withEnvironment(environment: string): this {
    this._environment = environment;
    return this;
  }

  public registerService<T>(token: ServiceToken<T>, service: T): this {
    this._initialServices.push({ token, service });
    return this;
  }

  public build(): IKernel {
    const kernel = new Kernel(this._version, this._environment);
    for (const { token, service } of this._initialServices) {
      kernel.register(token, service);
    }
    return kernel;
  }
}
