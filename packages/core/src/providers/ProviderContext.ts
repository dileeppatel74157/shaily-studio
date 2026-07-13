import { ILogger } from "../logger/ILogger";
import { IConfig } from "../config/IConfig";
import { IMemoryStore } from "../memory/IMemoryStore";
import { IEventBus } from "../events/IEventBus";

export interface ProviderContext {
  readonly logger: ILogger;
  readonly config: IConfig;
  readonly memoryStore: IMemoryStore;
  readonly eventBus: IEventBus;
}
