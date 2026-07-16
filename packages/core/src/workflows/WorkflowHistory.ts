import { WorkflowStepResult } from "./WorkflowStepResult";

export interface WorkflowHistory {
  readonly executionId: string;
  readonly workflowId: string;
  readonly stepResults: readonly WorkflowStepResult[];
  readonly events: readonly {
    readonly timestamp: Date;
    readonly event: string;
    readonly details?: Record<string, any>;
  }[];
}
