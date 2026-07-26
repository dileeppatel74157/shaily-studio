import { Conversation } from "../models/Conversation";
import { ConversationMessage } from "../models/ConversationMessage";
import { ConversationHistory } from "../models/ConversationHistory";
import { ConversationSummary } from "../models/ConversationSummary";
import { ConversationSearch } from "../models/ConversationSearch";
import { ConversationSearchResult } from "../models/ConversationSearchResult";
import { ConversationSnapshot } from "../models/ConversationSnapshot";
import { ConversationMetadata } from "../models/ConversationMetadata";
import { ConversationSession } from "../models/ConversationSession";

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
