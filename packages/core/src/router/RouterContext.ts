import { ILogger } from "../logger/ILogger";
import { ProviderRegistry } from "../providers/ProviderRegistry";
import { IConfig } from "../config/IConfig";

export interface RouterContext {
  readonly logger: ILogger;
  readonly providerRegistry: ProviderRegistry;
  readonly config: IConfig;
}
