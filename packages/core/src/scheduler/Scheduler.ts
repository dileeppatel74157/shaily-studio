import { IScheduler } from "./IScheduler";
import { Schedule } from "./Schedule";
import { ScheduledJob } from "./ScheduledJob";
import { SchedulerSnapshot } from "./SchedulerSnapshot";
import { SchedulerContext } from "./SchedulerContext";
import { SchedulerQueue } from "./SchedulerQueue";
import { SchedulerValidator } from "./SchedulerValidator";
import { SchedulerState } from "./SchedulerState";
import {
  SchedulerValidationException,
  InvalidSchedulerStateException,
  JobExecutionException,
  deepFreeze,
} from "./types";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class Scheduler implements IScheduler {
  private readonly _context: SchedulerContext;
  private readonly _metadata: Readonly<Record<string, unknown>>;
  private readonly _schedules = new Map<string, Schedule>();
  private readonly _handlers = new Map<string, (job: ScheduledJob) => Promise<void>>();
  private readonly _queue = new SchedulerQueue();
  private readonly _history: ScheduledJob[] = [];
  private readonly _pausedSchedules = new Set<string>();
  private _state: SchedulerState = SchedulerState.CREATED;

  constructor(
    context: SchedulerContext,
    metadata?: Record<string, unknown>
  ) {
    SchedulerValidator.validateContext(context);
    this._context = context;
    this._metadata = metadata ? { ...metadata } : {};
  }

  public async initialize(): Promise<void> {
    if (this._state !== SchedulerState.CREATED) {
      throw new InvalidSchedulerStateException("initialize", this._state);
    }
    try {
      this._state = SchedulerState.READY;
    } catch (err) {
      this._state = SchedulerState.FAILED;
      throw err;
    }
  }

  public async start(): Promise<void> {
    if (this._state !== SchedulerState.READY) {
      throw new InvalidSchedulerStateException("start", this._state);
    }
    try {
      this._state = SchedulerState.RUNNING;
    } catch (err) {
      this._state = SchedulerState.FAILED;
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (this._state !== SchedulerState.RUNNING) {
      throw new InvalidSchedulerStateException("stop", this._state);
    }
    try {
      this._queue.clear();
      this._state = SchedulerState.STOPPED;
    } catch (err) {
      this._state = SchedulerState.FAILED;
      throw err;
    }
  }

  public async schedule(
    schedule: Schedule,
    handler: (job: ScheduledJob) => Promise<void>
  ): Promise<void> {
    if (this._state !== SchedulerState.RUNNING) {
      throw new InvalidSchedulerStateException("schedule", this._state);
    }

    SchedulerValidator.validateSchedule(schedule);

    if (this._schedules.has(schedule.id)) {
      throw new SchedulerValidationException(`Schedule with ID "${schedule.id}" already exists`);
    }

    if (!handler || typeof handler !== "function") {
      throw new SchedulerValidationException("Job execution handler is required");
    }

    this._schedules.set(schedule.id, schedule);
    this._handlers.set(schedule.handlerName, handler);
  }

  public async unschedule(scheduleId: string): Promise<void> {
    if (this._state !== SchedulerState.RUNNING) {
      throw new InvalidSchedulerStateException("unschedule", this._state);
    }

    if (!this._schedules.has(scheduleId)) {
      throw new SchedulerValidationException(`Schedule with ID "${scheduleId}" does not exist`);
    }

    const schedule = this._schedules.get(scheduleId)!;
    this._schedules.delete(scheduleId);
    this._pausedSchedules.delete(scheduleId);
    
    // Check if handler is still referenced by other schedules
    let handlerInUse = false;
    for (const s of this._schedules.values()) {
      if (s.handlerName === schedule.handlerName) {
        handlerInUse = true;
        break;
      }
    }
    if (!handlerInUse) {
      this._handlers.delete(schedule.handlerName);
    }
  }

  public has(scheduleId: string): boolean {
    if (this._state !== SchedulerState.RUNNING) {
      throw new InvalidSchedulerStateException("has", this._state);
    }
    return this._schedules.has(scheduleId);
  }

  public get(scheduleId: string): Schedule | undefined {
    if (this._state !== SchedulerState.RUNNING) {
      throw new InvalidSchedulerStateException("get", this._state);
    }
    return this._schedules.get(scheduleId);
  }

  public list(): readonly Schedule[] {
    if (this._state !== SchedulerState.RUNNING) {
      throw new InvalidSchedulerStateException("list", this._state);
    }
    return Array.from(this._schedules.values());
  }

  public async trigger(scheduleId: string): Promise<void> {
    if (this._state !== SchedulerState.RUNNING) {
      throw new InvalidSchedulerStateException("trigger", this._state);
    }

    if (!this._schedules.has(scheduleId)) {
      throw new SchedulerValidationException(`Schedule with ID "${scheduleId}" does not exist`);
    }

    if (this._pausedSchedules.has(scheduleId)) {
      throw new SchedulerValidationException(`Cannot trigger paused schedule: "${scheduleId}"`);
    }

    const schedule = this._schedules.get(scheduleId)!;
    if (!schedule.enabled) {
      throw new SchedulerValidationException(`Cannot trigger disabled schedule: "${scheduleId}"`);
    }

    const jobId = generateUUID();
    const job: ScheduledJob = {
      id: jobId,
      scheduleId,
      status: "PENDING",
      attempt: 1,
    };

    this._queue.push(job, schedule.priority);
    await this.processQueue();
  }

  public async pause(scheduleId: string): Promise<void> {
    if (this._state !== SchedulerState.RUNNING) {
      throw new InvalidSchedulerStateException("pause", this._state);
    }

    if (!this._schedules.has(scheduleId)) {
      throw new SchedulerValidationException(`Schedule with ID "${scheduleId}" does not exist`);
    }

    this._pausedSchedules.add(scheduleId);
  }

  public async resume(scheduleId: string): Promise<void> {
    if (this._state !== SchedulerState.RUNNING) {
      throw new InvalidSchedulerStateException("resume", this._state);
    }

    if (!this._schedules.has(scheduleId)) {
      throw new SchedulerValidationException(`Schedule with ID "${scheduleId}" does not exist`);
    }

    this._pausedSchedules.delete(scheduleId);
  }

  public snapshot(): SchedulerSnapshot {
    if (this._state !== SchedulerState.RUNNING && this._state !== SchedulerState.STOPPED) {
      throw new InvalidSchedulerStateException("snapshot", this._state);
    }

    const snapshotObj: SchedulerSnapshot = {
      timestamp: new Date(),
      schedules: Array.from(this._schedules.values()),
      queue: this._queue.getJobs(),
      history: [...this._history],
      paused: this._pausedSchedules.size === this._schedules.size && this._schedules.size > 0,
      metadata: { ...this._context.metadata, ...this._metadata },
    };

    return deepFreeze(snapshotObj);
  }

  private async processQueue(): Promise<void> {
    let nextJob = this._queue.pop();
    while (nextJob) {
      const schedule = this._schedules.get(nextJob.scheduleId);
      if (!schedule) {
        // Schedule was removed since being queued
        nextJob = this._queue.pop();
        continue;
      }

      const handler = this._handlers.get(schedule.handlerName);
      if (!handler) {
        const failedJob: ScheduledJob = {
          ...nextJob,
          status: "FAILED",
          startedAt: new Date(),
          completedAt: new Date(),
          duration: 0,
          error: `Execution handler "${schedule.handlerName}" not found`,
        };
        this._history.push(failedJob);
        nextJob = this._queue.pop();
        continue;
      }

      const startedAt = new Date();
      let currentAttempt = nextJob.attempt;
      let status: ScheduledJob["status"] = "RUNNING";
      let errorMsg: string | undefined;

      const runningJob: ScheduledJob = {
        ...nextJob,
        status,
        startedAt,
      };

      // Execute with retries
      while (currentAttempt <= schedule.policy.maxRetries + 1) {
        try {
          await handler(runningJob);
          status = "COMPLETED";
          errorMsg = undefined;
          break;
        } catch (err: any) {
          errorMsg = err.message || "Unknown execution failure";
          status = "FAILED";
          currentAttempt++;
        }
      }

      const completedAt = new Date();
      const finishedJob: ScheduledJob = {
        ...nextJob,
        status,
        startedAt,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        attempt: currentAttempt - 1,
        error: errorMsg,
      };

      this._history.push(finishedJob);
      nextJob = this._queue.pop();
    }
  }
}
