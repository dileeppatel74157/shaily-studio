import { Job } from "./Job";
import { JobEngine } from "./JobEngine";

/**
 * JobScheduler handles job scheduling.
 *
 * Current specification:
 * - Immediate execution only.
 *
 * Design for delayed scheduling (DO NOT implement):
 * - To support delayed scheduling, the scheduler would:
 *   1. Accept a delay (ms) or target execution date/time.
 *   2. Maintain a priority queue sorted by scheduled execution time (earliest first).
 *   3. Run a timer/polling loop (or use setTimeout/timer wheel) to check the head of the queue.
 *   4. When the scheduled time is reached, submit the job to the main JobEngine.
 *   5. For cron, reschedule the job after successful submission.
 */
export class JobScheduler {
  constructor(private readonly _engine: JobEngine) {}

  /**
   * Schedule a job for immediate execution.
   */
  public async schedule(job: Job): Promise<void> {
    await this._engine.submit(job);
  }

  /**
   * Placeholder for delayed scheduling design.
   * DO NOT implement.
   */
  public async scheduleDelayed(job: Job, _delayMs: number): Promise<void> {
    throw new Error("Delayed scheduling is not supported in Sprint 1.6.");
  }
}
