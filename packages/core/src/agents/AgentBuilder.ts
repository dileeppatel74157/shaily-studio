import { Agent } from "./Agent";
import { AgentMetadata } from "./AgentMetadata";
import { AgentContext } from "./AgentContext";
import { AgentLifecycle } from "./AgentLifecycle";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class AgentBuilder {
  private _id = generateUUID();
  private _name?: string;
  private _version = "1.0.0";
  private _description = "";
  private _capabilities: string[] = [];
  private _metadata: Record<string, unknown> = {};
  private _context?: AgentContext;
  private _lifecycle?: AgentLifecycle;

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

  public withCapabilities(capabilities: string[]): this {
    this._capabilities = [...capabilities];
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public withContext(context: AgentContext): this {
    this._context = context;
    return this;
  }

  public withLifecycle(lifecycle: AgentLifecycle): this {
    this._lifecycle = lifecycle;
    return this;
  }

  public build(): Agent {
    if (!this._name) {
      throw new Error("Agent name is required to build an Agent.");
    }
    if (!this._context) {
      throw new Error("Agent context is required to build an Agent.");
    }
    if (!this._lifecycle) {
      throw new Error("Agent lifecycle implementation is required to build an Agent.");
    }

    const metadata: AgentMetadata = {
      id: this._id,
      name: this._name,
      version: this._version,
      description: this._description,
      capabilities: Object.freeze(this._capabilities),
      metadata: Object.freeze(this._metadata),
    };

    return new Agent(metadata, this._context, this._lifecycle);
  }
}
