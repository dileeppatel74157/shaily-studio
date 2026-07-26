import { ConversationMessage } from "./ConversationMessage";

export interface ConversationSearchResult {
  readonly conversationId: string;
  readonly message: ConversationMessage;
  readonly score: number;
}
