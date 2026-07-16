export interface AgentTaskAssignment {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly assigneeId: string;
  readonly assignerId: string;
  readonly status: "pending" | "accepted" | "rejected" | "processing" | "completed" | "failed" | "cancelled";
  readonly progress: number; // 0 to 100
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
