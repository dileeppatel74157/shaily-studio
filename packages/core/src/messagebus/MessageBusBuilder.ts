import { IMessageBus } from "./IMessageBus";
import { MessageBus } from "./MessageBus";
import { MessageContext } from "./MessageContext";
import { MessageRetryPolicy } from "./MessageRetryPolicy";
import { MessageValidationException } from "./types";

export class MessageBusBuilder {
  private _context?: MessageContext;
  private _retryPolicy?: MessageRetryPolicy;
  private _metadata: Record<string, any> = {};

  public withContext(context: MessageContext): this {
    this._context = context;
    return this;
  }

  public withRetryPolicy(retryPolicy: MessageRetryPolicy): this {
    this._retryPolicy = retryPolicy;
    return this;
  }

  public withMetadata(metadata: Record<string, any>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IMessageBus {
    if (!this._context) {
      throw new MessageValidationException(
        "MessageContext is required to build MessageBus."
      );
    }

    const finalRetryPolicy: MessageRetryPolicy = this._retryPolicy || {
      maxRetries: 3,
      delay: 100,
      exponential: true,
      backoff: 2,
    };

    const finalContext: MessageContext = {
      ...this._context,
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return new MessageBus(finalContext, finalRetryPolicy);
  }
}
