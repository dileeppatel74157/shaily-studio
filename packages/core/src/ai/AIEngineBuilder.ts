import { IAIEngine } from "./IAIEngine";
import { AIEngine } from "./AIEngine";
import { AIEngineContext } from "./AIEngineContext";
import { AIEngineValidator } from "./AIEngineValidator";
import { ILLMRouter } from "../router/ILLMRouter";
import { ISecurity } from "../security/ISecurity";
import { IObservability } from "../observability/IObservability";
import { IMessageBus } from "../messagebus/IMessageBus";
import { ILogger } from "../logger/ILogger";
import { AIEngineValidationException } from "./types";

export class AIEngineBuilder {
  private _context?: AIEngineContext;
  private _router?: ILLMRouter;
  private _security?: ISecurity;
  private _observability?: IObservability;
  private _messageBus?: IMessageBus;
  private _logger?: ILogger;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: AIEngineContext): this {
    this._context = context;
    return this;
  }

  public withRouter(router: ILLMRouter): this {
    this._router = router;
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

  public build(): IAIEngine {
    let finalRouter = this._router;
    let finalSecurity = this._security;
    let finalObservability = this._observability;
    let finalMessageBus = this._messageBus;
    let finalLogger = this._logger;
    let env: string | undefined;
    let namespace: string | undefined;
    let contextMetadata = {};

    if (this._context) {
      finalRouter = finalRouter || this._context.router;
      finalSecurity = finalSecurity || this._context.security;
      finalObservability = finalObservability || this._context.observability;
      finalMessageBus = finalMessageBus || this._context.messageBus;
      finalLogger = finalLogger || this._context.logger;
      env = this._context.env;
      namespace = this._context.namespace;
      contextMetadata = this._context.metadata || {};
    }

    if (!finalRouter) {
      throw new AIEngineValidationException("Missing provider router: A router must be specified to build AIEngine.");
    }

    const context: AIEngineContext = {
      env,
      namespace,
      logger: finalLogger,
      router: finalRouter,
      security: finalSecurity,
      observability: finalObservability,
      messageBus: finalMessageBus,
      metadata: { ...contextMetadata, ...this._metadata },
    };

    AIEngineValidator.validateContext(context);

    return new AIEngine(context, this._metadata);
  }
}
