import { ConversationMessage } from "./ConversationMessage";

export interface ConversationHistory {
  readonly conversationId: string;
  readonly messages: readonly ConversationMessage[];
  readonly version: number;
}
