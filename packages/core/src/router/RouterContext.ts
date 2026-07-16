import { ILogger } from "../logger/ILogger";
import { ProviderRegistry } from "../providers/ProviderRegistry";
import { IConfig } from "../config/IConfig";
import { IEventBus } from "../events/IEventBus";

export interface RouterContext {
  readonly logger: ILogger;
  readonly providerRegistry: ProviderRegistry;
  readonly config: IConfig;
  readonly eventBus?: IEventBus;
}
