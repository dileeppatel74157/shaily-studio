import { IRuntime } from "./IRuntime";
import { Runtime } from "./Runtime";
import { RuntimeContext } from "./RuntimeContext";
import { IHost } from "../host/IHost";
import { RuntimeValidationException } from "./types";

export class RuntimeBuilder {
  private _context?: RuntimeContext;
  private _host?: IHost;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: RuntimeContext): this {
    this._context = context;
    return this;
  }

  public withHost(host: IHost): this {
    this._host = host;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IRuntime {
    if (!this._context) {
      throw new RuntimeValidationException("RuntimeContext is required to build Runtime.");
    }
    if (!this._host) {
      throw new RuntimeValidationException("Host is required to build Runtime.");
    }

    return new Runtime(
      this._context,
      this._host,
      this._metadata
    );
  }
}
