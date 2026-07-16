import { OpenAIProvider } from "./OpenAIProvider";
import { OpenAIContext } from "./OpenAIContext";
import { OpenAIConfiguration } from "./OpenAIConfiguration";
import { IProviderTransport } from "@shaily/core";

export class OpenAIBuilder {
  private _id = "openai";
  private _name = "OpenAI";
  private _context?: OpenAIContext;
  private _configuration?: OpenAIConfiguration;
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

  public withContext(context: OpenAIContext): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: OpenAIConfiguration): this {
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

  public build(): OpenAIProvider {
    if (!this._context) {
      throw new Error("Context is required for OpenAIProvider.");
    }
    if (!this._configuration) {
      throw new Error("Configuration is required for OpenAIProvider.");
    }

    return new OpenAIProvider(
      this._id,
      this._name,
      this._context,
      this._configuration,
      this._metadata,
      this._transport
    );
  }
}
