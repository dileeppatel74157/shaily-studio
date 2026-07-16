export interface ConversationAttachment {
  readonly id: string;
  readonly type: string;
  readonly data: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
