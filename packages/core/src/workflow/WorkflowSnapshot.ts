import { WorkflowState } from "./WorkflowState";
import { WorkflowStepStatus } from "./WorkflowStep";

export interface WorkflowStepSnapshot {
  readonly id: string;
  readonly name: string;
  readonly agentId: string;
  readonly priority: number;
  readonly input: unknown;
  readonly output?: unknown;
  readonly status: WorkflowStepStatus;
  readonly error?: string;
}

export interface WorkflowSnapshot {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly state: WorkflowState;
  readonly metadata: Record<string, unknown>;
  readonly steps: ReadonlyArray<WorkflowStepSnapshot>;
  readonly timestamp: Date;
}
