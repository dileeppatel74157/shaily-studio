export interface ConversationMetadata {
  readonly name?: string;
  readonly tags?: readonly string[];
  readonly sessionReference?: string;
  readonly custom?: Readonly<Record<string, unknown>>;
}
