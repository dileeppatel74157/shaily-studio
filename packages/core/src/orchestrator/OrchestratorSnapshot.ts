import { OrchestratorState } from "./OrchestratorState";

export interface OrchestratorSnapshot {
  readonly timestamp: Date;
  readonly state: OrchestratorState;
  readonly activeExecutionsCount: number;
  readonly totalExecutionsProcessed: number;
}
