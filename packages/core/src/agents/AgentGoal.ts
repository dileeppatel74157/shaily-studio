export interface AgentGoal {
  readonly id: string;
  readonly description: string;
  readonly priority: number;
  readonly status: "pending" | "active" | "completed" | "failed";
}
