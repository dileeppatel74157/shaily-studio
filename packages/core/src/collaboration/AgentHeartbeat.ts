export interface AgentHeartbeat {
  readonly agentId: string;
  readonly status: "ONLINE" | "BUSY" | "IDLE";
  readonly timestamp: Date;
  readonly loadFactor?: number;
}
