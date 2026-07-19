import { IRuntimeEngine } from "./interfaces";
import { RuntimeEngine } from "./RuntimeEngine";
import { RuntimeConfiguration } from "./models";
import { RuntimeValidationException } from "./types";
import { ServiceType } from "./ServiceType";

export class RuntimeBuilder {
  private _context?: any;
  private _config?: RuntimeConfiguration;
  private _host?: any;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: any): this {
    this._context = context;
    return this;
  }

  public withConfig(config: RuntimeConfiguration): this {
    this._config = config;
    return this;
  }

  public withHost(host: any): this {
    this._host = host;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): any {
    if (!this._context) {
      throw new RuntimeValidationException("RuntimeContext is required to build Runtime.");
    }
    if (!this._host && !this._config) {
      throw new RuntimeValidationException("Host is required to build Runtime.");
    }

    const config: RuntimeConfiguration = this._config || {
      env: this._context.env || "production",
      heartbeatIntervalMs: 5000,
      healthCheckIntervalMs: 10000,
      startupTimeoutMs: 5000,
      shutdownTimeoutMs: 5000,
      metadata: this._metadata
    };

    const runtime = new RuntimeEngine(this._context, config);
    if (this._host) {
      runtime.registerService({
        id: "IHost",
        type: ServiceType.CUSTOM,
        service: this._host
      });
    }
    return runtime;
  }
}
