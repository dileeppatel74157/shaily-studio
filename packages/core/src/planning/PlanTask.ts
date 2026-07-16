import { PlanPriority } from "./PlanPriority";

export interface PlanTask {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priority: PlanPriority;
  readonly dependencies: ReadonlyArray<string>;
  readonly status: "pending" | "running" | "completed" | "failed" | "cancelled";
  readonly estimatedDurationMs?: number;
  readonly tools?: ReadonlyArray<string>;
  readonly output?: unknown;
  readonly error?: string;
}
