import { AgentMessage } from "./AgentMessage";

export interface AgentBroadcast {
  readonly id: string;
  readonly senderId: string;
  readonly message: AgentMessage;
  readonly recipients: ReadonlyArray<string>;
  readonly scope: "unicast" | "multicast" | "broadcast";
  readonly timestamp: Date;
}
