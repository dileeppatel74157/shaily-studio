import { PlanStatus } from "./PlanStatus";
import { PlanReflection } from "./PlanReflection";

export interface PlanExecution {
  readonly id: string;
  readonly planId: string;
  readonly status: PlanStatus;
  readonly startTime: Date;
  readonly endTime?: Date;
  readonly latencyMs?: number;
  readonly executionTimeMs?: number;
  readonly planningLatencyMs?: number;
  readonly retries: number;
  readonly successRate: number;
  readonly failuresCount: number;
  readonly replansCount: number;
  readonly reflections: ReadonlyArray<PlanReflection>;
  readonly error?: string;
}
