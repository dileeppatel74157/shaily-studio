import { IAIEngine } from "../ai/IAIEngine";
import { ISecurity } from "../security/ISecurity";
import { IObservability } from "../observability/IObservability";
import { IMessageBus } from "../messagebus/IMessageBus";
import { ILogger } from "../logger/ILogger";

export interface PromptContext {
  readonly env?: string;
  readonly namespace?: string;
  readonly logger?: ILogger;
  readonly aiEngine?: IAIEngine;
  readonly security?: ISecurity;
  readonly observability?: IObservability;
  readonly messageBus?: IMessageBus;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
