import { GrokProvider } from "./GrokProvider";
import { GrokContext } from "./GrokContext";
import { GrokConfiguration } from "./GrokConfiguration";
import { IProviderTransport } from "@shaily/core";

export class GrokBuilder {
  private _id = "grok";
  private _name = "Grok";
  private _context?: GrokContext;
  private _configuration?: GrokConfiguration;
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

  public withContext(context: GrokContext): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: GrokConfiguration): this {
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

  public build(): GrokProvider {
    if (!this._context) {
      throw new Error("Context is required for GrokProvider.");
    }
    if (!this._configuration) {
      throw new Error("Configuration is required for GrokProvider.");
    }

    return new GrokProvider(
      this._id,
      this._name,
      this._context,
      this._configuration,
      this._metadata,
      this._transport
    );
  }
}
