import { Message } from "./Message";
import { MessagePriority } from "./MessagePriority";
import { MessageState } from "./MessageState";

export interface MessageEnvelope {
  readonly message: Message;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly timestamp: Date;
  readonly priority: MessagePriority;
  readonly state: MessageState;
  readonly headers: Readonly<Record<string, string>>;
  readonly retriesAttempted: number;
  readonly lastError?: string;
}
