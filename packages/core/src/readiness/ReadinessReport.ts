import { ReadinessResult } from "./ReadinessResult";

export enum ReadinessReportStatus {
  READY = "READY",
  DEGRADED = "DEGRADED",
  NOT_READY = "NOT_READY",
}

export interface ReadinessReport {
  readonly overallStatus: ReadinessReportStatus;
  readonly totalChecks: number;
  readonly passed: number;
  readonly warnings: number;
  readonly failed: number;
  readonly skipped: number;
  readonly duration: number;
  readonly checks: readonly ReadinessResult[];
  readonly timestamp: Date;
}
