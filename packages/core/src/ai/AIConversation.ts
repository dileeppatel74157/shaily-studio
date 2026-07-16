import { AIMessage } from "./AIMessage";

export interface AIConversation {
  readonly id: string;
  readonly messages: readonly AIMessage[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
