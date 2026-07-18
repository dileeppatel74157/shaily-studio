import { PipelineState }       from "./PipelineState";
import { PipelineStage }       from "./PipelineStage";
import { PipelineStatus }      from "./PipelineStatus";
import type {
  PipelineRequest,
  PipelineResponse,
  PipelineExecution,
  PipelineStageExecution,
  PipelineCheckpoint,
  PipelineFailure,
  PipelineRecovery,
  PipelineReport,
  PipelineSnapshot,
} from "./models";

// ─── Pipeline Engine ─────────────────────────────────────────────────────────

export interface IPipelineEngine {
  readonly state: PipelineState;

  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;

  /** Execute a full autonomous pipeline workflow */
  execute(request: PipelineRequest): Promise<PipelineResponse>;

  /** Retrieve the latest state snapshot of the active pipeline */
  getSnapshot(): PipelineSnapshot;

  /** Get a detailed report of the last execution metrics and timeline */
  getReport(executionId: string): PipelineReport | undefined;

  // Sub-managers exposure
  getStageExecutor(): IStageExecutor;
  getRecoveryManager(): IRecoveryManager;
  getCheckpointManager(): ICheckpointManager;
  getExecutionScheduler(): IExecutionScheduler;
  getMonitor(): IPipelineMonitor;
}

// ─── Stage Executor ──────────────────────────────────────────────────────────

export interface IStageExecutor {
  executeStage(stage: PipelineStage, context: any): Promise<PipelineStatus>;
  rollbackStage(stage: PipelineStage, context: any): Promise<void>;
}

// ─── Recovery Manager ────────────────────────────────────────────────────────

export interface IRecoveryManager {
  handleFailure(failure: PipelineFailure): Promise<PipelineRecovery>;
  getFailures(executionId?: string): PipelineFailure[];
}

// ─── Checkpoint Manager ──────────────────────────────────────────────────────

export interface ICheckpointManager {
  saveCheckpoint(checkpoint: PipelineCheckpoint): void;
  loadCheckpoint(executionId: string): PipelineCheckpoint | undefined;
  listCheckpoints(requestId?: string): PipelineCheckpoint[];
}

// ─── Execution Scheduler ─────────────────────────────────────────────────────

export interface IExecutionScheduler {
  schedule(stages: PipelineStage[]): PipelineStage[][]; // returns grouped lists (sequential tiers for parallel/hybrid)
}

// ─── Pipeline Monitor ────────────────────────────────────────────────────────

export interface IPipelineMonitor {
  trackExecution(execution: PipelineExecution): void;
  getExecution(executionId: string): PipelineExecution | undefined;
  getActiveExecutions(): PipelineExecution[];
}
