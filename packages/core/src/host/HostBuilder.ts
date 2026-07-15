import { IHost } from "./IHost";
import { Host } from "./Host";
import { HostContext } from "./HostContext";
import { IBootstrapper } from "../bootstrap/IBootstrapper";
import { HostValidationException } from "./types";

export class HostBuilder {
  private _context?: HostContext;
  private _bootstrapper?: IBootstrapper;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: HostContext): this {
    this._context = context;
    return this;
  }

  public withBootstrapper(bootstrapper: IBootstrapper): this {
    this._bootstrapper = bootstrapper;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IHost {
    if (!this._context) {
      throw new HostValidationException("HostContext is required to build Host.");
    }
    if (!this._bootstrapper) {
      throw new HostValidationException("Bootstrapper is required to build Host.");
    }

    return new Host(
      this._context,
      this._bootstrapper,
      this._metadata
    );
  }
}
