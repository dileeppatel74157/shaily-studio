import { Message } from "./Message";
import { MessagePriority } from "./MessagePriority";
import { MessageHandler } from "./MessageHandler";
import { MessageSnapshot } from "./MessageSnapshot";

export interface IMessageBus {
  publish(
    message: Message,
    options?: {
      priority?: MessagePriority;
      correlationId?: string;
      causationId?: string;
      headers?: Record<string, string>;
    }
  ): Promise<void>;

  send(
    queue: string,
    message: Message,
    options?: {
      priority?: MessagePriority;
      correlationId?: string;
      causationId?: string;
      headers?: Record<string, string>;
    }
  ): Promise<void>;

  request(
    message: Message,
    options?: {
      queue?: string;
      priority?: MessagePriority;
      correlationId?: string;
      causationId?: string;
      headers?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<Message>;

  reply(correlationId: string, response: Message): Promise<void>;

  subscribe(queue: string, handler: MessageHandler): string;

  unsubscribe(subscriptionId: string): boolean;

  snapshot(): MessageSnapshot;
}
