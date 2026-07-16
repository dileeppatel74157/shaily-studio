import { PlanningState } from "./PlanningState";
import { Plan } from "./Plan";
import { PlanExecution } from "./PlanExecution";

export interface PlanningSnapshot {
  readonly state: PlanningState;
  readonly planCount: number;
  readonly plans: ReadonlyArray<Plan>;
  readonly executions: ReadonlyArray<PlanExecution>;
  readonly timestamp: Date;
}
