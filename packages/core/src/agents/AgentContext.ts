import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IJobEngine } from "../jobs/IJobEngine";
import { IMemoryStore } from "../memory/IMemoryStore";
import { IAIEngine } from "../ai/IAIEngine";
import { IConversationManager } from "../conversation/IConversationManager";
import { IPromptRegistry } from "../prompts/IPromptRegistry";
import { IRAGEngine } from "../rag/IRAGEngine";
import { IToolRegistry } from "../tools/IToolRegistry";
import { IWorkflowEngine } from "../workflow/IWorkflowEngine";
import { IObservability } from "../observability/IObservability";
import { IScheduler } from "../scheduler/IScheduler";
import { IStorage } from "../storage/IStorage";
import { IResearchEngine } from "../research/interfaces";
import { IStrategyEngine } from "../strategy/interfaces";
import { IChannelEngine } from "../channel/interfaces";

export interface AgentContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus: IEventBus;
  readonly jobEngine: IJobEngine;
  readonly memoryStore: IMemoryStore;

  readonly aiEngine?: IAIEngine;
  readonly conversationManager?: IConversationManager;
  readonly promptRegistry?: IPromptRegistry;
  readonly ragEngine?: IRAGEngine;
  readonly toolRegistry?: IToolRegistry;
  readonly workflowEngine?: IWorkflowEngine;
  readonly observability?: IObservability;
  readonly scheduler?: IScheduler;
  readonly storage?: IStorage;
  readonly researchEngine?: IResearchEngine;
  readonly strategyEngine?: IStrategyEngine;
  readonly channelEngine?: IChannelEngine;
}
