import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IAIEngine } from "../ai/IAIEngine";
import { IPlanningEngine } from "../planning/IPlanningEngine";
import { IConversationManager } from "../conversation/IConversationManager";
import { IWorkflowEngine } from "../workflow/IWorkflowEngine";
import { IAgentRegistry } from "../agents/IAgentRegistry";
import { IResearchEngine } from "../research/interfaces";
import { IStrategyEngine } from "../strategy/interfaces";
import { IChannelEngine } from "../channel/interfaces";
import { IScriptEngine } from "../script/interfaces";
import { IAssetEngine } from "../assets/interfaces";

export interface MemoryContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus: IEventBus;

  readonly aiEngine?: IAIEngine;
  readonly planningEngine?: IPlanningEngine;
  readonly conversationManager?: IConversationManager;
  readonly workflowEngine?: IWorkflowEngine;
  readonly agentRegistry?: IAgentRegistry;
  readonly researchEngine?: IResearchEngine;
  readonly strategyEngine?: IStrategyEngine;
  readonly channelEngine?: IChannelEngine;
  readonly scriptEngine?: IScriptEngine;
  readonly assetEngine?: IAssetEngine;
}
