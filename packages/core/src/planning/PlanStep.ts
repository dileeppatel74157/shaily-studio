export interface PlanStep {
  readonly id: string;
  readonly taskId: string;
  readonly name: string;
  readonly command: string;
  readonly status: "pending" | "running" | "completed" | "failed";
}
