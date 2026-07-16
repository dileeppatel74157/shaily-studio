import { AgentCommunicationState } from "./AgentCommunicationState";
import { AgentMessage } from "./AgentMessage";
import { AgentConversation } from "./AgentConversation";
import { AgentPresence } from "./AgentPresence";

export interface AgentCommunicationSnapshot {
  readonly timestamp: Date;
  readonly state: AgentCommunicationState;
  readonly messages: ReadonlyArray<AgentMessage>;
  readonly conversations: ReadonlyArray<AgentConversation>;
  readonly presenceList: ReadonlyArray<AgentPresence>;
}
