import { Agent } from "./Agent";
import { AgentMetadata } from "./AgentMetadata";
import { AgentContext } from "./AgentContext";
import { AgentLifecycle } from "./AgentLifecycle";
import { AgentRole } from "./AgentRole";
import { AgentCapability } from "./AgentCapability";
import { AgentGoal } from "./AgentGoal";
import { AgentProfile } from "./AgentProfile";
import { AgentConfiguration } from "./AgentConfiguration";
import { AgentValidator } from "./AgentValidator";
import { deepFreeze } from "./types";

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
  private _role: AgentRole = "Generalist";
  private _version = "1.0.0";
  private _description = "";
  private _capabilities: AgentCapability[] = [];
  private _goals: AgentGoal[] = [];
  private _profile?: AgentProfile;
  private _configuration?: AgentConfiguration;
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

  public withRole(role: AgentRole): this {
    this._role = role;
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

  public withCapabilities(capabilities: AgentCapability[]): this {
    this._capabilities = [...capabilities];
    return this;
  }

  public withGoals(goals: AgentGoal[]): this {
    this._goals = goals.map((g) => deepFreeze({ ...g }));
    return this;
  }

  public withProfile(profile: AgentProfile): this {
    this._profile = deepFreeze({ ...profile });
    return this;
  }

  public withConfiguration(configuration: AgentConfiguration): this {
    this._configuration = configuration;
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

    AgentValidator.validateAgent({
      id: this._id,
      name: this._name,
      role: this._role,
      capabilities: this._capabilities,
    });

    const metadata: AgentMetadata = {
      id: this._id,
      name: this._name,
      role: this._role,
      version: this._version,
      description: this._description,
      capabilities: Object.freeze(this._capabilities),
      goals: Object.freeze(this._goals),
      profile: this._profile,
      configuration: this._configuration,
      metadata: Object.freeze(this._metadata),
    };

    return new Agent(metadata, this._context, this._lifecycle);
  }
}
