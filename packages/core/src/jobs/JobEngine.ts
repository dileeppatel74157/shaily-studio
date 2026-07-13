import { IJobEngine } from "./IJobEngine";
import { Job } from "./Job";
import { JobQueue } from "./JobQueue";
import { JobExecutor } from "./JobExecutor";
import { JobEngineSnapshot } from "./JobSnapshot";
import { JobStatus } from "./JobStatus";
import { ILogger } from "../logger/ILogger";
import { IEventBus } from "../events/IEventBus";
import { EventBuilder } from "../events/EventBuilder";
import { JobEngineNotRunningException } from "./types";

export class JobEngine implements IJobEngine {
  private readonly _queue = new JobQueue();
  private readonly _activeJobs = new Map<string, { job: Job; controller: AbortController }>();
  private readonly _history = new Map<string, Job>();
  private readonly _executor: JobExecutor;

  private _state: "running" | "stopped" | "stopping" = "stopped";
  private _shutdownResolve?: () => void;
  private readonly _maxConcurrency: number;

  constructor(
    private readonly _logger: ILogger,
    private readonly _eventBus: IEventBus,
    options?: { maxConcurrency?: number }
  ) {
    this._maxConcurrency = options?.maxConcurrency ?? 4;
    this._executor = new JobExecutor(_logger, _eventBus);
  }

  public get state(): "running" | "stopped" | "stopping" {
    return this._state;
  }

  public async start(): Promise<void> {
    if (this._state === "running") {
      return;
    }

    this._state = "running";
    this._logger.info("Job Engine started.");

    // Start processing queue in case there are jobs already queued
    this._processQueue();
  }

  public async stop(): Promise<void> {
    if (this._state === "stopped" || this._state === "stopping") {
      return;
    }

    this._logger.info("Gracefully stopping Job Engine...");

    if (this._activeJobs.size > 0) {
      this._state = "stopping";
      await new Promise<void>((resolve) => {
        this._shutdownResolve = resolve;
      });
    }

    this._state = "stopped";
    this._shutdownResolve = undefined;
    this._logger.info("Job Engine stopped.");
  }

  public async submit(job: Job): Promise<void> {
    if (this._state !== "running") {
      throw new JobEngineNotRunningException("submit", this._state);
    }

    this._logger.info(`Submitting job: ${job.name} (${job.id})`);

    // Enqueue the job
    this._queue.enqueue(job);

    // Publish job.queued event
    await this._eventBus.publish(
      new EventBuilder()
        .withName("job.queued")
        .withCorrelationId(job.correlationId)
        .withSource("job-engine")
        .withPayload({ jobId: job.id, name: job.name })
        .build()
    );

    // Asynchronously trigger execution
    this._processQueue();
  }

  public async cancel(jobId: string): Promise<boolean> {
    this._logger.info(`Attempting to cancel job: ${jobId}`);

    // Case 1: Job is active / executing
    const active = this._activeJobs.get(jobId);
    if (active) {
      this._logger.info(`Job ${jobId} is currently running. Requesting abort.`);
      active.controller.abort();
      return true;
    }

    // Case 2: Job is in the queue
    const queuedJob = this._queue.get(jobId);
    if (queuedJob) {
      this._logger.info(`Job ${jobId} is in the queue. Removing and cancelling.`);
      this._queue.remove(jobId);

      queuedJob.cancel(new Date());
      this._history.set(jobId, queuedJob);

      // Publish job.cancelled event
      await this._eventBus.publish(
        new EventBuilder()
          .withName("job.cancelled")
          .withCorrelationId(queuedJob.correlationId)
          .withSource("job-engine")
          .withPayload({ jobId: queuedJob.id, name: queuedJob.name })
          .build()
      );

      return true;
    }

    // Case 3: Job is in history (already completed/failed/cancelled)
    if (this._history.has(jobId)) {
      this._logger.warn(`Job ${jobId} cannot be cancelled as it is already in a final state.`);
      return false;
    }

    // Case 4: Job not found
    this._logger.warn(`Job ${jobId} not found in the engine.`);
    return false;
  }

  public get(jobId: string): Job | undefined {
    // Check active
    const active = this._activeJobs.get(jobId);
    if (active) return active.job;

    // Check queue
    const queued = this._queue.get(jobId);
    if (queued) return queued;

    // Check history
    return this._history.get(jobId);
  }

  public has(jobId: string): boolean {
    return this.get(jobId) !== undefined;
  }

  public snapshot(): JobEngineSnapshot {
    const jobSnapshots = [
      ...Array.from(this._activeJobs.values()).map(({ job }) => job.toSnapshot()),
      ...this._queue.getAll().map((job) => job.toSnapshot()),
      ...Array.from(this._history.values()).map((job) => job.toSnapshot()),
    ];

    let pendingCount = 0;
    let queuedCount = 0;
    let runningCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;

    for (const snap of jobSnapshots) {
      switch (snap.status) {
        case JobStatus.PENDING:
          pendingCount++;
          break;
        case JobStatus.QUEUED:
          queuedCount++;
          break;
        case JobStatus.RUNNING:
          runningCount++;
          break;
        case JobStatus.COMPLETED:
          completedCount++;
          break;
        case JobStatus.FAILED:
          failedCount++;
          break;
        case JobStatus.CANCELLED:
          cancelledCount++;
          break;
      }
    }

    return Object.freeze({
      timestamp: new Date(),
      status: this._state,
      totalJobs: jobSnapshots.length,
      pendingCount,
      queuedCount,
      runningCount,
      completedCount,
      failedCount,
      cancelledCount,
      jobs: Object.freeze(jobSnapshots),
    });
  }

  private _processQueue(): void {
    if (this._state !== "running") {
      return;
    }

    while (this._activeJobs.size < this._maxConcurrency) {
      const job = this._queue.dequeue();
      if (!job) {
        break;
      }

      const controller = new AbortController();
      this._activeJobs.set(job.id, { job, controller });

      // Run async
      (async () => {
        try {
          await this._executor.execute(job, controller.signal);
        } finally {
          this._activeJobs.delete(job.id);
          this._history.set(job.id, job);

          if (this._state === "stopping" && this._activeJobs.size === 0) {
            this._shutdownResolve?.();
          } else {
            this._processQueue();
          }
        }
      })();
    }
  }
}
