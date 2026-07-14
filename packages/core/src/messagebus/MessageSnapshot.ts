import { DeadLetterRecord } from "./DeadLetterQueue";
import { MessageEnvelope } from "./MessageEnvelope";

export interface QueueSnapshot {
  readonly name: string;
  readonly size: number;
  readonly messages: readonly MessageEnvelope[];
}

export interface MessageSnapshot {
  readonly timestamp: Date;
  readonly queues: readonly QueueSnapshot[];
  readonly subscriptionsCount: number;
  readonly deadLetterCount: number;
  readonly deadLetters: readonly DeadLetterRecord[];
  readonly metadata: Readonly<Record<string, any>>;
}
