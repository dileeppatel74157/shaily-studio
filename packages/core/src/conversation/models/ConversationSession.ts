export interface ConversationSession {
  readonly id: string;
  readonly createdAt: Date;
  readonly lastActiveAt: Date;
  readonly conversationIds: readonly string[];
}
