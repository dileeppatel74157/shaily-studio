import { IConversationManager } from "./IConversationManager";
import { ConversationManager } from "./ConversationManager";
import { ConversationContext } from "./ConversationContext";
import { ConversationValidator } from "./ConversationValidator";
import { IAIEngine } from "../ai/IAIEngine";
import { ISecurity } from "../security/ISecurity";
import { IObservability } from "../observability/IObservability";
import { IMessageBus } from "../messagebus/IMessageBus";
import { ILogger } from "../logger/ILogger";
import { ConversationValidationException } from "./types";

export class ConversationBuilder {
  private _context?: ConversationContext;
  private _aiEngine?: IAIEngine;
  private _security?: ISecurity;
  private _observability?: IObservability;
  private _messageBus?: IMessageBus;
  private _logger?: ILogger;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: ConversationContext): this {
    this._context = context;
    return this;
  }

  public withRouter(router: any): this {
    // backward compatibility
    return this;
  }

  public withAIEngine(aiEngine: IAIEngine): this {
    this._aiEngine = aiEngine;
    return this;
  }

  public withSecurity(security: ISecurity): this {
    this._security = security;
    return this;
  }

  public withObservability(observability: IObservability): this {
    this._observability = observability;
    return this;
  }

  public withMessageBus(messageBus: IMessageBus): this {
    this._messageBus = messageBus;
    return this;
  }

  public withLogger(logger: ILogger): this {
    this._logger = logger;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IConversationManager {
    if (!this._context) {
      throw new ConversationValidationException(
        "ConversationContext is required to build ConversationManager."
      );
    }

    let finalAIEngine = this._aiEngine;
    let finalSecurity = this._security;
    let finalObservability = this._observability;
    let finalMessageBus = this._messageBus;
    let finalLogger = this._logger;
    let env: string | undefined;
    let namespace: string | undefined;
    let contextMetadata = {};

    if (this._context) {
      finalAIEngine = finalAIEngine || this._context.aiEngine;
      finalSecurity = finalSecurity || this._context.security;
      finalObservability = finalObservability || this._context.observability;
      finalMessageBus = finalMessageBus || this._context.messageBus;
      finalLogger = finalLogger || this._context.logger;
      env = this._context.env;
      namespace = this._context.namespace;
      contextMetadata = this._context.metadata || {};
    }

    const context: ConversationContext = {
      env,
      namespace,
      logger: finalLogger,
      aiEngine: finalAIEngine,
      security: finalSecurity,
      observability: finalObservability,
      messageBus: finalMessageBus,
      metadata: { ...contextMetadata, ...this._metadata },
    };

    ConversationValidator.validateContext(context);

    return new ConversationManager(context, this._metadata);
  }
}
