import { Plugin } from "./Plugin";
import { IPlugin } from "./IPlugin";
import { PluginMetadata } from "./PluginMetadata";
import { PluginContext } from "./PluginContext";
import { IPluginLifecycle, PluginValidationException } from "./types";
import { PluginCapability } from "./PluginCapability";
import { PluginValidator } from "./PluginValidator";

export class PluginBuilder {
  private _id?: string;
  private _name?: string;
  private _version?: string;
  private _author?: string;
  private _description?: string;
  private _capabilities: PluginCapability[] = [];
  private _context?: PluginContext;
  private _delegate?: IPluginLifecycle;

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

  public withAuthor(author: string): this {
    this._author = author;
    return this;
  }

  public withDescription(description: string): this {
    this._description = description;
    return this;
  }

  public withCapability(capability: PluginCapability): this {
    this._capabilities.push(capability);
    return this;
  }

  public withCapabilities(capabilities: readonly PluginCapability[]): this {
    this._capabilities = [...capabilities];
    return this;
  }

  public withContext(context: PluginContext): this {
    this._context = context;
    return this;
  }

  public withDelegate(delegate: IPluginLifecycle): this {
    this._delegate = delegate;
    return this;
  }

  public withMetadata(metadata: PluginMetadata): this {
    this._id = metadata.id;
    this._name = metadata.name;
    this._version = metadata.version;
    this._author = metadata.author;
    this._description = metadata.description;
    this._capabilities = [...metadata.capabilities];
    return this;
  }

  public build(): IPlugin {
    const metadata: PluginMetadata = {
      id: this._id || "",
      name: this._name || "",
      version: this._version || "",
      author: this._author || "",
      description: this._description || "",
      capabilities: Object.freeze([...this._capabilities]),
    };

    const validator = new PluginValidator();
    validator.validateMetadata(metadata);

    if (!this._context) {
      throw new PluginValidationException("Plugin context is required.");
    }
    if (!this._delegate) {
      throw new PluginValidationException("Plugin lifecycle delegate is required.");
    }

    return new Plugin(metadata, this._context, this._delegate);
  }
}
