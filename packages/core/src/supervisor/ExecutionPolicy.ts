import { ExecutionLimits } from "./ExecutionLimits";
import { ExecutionBudget } from "./ExecutionBudget";

export interface ExecutionPolicy {
  readonly id: string;
  readonly name: string;
  readonly limits: ExecutionLimits;
  readonly budget: ExecutionBudget;
  readonly allowedRecoveries: ReadonlyArray<"retry" | "rollback" | "resume" | "restart" | "alternative" | "shutdown">;
}
