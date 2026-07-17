import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IMemoryStore } from "../memory/IMemoryStore";
import { IResearchEngine } from "../research/interfaces";
import { IStrategyEngine } from "../strategy/interfaces";
import { IChannelEngine } from "../channel/interfaces";
import { IScriptEngine } from "../script/interfaces";
import { IAssetEngine } from "../assets/interfaces";
import { IProductionEngine } from "../production/interfaces";
import { IGenerationEngine } from "../generation/interfaces";

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
  readonly channelEngine?: IChannelEngine;
  readonly scriptEngine?: IScriptEngine;
  readonly assetEngine?: IAssetEngine;
  readonly productionEngine?: IProductionEngine;
  readonly generationEngine?: IGenerationEngine;
}
