import { ReadinessState } from "./ReadinessState";
import { ReadinessReport } from "./ReadinessReport";

export interface ReadinessSnapshot {
  readonly lifecycleState: ReadinessState;
  readonly latestReport: ReadinessReport | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly timestamps: Readonly<{
    readonly initializedAt: Date | null;
    readonly startedAt: Date | null;
    readonly stoppedAt: Date | null;
  }>;
}
