import { JobPriority } from "../jobs/JobPriority";

export enum WorkflowStepStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface WorkflowStep {
  readonly id: string;
  readonly name: string;
  readonly agentId: string;
  readonly priority: JobPriority;
  readonly input: unknown;
  output?: unknown;
  status: WorkflowStepStatus;
  error?: string;
}
