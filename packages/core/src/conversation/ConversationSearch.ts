import { ConversationRole } from "./ConversationRole";

export interface ConversationSearch {
  readonly query?: string;
  readonly roles?: readonly ConversationRole[];
  readonly conversationIds?: readonly string[];
  readonly tags?: readonly string[];
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly sessionIds?: readonly string[];
}
