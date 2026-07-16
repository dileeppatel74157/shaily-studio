import { ConversationMessage } from "./ConversationMessage";
import { ConversationMetadata } from "./ConversationMetadata";

export interface Conversation {
  readonly id: string;
  readonly sessionId?: string;
  readonly messages: readonly ConversationMessage[];
  readonly metadata: ConversationMetadata;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isDeleted: boolean;
}
