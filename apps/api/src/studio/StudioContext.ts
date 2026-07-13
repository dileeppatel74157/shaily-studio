import { ILogger } from "@shaily/core";
import { IConfig } from "@shaily/core";
import { IServiceRegistry } from "@shaily/core";
import { IEventBus } from "@shaily/core";
import { IJobEngine } from "@shaily/core";
import { IMemoryStore } from "@shaily/core";
import { AgentRegistry } from "@shaily/core";
import { IWorkflowEngine } from "@shaily/core";
import { IKernel } from "@shaily/core";

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
