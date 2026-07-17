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
  readonly workflows?: ReadonlyArray<string>;
  readonly skills?: ReadonlyArray<string>;
  readonly choice?: {
    readonly type: "tool" | "workflow" | "skill";
    readonly targetId: string;
  };
  readonly output?: unknown;
  readonly error?: string;
}
