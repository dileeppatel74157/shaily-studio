import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IJobEngine } from "../jobs/IJobEngine";
import { IMemoryStore } from "../memory/IMemoryStore";

export interface AgentContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus: IEventBus;
  readonly jobEngine: IJobEngine;
  readonly memoryStore: IMemoryStore;
}
