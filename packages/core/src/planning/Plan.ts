import { Goal } from "./Goal";
import { PlanStatus } from "./PlanStatus";
import { PlanTask } from "./PlanTask";
import { PlanDependency } from "./PlanDependency";
import { PlanningStrategy } from "./PlanningStrategy";

export interface Plan {
  readonly id: string;
  readonly goal: Goal;
  readonly strategy: PlanningStrategy;
  readonly status: PlanStatus;
  readonly tasks: ReadonlyArray<PlanTask>;
  readonly dependencies: ReadonlyArray<PlanDependency>;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: Date;
}
