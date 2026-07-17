import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IJobEngine } from "../jobs/IJobEngine";
import { IMemoryStore } from "../memory/IMemoryStore";
import { AgentRegistry } from "../agents/AgentRegistry";
import { ISkillRegistry } from "../skills/ISkillRegistry";

export interface WorkflowContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus: IEventBus;
  readonly jobEngine: IJobEngine;
  readonly memoryStore: IMemoryStore;
  readonly agentRegistry: AgentRegistry;
  readonly skillRegistry?: ISkillRegistry;
}
