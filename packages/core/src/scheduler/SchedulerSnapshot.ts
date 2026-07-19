import { Schedule } from "./Schedule";
import { ScheduledJob } from "./ScheduledJob";

export interface SchedulerSnapshot {
  readonly timestamp: Date;
  readonly schedules: readonly Schedule[];
  readonly queue: readonly ScheduledJob[];
  readonly history: readonly ScheduledJob[];
  readonly paused: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}
