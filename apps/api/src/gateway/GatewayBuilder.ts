import { Gateway } from "./Gateway";
import { GatewayContext } from "./GatewayContext";
import { GatewayValidationException } from "./types";

export class GatewayBuilder {
  private _context?: GatewayContext;
  private _host = "localhost";
  private _port = 3000;
  private _metadata: Record<string, any> = {};

  public withContext(context: GatewayContext): this {
    this._context = context;
    return this;
  }

  public withHost(host: string): this {
    this._host = host;
    return this;
  }

  public withPort(port: number): this {
    this._port = port;
    return this;
  }

  public withMetadata(metadata: Record<string, any>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): Gateway {
    if (!this._context) {
      throw new GatewayValidationException(
        "GatewayContext is required to build Gateway."
      );
    }
    if (this._port < 0 || this._port > 65535) {
      throw new GatewayValidationException(`Invalid port: ${this._port}.`);
    }

    const finalContext: GatewayContext = {
      ...this._context,
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return new Gateway(finalContext, this._host, this._port);
  }
}
