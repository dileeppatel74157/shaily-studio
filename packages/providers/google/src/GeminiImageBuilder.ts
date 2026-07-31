import { GeminiImageProvider } from "./GeminiImageProvider";
import { GeminiContext } from "./GeminiContext";
import { GeminiImageConfiguration } from "./GeminiImageConfiguration";
import { IProviderTransport } from "@shaily/core";

export class GeminiImageBuilder {
  private _id = "gemini-image";
  private _name = "Google Gemini Image";
  private _context?: GeminiContext;
  private _configuration?: GeminiImageConfiguration;
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

  public withConfiguration(configuration: GeminiImageConfiguration): this {
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

  public build(): GeminiImageProvider {
    if (!this._context) {
      throw new Error("Context is required for GeminiImageProvider.");
    }
    if (!this._configuration) {
      throw new Error("Configuration is required for GeminiImageProvider.");
    }

    return new GeminiImageProvider(
      this._id,
      this._name,
      this._context,
      this._configuration,
      this._metadata,
      this._transport
    );
  }
}
