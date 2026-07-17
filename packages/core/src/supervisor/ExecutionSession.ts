import { ExecutionState } from "./ExecutionState";
import { ExecutionPolicy } from "./ExecutionPolicy";
import { ExecutionCheckpoint } from "./ExecutionCheckpoint";
import { ExecutionIncident } from "./ExecutionIncident";
import { ExecutionMetrics } from "./ExecutionMetrics";
import { ExecutionFailure } from "./ExecutionFailure";
import { ExecutionRecovery } from "./ExecutionRecovery";

export interface ExecutionSession {
  readonly id: string;
  readonly type: "agent" | "workflow" | "tool" | "ai" | "decision" | "skill";
  readonly state: ExecutionState;
  readonly policy: ExecutionPolicy;
  readonly checkpoints: ReadonlyArray<ExecutionCheckpoint>;
  readonly incidents: ReadonlyArray<ExecutionIncident>;
  readonly metrics: ExecutionMetrics;
  readonly failures: ReadonlyArray<ExecutionFailure>;
  readonly recoveryHistory: ReadonlyArray<ExecutionRecovery>;
  readonly context: any;
}
