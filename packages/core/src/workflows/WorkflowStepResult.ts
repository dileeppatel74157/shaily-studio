import { WorkflowStepType } from "./WorkflowStep";

export type WorkflowStepStatus = "COMPLETED" | "FAILED" | "CANCELLED";

export interface WorkflowStepResult {
  readonly stepId: string;
  readonly stepName: string;
  readonly type: WorkflowStepType;
  readonly status: WorkflowStepStatus;
  readonly output?: any;
  readonly error?: string;
  readonly durationMs: number;
  readonly timestamp: Date;
  readonly retriesUsed?: number;
}
