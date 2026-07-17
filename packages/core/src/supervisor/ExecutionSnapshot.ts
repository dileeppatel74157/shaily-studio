import { ExecutionState } from "./ExecutionState";
import { ExecutionBudget } from "./ExecutionBudget";
import { ExecutionLimits } from "./ExecutionLimits";
import { ExecutionHealth } from "./ExecutionHealth";
import { ExecutionFailure } from "./ExecutionFailure";
import { ExecutionRecovery } from "./ExecutionRecovery";

import { ExecutionCheckpoint } from "./ExecutionCheckpoint";

export interface ExecutionSnapshot {
  readonly sessionId: string;
  readonly type: string;
  readonly state: ExecutionState;
  readonly checkpoints: ReadonlyArray<ExecutionCheckpoint>;
  readonly budget: ExecutionBudget;
  readonly limits: ExecutionLimits;
  readonly health: ExecutionHealth;
  readonly failures: ReadonlyArray<ExecutionFailure>;
  readonly recoveryHistory: ReadonlyArray<ExecutionRecovery>;
  readonly timestamp: Date;
}
