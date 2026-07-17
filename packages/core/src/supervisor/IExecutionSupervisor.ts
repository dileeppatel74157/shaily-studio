import { ExecutionSession } from "./ExecutionSession";
import { ExecutionCheckpoint } from "./ExecutionCheckpoint";
import { ExecutionSnapshot } from "./ExecutionSnapshot";
import { ExecutionReport } from "./ExecutionReport";
import { ExecutionState } from "./ExecutionState";

export interface IExecutionSupervisor {
  registerSession(session: ExecutionSession): Promise<void>;
  updateSessionState(sessionId: string, state: ExecutionState): Promise<void>;
  createCheckpoint(sessionId: string, variables: Record<string, unknown>, progress: number): Promise<ExecutionCheckpoint>;
  restoreCheckpoint(sessionId: string, checkpointId: string): Promise<ExecutionCheckpoint>;
  consumeBudget(sessionId: string, tokens: number, cost: number, apiCalls?: number): Promise<void>;
  recordFailure(sessionId: string, error: Error): Promise<void>;
  executeRecovery(sessionId: string): Promise<boolean>;
  getReport(): Promise<ExecutionReport>;
  snapshot(): ReadonlyArray<ExecutionSnapshot>;
}
