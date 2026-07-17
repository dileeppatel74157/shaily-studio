import { ExecutionHealth } from "./ExecutionHealth";

export interface ExecutionReport {
  readonly timestamp: Date;
  readonly activeSessionsCount: number;
  readonly completedSessionsCount: number;
  readonly failedSessionsCount: number;
  readonly incidentCount: number;
  readonly averageLatencyMs: number;
  readonly totalTokensConsumed: number;
  readonly totalCostConsumed: number;
  readonly health: ExecutionHealth;
}
