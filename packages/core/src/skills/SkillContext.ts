import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IServiceRegistry } from "../registry/IServiceRegistry";
import { IEventBus } from "../events/IEventBus";
import { IMemoryStore } from "../memory/IMemoryStore";

export interface SkillContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly registry: IServiceRegistry;
  readonly eventBus?: IEventBus;
  readonly memoryStore?: IMemoryStore;
}
