import { AgentMessage } from "./AgentMessage";

export interface AgentOutbox {
  readonly agentId: string;
  send(message: AgentMessage): Promise<void>;
  history(filter?: (msg: AgentMessage) => boolean): Promise<ReadonlyArray<AgentMessage>>;
  retry(messageId: string): Promise<boolean>;
  snapshot(): ReadonlyArray<AgentMessage>;
}
