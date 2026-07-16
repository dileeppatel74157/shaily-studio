export interface AgentConversation {
  readonly id: string;
  readonly participants: ReadonlyArray<string>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
