import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IJobEngine } from "../jobs/IJobEngine";
import { IMemoryStore } from "../memory/IMemoryStore";
import { AgentRegistry } from "../agents/AgentRegistry";
import { IWorkflowEngine } from "../workflow/IWorkflowEngine";
import { ILLMRouter } from "../router/ILLMRouter";

export interface OrchestratorContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus: IEventBus;
  readonly jobEngine: IJobEngine;
  readonly memoryStore: IMemoryStore;
  readonly agentRegistry: AgentRegistry;
  readonly workflowEngine: IWorkflowEngine;
  readonly llmRouter: ILLMRouter;
}
