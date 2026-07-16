import { PlanningRequest } from "./PlanningRequest";
import { Plan } from "./Plan";
import { PlanExecution } from "./PlanExecution";
import { PlanningSnapshot } from "./PlanningSnapshot";

export interface IPlanningEngine {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  createPlan(request: PlanningRequest): Promise<Plan>;
  execute(planId: string): Promise<PlanExecution>;
  reflect(planId: string, taskId?: string): Promise<void>;
  replan(planId: string): Promise<void>;
  cancel(planId: string): Promise<void>;
  snapshot(): PlanningSnapshot;
}
