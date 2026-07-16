import { ExecutionStrategy } from "./ExecutionStrategy";

export interface TeamSchedule {
  readonly strategy: ExecutionStrategy;
  readonly startTime: Date;
}
