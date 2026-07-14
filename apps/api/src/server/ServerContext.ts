import { ILogger, IConfig } from "@shaily/core";

export interface ServerContext {
  readonly logger: ILogger;
  readonly config: IConfig;
}
