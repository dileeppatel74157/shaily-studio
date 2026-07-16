import { OllamaProvider } from "./OllamaProvider";
import { OllamaContext } from "./OllamaContext";
import { OllamaConfiguration } from "./OllamaConfiguration";
import { IProviderTransport } from "@shaily/core";

export class OllamaBuilder {
  private _id = "ollama";
  private _name = "Ollama";
  private _context?: OllamaContext;
  private _configuration?: OllamaConfiguration;
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

  public withContext(context: OllamaContext): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: OllamaConfiguration): this {
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

  public build(): OllamaProvider {
    if (!this._context) {
      throw new Error("Context is required for OllamaProvider.");
    }
    if (!this._configuration) {
      throw new Error("Configuration is required for OllamaProvider.");
    }

    return new OllamaProvider(
      this._id,
      this._name,
      this._context,
      this._configuration,
      this._metadata,
      this._transport
    );
  }
}
