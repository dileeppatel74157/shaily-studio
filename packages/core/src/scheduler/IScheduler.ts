import { Schedule } from "./Schedule";
import { ScheduledJob } from "./ScheduledJob";
import { SchedulerSnapshot } from "./SchedulerSnapshot";

export interface IScheduler {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  schedule(
    schedule: Schedule,
    handler: (job: ScheduledJob) => Promise<void>
  ): Promise<void>;
  unschedule(scheduleId: string): Promise<void>;
  has(scheduleId: string): boolean;
  get(scheduleId: string): Schedule | undefined;
  list(): readonly Schedule[];
  trigger(scheduleId: string): Promise<void>;
  pause(scheduleId: string): Promise<void>;
  resume(scheduleId: string): Promise<void>;
  snapshot(): SchedulerSnapshot;
}
