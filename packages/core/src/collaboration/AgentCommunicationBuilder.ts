import { AgentCommunication } from "./AgentCommunication";
import { AgentCommunicationContext } from "./AgentCommunicationContext";
import { IAgentRegistry } from "../agents/IAgentRegistry";
import { IEventBus } from "../events/IEventBus";

export class AgentCommunicationBuilder {
  private _context?: AgentCommunicationContext;
  private _agentRegistry?: IAgentRegistry;
  private _eventBus?: IEventBus;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: AgentCommunicationContext): this {
    this._context = context;
    return this;
  }

  public withRegistry(registry: IAgentRegistry): this {
    this._agentRegistry = registry;
    return this;
  }

  public withEventBus(eventBus: IEventBus): this {
    this._eventBus = eventBus;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...metadata };
    return this;
  }

  public build(): AgentCommunication {
    if (!this._context) {
      throw new Error("Context is required to build AgentCommunication.");
    }
    const finalContext = {
      ...this._context,
      agentRegistry: this._agentRegistry || this._context.agentRegistry,
      eventBus: this._eventBus || this._context.eventBus,
    };
    return new AgentCommunication(finalContext, this._metadata);
  }
}
