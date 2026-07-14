import { IMessageBus } from "./IMessageBus";
import { Message } from "./Message";
import { MessageEnvelope } from "./MessageEnvelope";
import { MessagePriority } from "./MessagePriority";
import { MessageState } from "./MessageState";
import { MessageHandler } from "./MessageHandler";
import { MessageSnapshot } from "./MessageSnapshot";
import { MessageContext } from "./MessageContext";
import { MessageRetryPolicy } from "./MessageRetryPolicy";
import { DeadLetterQueue } from "./DeadLetterQueue";
import { MessageQueue } from "./MessageQueue";
import { MessageValidator } from "./MessageValidator";
import { MessageDispatcher } from "./MessageDispatcher";
import {
  MessageValidationException,
  InvalidMessageStateException,
  deepFreeze,
} from "./types";

export class MessageBus implements IMessageBus {
  private readonly _queues = new Map<string, MessageQueue>();
  private readonly _subscriptions = new Map<
    string,
    { id: string; queue: string; handler: MessageHandler }
  >();
  private readonly _dlq = new DeadLetterQueue();
  private readonly _validator = new MessageValidator();
  private readonly _dispatcher: MessageDispatcher;
  private readonly _resolvers = new Map<
    string,
    {
      resolve: (msg: Message) => void;
      reject: (err: Error) => void;
      timeoutId?: any;
    }
  >();

  private readonly _subscriberIndices = new Map<string, number>();

  constructor(
    public readonly context: MessageContext,
    public readonly retryPolicy: MessageRetryPolicy
  ) {
    this._dispatcher = new MessageDispatcher(retryPolicy, this._dlq);
    deepFreeze(this.context);
    deepFreeze(this.retryPolicy);
  }

  public async publish(
    message: Message,
    options?: {
      priority?: MessagePriority;
      correlationId?: string;
      causationId?: string;
      headers?: Record<string, string>;
    }
  ): Promise<void> {
    this._validator.validateMessage(message);
    const priority = options?.priority || MessagePriority.NORMAL;
    this._validator.validatePriority(priority);
    const headers = options?.headers || {};
    this._validator.validateHeaders(headers);

    const correlationId = options?.correlationId || `corr-${Math.random()}`;
    const causationId = options?.causationId;

    const topic = message.type;
    const subs = Array.from(this._subscriptions.values()).filter(
      (s) => s.queue === topic
    );

    if (subs.length === 0) {
      const envelope = this.createEnvelope(
        message,
        correlationId,
        causationId,
        priority,
        headers
      );
      this.getOrCreateQueue(topic).enqueue(envelope);
      return;
    }

    for (const sub of subs) {
      const envelope = this.createEnvelope(
        message,
        correlationId,
        causationId,
        priority,
        headers
      );
      this.getOrCreateQueue(topic).enqueue(envelope);

      this._dispatcher
        .dispatch(envelope, sub.handler, (env, state, error) => {
          return this.transitionState(topic, env, state, error);
        })
        .catch(() => {});
    }
  }

  public async send(
    queue: string,
    message: Message,
    options?: {
      priority?: MessagePriority;
      correlationId?: string;
      causationId?: string;
      headers?: Record<string, string>;
    }
  ): Promise<void> {
    this._validator.validateMessage(message);
    const priority = options?.priority || MessagePriority.NORMAL;
    this._validator.validatePriority(priority);
    const headers = options?.headers || {};
    this._validator.validateHeaders(headers);

    const correlationId = options?.correlationId || `corr-${Math.random()}`;
    const causationId = options?.causationId;

    const subs = Array.from(this._subscriptions.values()).filter(
      (s) => s.queue === queue
    );

    if (subs.length === 0) {
      const envelope = this.createEnvelope(
        message,
        correlationId,
        causationId,
        priority,
        headers
      );
      this.getOrCreateQueue(queue).enqueue(envelope);
      return;
    }

    let nextIdx = this._subscriberIndices.get(queue) || 0;
    if (nextIdx >= subs.length) {
      nextIdx = 0;
    }
    const sub = subs[nextIdx];
    this._subscriberIndices.set(queue, nextIdx + 1);

    const envelope = this.createEnvelope(
      message,
      correlationId,
      causationId,
      priority,
      headers
    );
    this.getOrCreateQueue(queue).enqueue(envelope);

    this._dispatcher
      .dispatch(envelope, sub.handler, (env, state, error) => {
        return this.transitionState(queue, env, state, error);
      })
      .catch(() => {});
  }

  public async request(
    message: Message,
    options?: {
      queue?: string;
      priority?: MessagePriority;
      correlationId?: string;
      causationId?: string;
      headers?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<Message> {
    const correlationId = options?.correlationId || `req-${Math.random()}`;
    const queue = options?.queue || "requests";
    const timeout = options?.timeout || 5000;

    return new Promise<Message>((resolve, reject) => {
      let timeoutId: any;
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          this._resolvers.delete(correlationId);
          reject(new Error(`Request timed out after ${timeout}ms`));
        }, timeout);
      }

      this._resolvers.set(correlationId, { resolve, reject, timeoutId });

      this.send(queue, message, {
        priority: options?.priority,
        correlationId,
        causationId: options?.causationId,
        headers: options?.headers,
      }).catch((err) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this._resolvers.delete(correlationId);
        reject(err);
      });
    });
  }

  public async reply(correlationId: string, response: Message): Promise<void> {
    const resolver = this._resolvers.get(correlationId);
    if (!resolver) {
      throw new MessageValidationException(
        `No pending request resolver found for correlation ID: "${correlationId}"`
      );
    }

    if (resolver.timeoutId) {
      clearTimeout(resolver.timeoutId);
    }
    this._resolvers.delete(correlationId);
    resolver.resolve(response);
  }

  public subscribe(queue: string, handler: MessageHandler): string {
    if (!queue || queue.trim() === "") {
      throw new MessageValidationException("Queue name cannot be empty.");
    }
    if (!handler) {
      throw new MessageValidationException("Handler is required.");
    }

    const subscriptionId = `sub-${Math.random()}`;
    this._subscriptions.set(subscriptionId, {
      id: subscriptionId,
      queue,
      handler,
    });

    const q = this._queues.get(queue);
    if (q && q.size > 0) {
      setTimeout(() => {
        while (q.size > 0) {
          const envelope = q.dequeue();
          if (envelope) {
            this._dispatcher
              .dispatch(envelope, handler, (env, state, error) => {
                return this.transitionState(queue, env, state, error);
              })
              .catch(() => {});
          }
        }
      }, 0);
    }

    return subscriptionId;
  }

  public unsubscribe(subscriptionId: string): boolean {
    return this._subscriptions.delete(subscriptionId);
  }

  public snapshot(): MessageSnapshot {
    const queueSnaps = Array.from(this._queues.entries()).map(([name, q]) => ({
      name,
      size: q.size,
      messages: q.list(),
    }));

    return deepFreeze({
      timestamp: new Date(),
      queues: queueSnaps,
      subscriptionsCount: this._subscriptions.size,
      deadLetterCount: this._dlq.list().length,
      deadLetters: this._dlq.list(),
      metadata: this.context.metadata,
    });
  }

  private createEnvelope(
    message: Message,
    correlationId: string,
    causationId?: string,
    priority = MessagePriority.NORMAL,
    headers: Record<string, string> = {}
  ): MessageEnvelope {
    return deepFreeze({
      message,
      correlationId,
      causationId,
      timestamp: new Date(),
      priority,
      state: MessageState.CREATED,
      headers,
      retriesAttempted: 0,
    });
  }

  private getOrCreateQueue(name: string): MessageQueue {
    let q = this._queues.get(name);
    if (!q) {
      q = new MessageQueue();
      this._queues.set(name, q);
    }
    return q;
  }

  private transitionState(
    queueName: string,
    envelope: MessageEnvelope,
    newState: MessageState,
    error?: string
  ): MessageEnvelope {
    const current = envelope.state;
    let allowed = false;

    switch (current) {
      case MessageState.CREATED:
        allowed =
          newState === MessageState.QUEUED ||
          newState === MessageState.PROCESSING;
        break;
      case MessageState.QUEUED:
        allowed = newState === MessageState.PROCESSING;
        break;
      case MessageState.PROCESSING:
        allowed =
          newState === MessageState.COMPLETED ||
          newState === MessageState.FAILED ||
          newState === MessageState.DEAD_LETTER;
        break;
      case MessageState.FAILED:
        allowed =
          newState === MessageState.QUEUED ||
          newState === MessageState.PROCESSING ||
          newState === MessageState.DEAD_LETTER;
        break;
      default:
        allowed = false;
        break;
    }

    if (!allowed) {
      throw new InvalidMessageStateException(newState.toString() as any, current);
    }

    const q = this.getOrCreateQueue(queueName);

    const nextEnvelope: MessageEnvelope = deepFreeze({
      ...envelope,
      state: newState,
      retriesAttempted:
        newState === MessageState.FAILED
          ? envelope.retriesAttempted + 1
          : envelope.retriesAttempted,
      lastError: error || envelope.lastError,
    });

    const list = q.list() as MessageEnvelope[];
    const idx = list.findIndex((x) => x.message.id === envelope.message.id);
    if (idx !== -1) {
      const rawQueue = q as any;
      if (
        newState === MessageState.COMPLETED ||
        newState === MessageState.DEAD_LETTER
      ) {
        rawQueue._envelopes.splice(idx, 1);
      } else {
        rawQueue._envelopes[idx] = nextEnvelope;
      }
    }

    return nextEnvelope;
  }
}
