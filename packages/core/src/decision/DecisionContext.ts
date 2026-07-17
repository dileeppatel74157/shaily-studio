import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IMemoryStore } from "../memory/IMemoryStore";
import { IResearchEngine } from "../research/interfaces";
import { IStrategyEngine } from "../strategy/interfaces";

export interface DecisionContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus?: IEventBus;
  readonly memoryStore?: IMemoryStore;
  readonly goalId?: string;
  readonly agentId?: string;
  readonly researchEngine?: IResearchEngine;
  readonly strategyEngine?: IStrategyEngine;
}
