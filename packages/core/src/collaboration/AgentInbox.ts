import { AgentMessage } from "./AgentMessage";

export interface AgentInbox {
  readonly agentId: string;
  receive(message: AgentMessage): Promise<void>;
  list(filter?: (msg: AgentMessage) => boolean): Promise<ReadonlyArray<AgentMessage>>;
  unread(): Promise<ReadonlyArray<AgentMessage>>;
  clear(): Promise<void>;
  snapshot(): ReadonlyArray<AgentMessage>;
}
