import {
  ServiceToken,
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

export const LOGGER_TOKEN = new ServiceToken<ILogger>("logger");
export const CONFIG_TOKEN = new ServiceToken<IConfig>("config");
export const REGISTRY_TOKEN = new ServiceToken<IServiceRegistry>("registry");
export const EVENT_BUS_TOKEN = new ServiceToken<IEventBus>("eventBus");
export const JOB_ENGINE_TOKEN = new ServiceToken<IJobEngine>("jobEngine");
export const MEMORY_STORE_TOKEN = new ServiceToken<IMemoryStore>("memoryStore");
export const AGENT_REGISTRY_TOKEN = new ServiceToken<AgentRegistry>("agentRegistry");
export const WORKFLOW_ENGINE_TOKEN = new ServiceToken<IWorkflowEngine>("workflowEngine");
export const KERNEL_TOKEN = new ServiceToken<IKernel>("kernel");
