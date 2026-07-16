import { WorkflowState } from "./WorkflowState";

export interface WorkflowSnapshot {
  readonly state: WorkflowState;
  readonly workflowCount: number;
  readonly activeExecutions: number;
  readonly timestamp: Date;
  readonly workflowIds: readonly string[];
}
