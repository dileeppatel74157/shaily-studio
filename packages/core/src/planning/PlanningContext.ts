import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IAIEngine } from "../ai/IAIEngine";
import { IWorkflowEngine } from "../workflow/IWorkflowEngine";
import { IToolRegistry } from "../tools/IToolRegistry";
import { IConversationManager } from "../conversation/IConversationManager";
import { IAgentRegistry } from "../agents/IAgentRegistry";
import { IScheduler } from "../scheduler/IScheduler";
import { IStorage } from "../storage/IStorage";
import { IObservability } from "../observability/IObservability";
import { IResearchEngine } from "../research/interfaces";
import { IStrategyEngine } from "../strategy/interfaces";
import { IChannelEngine } from "../channel/interfaces";
import { IScriptEngine } from "../script/interfaces";
import { IAssetEngine } from "../assets/interfaces";
import { IProductionEngine } from "../production/interfaces";
import { IGenerationEngine } from "../generation/interfaces";
import { ICompositionEngine } from "../video-composition/interfaces";

export interface PlanningContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus: IEventBus;

  readonly aiEngine?: IAIEngine;
  readonly workflowEngine?: IWorkflowEngine;
  readonly toolRegistry?: IToolRegistry;
  readonly conversationManager?: IConversationManager;
  readonly agentRegistry?: IAgentRegistry;
  readonly scheduler?: IScheduler;
  readonly storage?: IStorage;
  readonly observability?: IObservability;
  readonly researchEngine?: IResearchEngine;
  readonly strategyEngine?: IStrategyEngine;
  readonly channelEngine?: IChannelEngine;
  readonly scriptEngine?: IScriptEngine;
  readonly assetEngine?: IAssetEngine;
  readonly productionEngine?: IProductionEngine;
  readonly generationEngine?: IGenerationEngine;
  readonly compositionEngine?: ICompositionEngine;
}
