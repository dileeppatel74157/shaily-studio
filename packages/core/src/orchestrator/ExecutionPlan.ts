import { ExecutionStep } from "./ExecutionStep";

export interface ExecutionPlan {
  readonly id: string;
  readonly steps: ReadonlyArray<ExecutionStep>;
  readonly metadata?: Record<string, unknown>;
}
