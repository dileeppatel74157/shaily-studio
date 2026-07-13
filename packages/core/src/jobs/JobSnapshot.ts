import { JobStatus } from "./JobStatus";
import { JobPriority } from "./JobPriority";

export interface JobSnapshot {
  readonly id: string;
  readonly name: string;
  readonly status: JobStatus;
  readonly priority: JobPriority;
  readonly correlationId: string;
  readonly createdAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly context: unknown;
  readonly metadata: Record<string, unknown>;
  readonly result?: unknown;
  readonly error?: string;
}

export interface JobEngineSnapshot {
  readonly timestamp: Date;
  readonly status: "running" | "stopped" | "stopping";
  readonly totalJobs: number;
  readonly pendingCount: number;
  readonly queuedCount: number;
  readonly runningCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly cancelledCount: number;
  readonly jobs: ReadonlyArray<JobSnapshot>;
}
