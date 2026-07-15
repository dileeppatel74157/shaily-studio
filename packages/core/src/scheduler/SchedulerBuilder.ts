import { IScheduler } from "./IScheduler";
import { Scheduler } from "./Scheduler";
import { SchedulerContext } from "./SchedulerContext";
import { SchedulePolicy } from "./SchedulePolicy";
import { SchedulerQueue } from "./SchedulerQueue";
import { SchedulerValidationException } from "./types";

export class SchedulerBuilder {
  private _context?: SchedulerContext;
  private _defaultPolicy?: SchedulePolicy;
  private _queue?: SchedulerQueue;
  private _metadata: Record<string, unknown> = {};

  public withContext(context: SchedulerContext): this {
    this._context = context;
    return this;
  }

  public withPolicy(policy: SchedulePolicy): this {
    this._defaultPolicy = policy;
    return this;
  }

  public withQueue(queue: SchedulerQueue): this {
    this._queue = queue;
    return this;
  }

  public withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }

  public build(): IScheduler {
    if (!this._context) {
      throw new SchedulerValidationException("SchedulerContext is required to build Scheduler.");
    }

    return new Scheduler(
      this._context,
      this._metadata
    );
  }
}
