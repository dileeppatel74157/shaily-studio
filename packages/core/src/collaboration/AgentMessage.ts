import { AgentMessageType } from "./AgentMessageType";
import { AgentMessagePriority } from "./AgentMessagePriority";
import { AgentMessageStatus } from "./AgentMessageStatus";

export interface AgentMessage {
  readonly id: string;
  readonly type: AgentMessageType;
  readonly priority: AgentMessagePriority;
  readonly status: AgentMessageStatus;
  readonly senderId: string;
  readonly recipientId: string;
  readonly conversationId: string;
  readonly threadId?: string;
  readonly replyToId?: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: Date;
  readonly expiresAt?: Date;
}
