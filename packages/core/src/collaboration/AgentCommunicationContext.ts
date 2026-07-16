import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IAgentRegistry } from "../agents/IAgentRegistry";

export interface AgentCommunicationContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus: IEventBus;
  readonly agentRegistry?: IAgentRegistry;
}
