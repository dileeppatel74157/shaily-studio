import { Provider, ProviderHandler } from "./Provider";
import { ProviderContext } from "./ProviderContext";
import { ProviderConfiguration } from "./ProviderConfiguration";
import { ProviderType } from "./ProviderType";
import { ProviderFeature } from "./ProviderFeature";
import { ProviderCapabilities } from "./ProviderCapability";
import { ProviderRequest } from "./ProviderRequest";
import { ProviderResponse, ProviderResponseChunk } from "./ProviderResponse";
import { ProviderValidationException } from "./types";
import { ModelDescriptor } from "../router/ModelDescriptor";

class ConcreteProvider extends Provider {
  public get models(): readonly ModelDescriptor[] {
    return [];
  }

  protected async performExecute(request: ProviderRequest): Promise<ProviderResponse> {
    return {
      responseId: "resp-123",
      providerId: this.id,
      model: request.model || "gpt-4",
      content: "Default mock response content",
      text: "Default mock response content",
      latency: 10,
    };
  }

  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    yield {
      chunkId: "chunk-123",
      content: "Default mock stream chunk response content",
    };
  }
}

export class ProviderBuilder {
  private _id?: string;
  private _name?: string;
  private _version = "1.0.0";
  private _type?: ProviderType;
  private _capabilities?: readonly ProviderFeature[];
  private _oldCapabilities?: ProviderCapabilities;
  private _context?: ProviderContext;
  private _configuration?: ProviderConfiguration;
  private _handler?: ProviderHandler;
  private _metadata: Record<string, unknown> = {};

  public withId(id: string): this {
    this._id = id;
    return this;
  }

  public withName(name: string): this {
    this._name = name;
    return this;
  }

  public withVersion(version: string): this {
    this._version = version;
    return this;
  }

  public withType(type: ProviderType): this {
    this._type = type;
    return this;
  }

  public withCapabilities(capabilities: readonly ProviderFeature[] | Partial<ProviderCapabilities>): this {
    if (Array.isArray(capabilities)) {
      this._capabilities = capabilities;
    } else {
      this._oldCapabilities = {
        chat: false,
        vision: false,
        imageGeneration: false,
        audioInput: false,
        audioOutput: false,
        toolCalling: false,
        jsonMode: false,
        streaming: false,
        ...capabilities,
      };
    }
    return this;
  }

  public withContext(context: ProviderContext): this {
    this._context = context;
    return this;
  }

  public withConfiguration(configuration: ProviderConfiguration): this {
    this._configuration = configuration;
    return this;
  }

  public withHandler(handler: ProviderHandler): this {
    this._handler = handler;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public withCustomMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): Provider {
    // If constructed using handler/old way
    if (this._handler) {
      if (!this._name) throw new ProviderValidationException("Provider Name is required.");
      if (!this._context) throw new ProviderValidationException("Provider Context is required.");

      const metadata = {
        id: this._id || "default-id",
        name: this._name,
        version: this._version,
        capabilities: this._oldCapabilities || {
          chat: true,
          vision: false,
          imageGeneration: false,
          audioInput: false,
          audioOutput: false,
          toolCalling: false,
          jsonMode: false,
          streaming: false,
        },
      };

      return new ConcreteProvider(
        metadata,
        this._context,
        this._handler,
        this._metadata
      );
    }

    // New way
    if (!this._id) throw new ProviderValidationException("Provider ID is required.");
    if (!this._name) throw new ProviderValidationException("Provider Name is required.");
    if (!this._type) throw new ProviderValidationException("Provider Type is required.");
    if (!this._capabilities) throw new ProviderValidationException("Provider Capabilities are required.");
    if (!this._context) throw new ProviderValidationException("Provider Context is required.");
    if (!this._configuration) throw new ProviderValidationException("Provider Configuration is required.");

    return new ConcreteProvider(
      this._id,
      this._name,
      this._type,
      this._capabilities,
      this._context,
      this._configuration,
      this._metadata
    );
  }
}
