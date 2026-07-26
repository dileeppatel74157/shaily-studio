export interface ConversationMemory {
  readonly conversationId: string;
  readonly keyFacts: readonly string[];
  readonly entities: readonly string[];
  readonly custom?: Readonly<Record<string, unknown>>;
}
