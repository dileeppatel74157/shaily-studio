export interface AIMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly name?: string;
  readonly toolCallId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
