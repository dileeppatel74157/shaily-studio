import { Conversation } from "./Conversation";
import { ConversationMessage } from "./ConversationMessage";
import { ConversationHistory } from "./ConversationHistory";
import { ConversationSummary } from "./ConversationSummary";
import { ConversationSearch } from "./ConversationSearch";
import { ConversationSearchResult } from "./ConversationSearchResult";
import { ConversationSnapshot } from "./ConversationSnapshot";
import { ConversationMetadata } from "./ConversationMetadata";
import { ConversationSession } from "./ConversationSession";

export interface IConversationManager {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  createConversation(
    metadata?: ConversationMetadata
  ): Promise<Conversation>;

  deleteConversation(
    conversationId: string
  ): Promise<void>;

  getConversation(
    conversationId: string
  ): Conversation | undefined;

  listConversations(): readonly Conversation[];

  appendMessage(
    conversationId: string,
    message: ConversationMessage
  ): Promise<void>;

  history(
    conversationId: string
  ): ConversationHistory;

  summarize(
    conversationId: string
  ): Promise<ConversationSummary>;

  search(
    query: ConversationSearch
  ): readonly ConversationSearchResult[];

  snapshot(): ConversationSnapshot;

  // Extensible methods for message editing, soft delete and sessions
  editMessage(
    conversationId: string,
    messageId: string,
    content: string
  ): Promise<void>;

  softDeleteMessage(
    conversationId: string,
    messageId: string
  ): Promise<void>;

  createSession(sessionId?: string): Promise<ConversationSession>;
  getSession(sessionId: string): ConversationSession | undefined;
}
