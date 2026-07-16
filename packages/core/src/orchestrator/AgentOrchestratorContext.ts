import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IAgentRegistry } from "../agents/IAgentRegistry";
import { IPlanningEngine } from "../planning/IPlanningEngine";
import { IMemoryEngine } from "../memory/IMemoryEngine";
import { IAgentCommunication } from "../collaboration/IAgentCommunication";
import { IWorkflowEngine } from "../workflow/IWorkflowEngine";

export interface AgentOrchestratorContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus: IEventBus;
  readonly agentRegistry?: IAgentRegistry;
  readonly planningEngine?: IPlanningEngine;
  readonly memoryEngine?: IMemoryEngine;
  readonly collaborationEngine?: IAgentCommunication;
  readonly workflowEngine?: IWorkflowEngine;
}
