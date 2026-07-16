import { Goal } from "./Goal";
import { PlanningStrategy } from "./PlanningStrategy";

export interface PlanningRequest {
  readonly id: string;
  readonly goal: Goal;
  readonly strategy?: PlanningStrategy;
  readonly metadata?: Record<string, unknown>;
}
