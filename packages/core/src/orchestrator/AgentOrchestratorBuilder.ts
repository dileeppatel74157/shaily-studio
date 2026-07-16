import { AgentOrchestrator } from "./AgentOrchestrator";
import { AgentOrchestratorContext } from "./AgentOrchestratorContext";
import { IAgentRegistry } from "../agents/IAgentRegistry";
import { IEventBus } from "../events/IEventBus";

export class AgentOrchestratorBuilder {
  private _context?: AgentOrchestratorContext;
  private _agentRegistry?: IAgentRegistry;
  private _eventBus?: IEventBus;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: AgentOrchestratorContext): this {
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

  public build(): AgentOrchestrator {
    if (!this._context) {
      throw new Error("Context is required to build AgentOrchestrator.");
    }
    const finalContext = {
      ...this._context,
      agentRegistry: this._agentRegistry || this._context.agentRegistry,
      eventBus: this._eventBus || this._context.eventBus,
    };
    return new AgentOrchestrator(finalContext, this._metadata);
  }
}
