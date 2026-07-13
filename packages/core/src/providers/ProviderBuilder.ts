import { Provider } from "./Provider";
import { ProviderMetadata } from "./ProviderMetadata";
import { ProviderCapabilities } from "./ProviderCapability";
import { ProviderContext } from "./ProviderContext";
import { ProviderHandler } from "./Provider";
import { ProviderValidator } from "./ProviderValidator";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ProviderBuilder {
  private _id = generateUUID();
  private _name?: string;
  private _version = "1.0.0";
  private _capabilities: ProviderCapabilities = {
    chat: false,
    vision: false,
    imageGeneration: false,
    audioInput: false,
    audioOutput: false,
    toolCalling: false,
    jsonMode: false,
    streaming: false,
  };
  private _context?: ProviderContext;
  private _handler?: ProviderHandler;
  private _customMetadata: Record<string, unknown> = {};

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

  public withCapabilities(capabilities: Partial<ProviderCapabilities>): this {
    this._capabilities = {
      ...this._capabilities,
      ...capabilities,
    };
    return this;
  }

  public withContext(context: ProviderContext): this {
    this._context = context;
    return this;
  }

  public withHandler(handler: ProviderHandler): this {
    this._handler = handler;
    return this;
  }

  public withCustomMetadata(metadata: Record<string, unknown>): this {
    this._customMetadata = { ...metadata };
    return this;
  }

  public build(): Provider {
    if (!this._name) {
      throw new Error("Provider name is required.");
    }
    if (!this._context) {
      throw new Error("Provider context is required.");
    }
    if (!this._handler) {
      throw new Error("Provider handler is required.");
    }

    const metadata: ProviderMetadata = {
      id: this._id,
      name: this._name,
      version: this._version,
      capabilities: this._capabilities,
    };

    const validator = new ProviderValidator();
    validator.validateMetadata(metadata);

    return new Provider(metadata, this._context, this._handler, this._customMetadata);
  }
}
