import { NvidiaProvider } from "./NvidiaProvider";
import { NvidiaContext } from "./NvidiaContext";
import { NvidiaConfiguration } from "./NvidiaConfiguration";
import { IProviderTransport } from "@shaily/core";

export class NvidiaBuilder {
  private _id = "nvidia";
  private _name = "NVIDIA";
  private _context?: NvidiaContext;
  private _configuration?: NvidiaConfiguration;
  private _metadata: Record<string, any> = {};
  private _transport?: IProviderTransport;

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withName(name: string): this {
    this._name = name;
    return this;
  }

  public withContext(context: NvidiaContext): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: NvidiaConfiguration): this {
    this._configuration = configuration;
    return this;
  }

  public withMetadata(metadata: Record<string, any>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public withTransport(transport: IProviderTransport): this {
    this._transport = transport;
    return this;
  }

  public build(): NvidiaProvider {
    if (!this._context) {
      throw new Error("Context is required for NvidiaProvider.");
    }
    if (!this._configuration) {
      throw new Error("Configuration is required for NvidiaProvider.");
    }

    return new NvidiaProvider(
      this._id,
      this._name,
      this._context,
      this._configuration,
      this._metadata,
      this._transport
    );
  }
}
