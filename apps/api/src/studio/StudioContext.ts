import {
  ILogger,
  IConfig,
  IServiceRegistry,
  IEventBus,
  IJobEngine,
  IMemoryStore,
  AgentRegistry,
  IWorkflowEngine,
  IKernel
} from "@shaily/core/api-gateway";

export interface StudioContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus: IEventBus;
  readonly jobs: IJobEngine;
  readonly memory: IMemoryStore;
  readonly agents: AgentRegistry;
  readonly workflow: IWorkflowEngine;
  readonly kernel: IKernel;
}
