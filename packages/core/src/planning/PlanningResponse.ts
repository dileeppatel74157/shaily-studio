import { Plan } from "./Plan";

export interface PlanningResponse {
  readonly plan: Plan;
  readonly latencyMs: number;
}
