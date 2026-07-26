import { ILogger } from "../logger/ILogger";
import { IEventBus } from "../events/IEventBus";

export interface JobContext {
  readonly jobId: string;
  readonly correlationId: string;
  readonly logger: ILogger;
  readonly eventBus: IEventBus;
  readonly signal: AbortSignal;
}
