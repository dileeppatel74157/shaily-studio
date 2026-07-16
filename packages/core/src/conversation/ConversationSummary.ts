export interface ConversationSummary {
  readonly conversationId: string;
  readonly firstMessageSnippet?: string;
  readonly latestMessageSnippet?: string;
  readonly messageCount: number;
  readonly roles: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly estimatedTokenCount: number;
  readonly tags: readonly string[];
}
