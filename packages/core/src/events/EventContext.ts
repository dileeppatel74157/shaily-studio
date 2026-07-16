import { ILogger } from "../logger/ILogger";
import { IEventBus } from "./IEventBus";

export interface EventContext {
  readonly logger?: ILogger;
  readonly eventBus?: IEventBus;
  readonly correlationId?: string;
  readonly timestamp?: Date;
  readonly parentEventId?: string;
}
