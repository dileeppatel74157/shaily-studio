export interface ScheduledJob {
  readonly id: string;
  readonly scheduleId: string;
  readonly status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PAUSED";
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly duration?: number; // duration in milliseconds
  readonly error?: string;
  readonly attempt: number;
}
