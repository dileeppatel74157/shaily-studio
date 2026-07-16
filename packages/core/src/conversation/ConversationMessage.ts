import { ConversationRole } from "./ConversationRole";
import { ConversationAttachment } from "./ConversationAttachment";

export interface ConversationMessage {
  readonly id: string;
  readonly role: ConversationRole;
  readonly content: string;
  readonly timestamp: Date;
  readonly attachments?: readonly ConversationAttachment[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly edited?: boolean;
  readonly deleted?: boolean;
}
