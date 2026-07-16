import { ConversationState } from "./ConversationState";

export interface ConversationSnapshot {
  readonly id: string;
  readonly state: ConversationState;
  readonly initializedAt?: Date;
  readonly startedAt?: Date;
  readonly stoppedAt?: Date;
  readonly conversationCount: number;
  readonly sessionCount: number;
  readonly totalMessageCount: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly timestamp: Date;
}
