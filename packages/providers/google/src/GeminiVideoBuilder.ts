import { GeminiVideoProvider } from "./GeminiVideoProvider";
import { GeminiContext } from "./GeminiContext";
import { GeminiVideoConfiguration } from "./GeminiVideoConfiguration";
import { IProviderTransport } from "@shaily/core";

export class GeminiVideoBuilder {
  private _id = "gemini-video";
  private _name = "Google Gemini Video";
  private _context?: GeminiContext;
  private _configuration?: GeminiVideoConfiguration;
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

  public withContext(context: GeminiContext): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: GeminiVideoConfiguration): this {
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

  public build(): GeminiVideoProvider {
    if (!this._context) {
      throw new Error("Context is required for GeminiVideoProvider.");
    }
    if (!this._configuration) {
      throw new Error("Configuration is required for GeminiVideoProvider.");
    }

    return new GeminiVideoProvider(
      this._id,
      this._name,
      this._context,
      this._configuration,
      this._metadata,
      this._transport
    );
  }
}
