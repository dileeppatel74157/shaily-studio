import { ILogger } from "../logger/ILogger";

export interface MessageContext {
  readonly logger: ILogger;
  readonly metadata: Readonly<Record<string, any>>;
}
