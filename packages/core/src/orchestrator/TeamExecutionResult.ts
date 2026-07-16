import { TeamExecution } from "./TeamExecution";

export interface TeamExecutionResult {
  readonly executionId: string;
  readonly status: "completed" | "failed";
  readonly output: Record<string, unknown>;
  readonly execution: TeamExecution;
}
