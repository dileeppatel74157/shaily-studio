import { MessageEnvelope } from "./MessageEnvelope";
import { MessageHandler } from "./MessageHandler";
import { MessageRetryPolicy } from "./MessageRetryPolicy";
import { DeadLetterQueue } from "./DeadLetterQueue";
import { MessageState } from "./MessageState";

export class MessageDispatcher {
  constructor(
    private readonly _retryPolicy: MessageRetryPolicy,
    private readonly _dlq: DeadLetterQueue
  ) {}

  public async dispatch(
    envelope: MessageEnvelope,
    handler: MessageHandler,
    onStateTransition: (
      env: MessageEnvelope,
      newState: MessageState,
      error?: string
    ) => MessageEnvelope
  ): Promise<void> {
    let currentEnvelope = onStateTransition(envelope, MessageState.PROCESSING);

    try {
      await handler(currentEnvelope);
      onStateTransition(currentEnvelope, MessageState.COMPLETED);
    } catch (err: any) {
      const errorMsg = err.message || "Unknown error";
      currentEnvelope = onStateTransition(
        currentEnvelope,
        MessageState.FAILED,
        errorMsg
      );

      if (currentEnvelope.retriesAttempted <= this._retryPolicy.maxRetries) {
        const attempts = currentEnvelope.retriesAttempted;
        let delay = this._retryPolicy.delay;
        if (this._retryPolicy.exponential) {
          delay = delay * Math.pow(this._retryPolicy.backoff, attempts);
        }

        setTimeout(() => {
          const retriedEnvelope = onStateTransition(
            currentEnvelope,
            MessageState.QUEUED
          );
          this.dispatch(retriedEnvelope, handler, onStateTransition).catch(
            () => {}
          );
        }, delay);
      } else {
        const dlqEnvelope = onStateTransition(
          currentEnvelope,
          MessageState.DEAD_LETTER
        );
        this._dlq.add(dlqEnvelope, errorMsg);
      }
    }
  }
}
