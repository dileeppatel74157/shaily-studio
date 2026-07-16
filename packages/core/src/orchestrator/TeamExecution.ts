import { ExecutionStrategy } from "./ExecutionStrategy";
import { TeamTask } from "./TeamTask";
import { ExecutionMetrics } from "./ExecutionMetrics";

export interface TeamExecution {
  readonly id: string;
  readonly teamId: string;
  readonly strategy: ExecutionStrategy;
  readonly tasks: ReadonlyArray<TeamTask>;
  readonly metrics: ExecutionMetrics;
  readonly status: "pending" | "running" | "completed" | "failed";
  readonly startTime: Date;
  readonly endTime?: Date;
}
