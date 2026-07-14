import { Tool } from "./Tool";
import { ITool } from "./ITool";
import { ToolMetadata } from "./ToolMetadata";
import { ToolContext } from "./ToolContext";
import { IToolHandler, ToolValidationException } from "./types";
import { ToolCapability } from "./ToolCapability";
import { ToolValidator } from "./ToolValidator";

export class ToolBuilder {
  private _id?: string;
  private _name?: string;
  private _version?: string;
  private _description?: string;
  private _author?: string;
  private _capabilities: ToolCapability[] = [];
  private _context?: ToolContext;
  private _handler?: IToolHandler;

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

  public withDescription(description: string): this {
    this._description = description;
    return this;
  }

  public withAuthor(author: string): this {
    this._author = author;
    return this;
  }

  public withCapability(capability: ToolCapability): this {
    this._capabilities.push(capability);
    return this;
  }

  public withCapabilities(capabilities: readonly ToolCapability[]): this {
    this._capabilities = [...capabilities];
    return this;
  }

  public withContext(context: ToolContext): this {
    this._context = context;
    return this;
  }

  public withHandler(handler: IToolHandler): this {
    this._handler = handler;
    return this;
  }

  public withMetadata(metadata: ToolMetadata): this {
    this._id = metadata.id;
    this._name = metadata.name;
    this._version = metadata.version;
    this._description = metadata.description;
    this._author = metadata.author;
    this._capabilities = [...metadata.capabilities];
    return this;
  }

  public build(): ITool {
    const metadata: ToolMetadata = {
      id: this._id || "",
      name: this._name || "",
      version: this._version || "",
      description: this._description || "",
      author: this._author || "",
      capabilities: Object.freeze([...this._capabilities]),
    };

    const validator = new ToolValidator();
    validator.validateMetadata(metadata);

    if (!this._context) {
      throw new ToolValidationException("Tool context is required.");
    }
    if (!this._handler) {
      throw new ToolValidationException("Tool execution handler is required.");
    }

    return new Tool(metadata, this._context, this._handler);
  }
}
