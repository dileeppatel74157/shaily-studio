import { AgentMessage } from "./AgentMessage";

export interface AgentConversationThread {
  readonly id: string;
  readonly conversationId: string;
  readonly participants: ReadonlyArray<string>;
  readonly history: ReadonlyArray<AgentMessage>;
  readonly lastMessageTimestamp: Date;
  readonly metadata: Record<string, unknown>;
}
