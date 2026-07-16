export type AgentPresenceStatus = "ONLINE" | "BUSY" | "IDLE" | "OFFLINE";

export interface AgentPresence {
  readonly agentId: string;
  readonly status: AgentPresenceStatus;
  readonly lastSeen: Date;
  readonly availability: boolean;
}
