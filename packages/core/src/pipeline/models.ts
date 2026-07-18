import { PipelineState }       from "./PipelineState";
import { PipelineStage }       from "./PipelineStage";
import { PipelinePriority }       from "./PipelinePriority";
import { PipelineStatus }      from "./PipelineStatus";
import { PipelineMode }        from "./PipelineMode";
import { ExecutionStrategy }   from "./ExecutionStrategy";
import { PipelineResult }      from "./PipelineResult";

// ─── Pipeline Data Models ─────────────────────────────────────────────────────

export interface PipelineRequest {
  id: string;
  goal: string;
  mode: PipelineMode;
  strategy: ExecutionStrategy;
  priority: PipelinePriority;
  stages: PipelineStage[];
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface PipelineResponse {
  id: string;
  requestId: string;
  result: PipelineResult;
  completedStages: PipelineStage[];
  executionTimeMs: number;
  snapshotId?: string;
  timestamp: Date;
}

export interface PipelineStageExecution {
  stage: PipelineStage;
  status: PipelineStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  retryCount: number;
  errorMessage?: string;
}

export interface PipelineExecution {
  id: string;
  requestId: string;
  mode: PipelineMode;
  stages: PipelineStageExecution[];
  status: PipelineStatus;
  startedAt: Date;
  completedAt?: Date;
  totalDurationMs?: number;
  currentStage?: PipelineStage;
}

export interface PipelineCheckpoint {
  id: string;
  requestId: string;
  executionId: string;
  lastCompletedStage: PipelineStage;
  stageResults: Record<string, unknown>;
  savedAt: Date;
}

export interface PipelineFailure {
  id: string;
  executionId: string;
  failedStage: PipelineStage;
  reason: string;
  occurredAt: Date;
  canRetry: boolean;
}

export interface PipelineRecovery {
  id: string;
  failureId: string;
  strategy: "RETRY" | "RESUME" | "ROLLBACK" | "SKIP" | "STOP";
  success: boolean;
  recoveredAt: Date;
}

export interface PipelineMetrics {
  stageDurationsMs: Record<PipelineStage, number>;
  totalRetries: number;
  costUsd: number;
  successRate: number;      // 0–1
}

export interface PipelineTimelineEvent {
  id: string;
  stage: PipelineStage;
  status: PipelineStatus;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface PipelineTimeline {
  id: string;
  executionId: string;
  events: PipelineTimelineEvent[];
  startedAt: Date;
  updatedAt: Date;
}

export interface PipelineReport {
  id: string;
  executionId: string;
  metrics: PipelineMetrics;
  timeline: PipelineTimeline;
  result: PipelineResult;
  generatedAt: Date;
}

export interface PipelineSnapshot {
  id: string;
  state: PipelineState;
  activeExecution?: PipelineExecution;
  lastCheckpoint?: PipelineCheckpoint;
  metrics: PipelineMetrics;
  timestamp: Date;
}
