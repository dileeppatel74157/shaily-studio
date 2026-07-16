import { ILLMRouter } from "../router/ILLMRouter";
import { ISecurity } from "../security/ISecurity";
import { IObservability } from "../observability/IObservability";
import { IMessageBus } from "../messagebus/IMessageBus";
import { ILogger } from "../logger/ILogger";
import { IConversationManager } from "../conversation/IConversationManager";
import { IPromptRegistry } from "../prompts/IPromptRegistry";

export interface AIEngineContext {
  readonly env?: string;
  readonly namespace?: string;
  readonly logger?: ILogger;
  readonly router: ILLMRouter;
  readonly security?: ISecurity;
  readonly observability?: IObservability;
  readonly messageBus?: IMessageBus;
  readonly conversationManager?: IConversationManager;
  readonly promptRegistry?: IPromptRegistry;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
