import { WorkflowStepResult } from "./WorkflowStepResult";
import { WorkflowStatistics } from "./WorkflowStatistics";

export type WorkflowExecutionStatus = "COMPLETED" | "FAILED" | "CANCELLED";

export interface WorkflowExecutionResult {
  readonly executionId: string;
  readonly workflowId: string;
  readonly status: WorkflowExecutionStatus;
  readonly output?: any;
  readonly variables: Record<string, any>;
  readonly history: readonly WorkflowStepResult[];
  readonly statistics: WorkflowStatistics;
  readonly error?: string;
}
