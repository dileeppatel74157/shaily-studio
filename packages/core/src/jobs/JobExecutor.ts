import { Job } from "./Job";
import { JobContext } from "./JobContext";
import { ILogger } from "../logger/ILogger";
import { IEventBus } from "../events/IEventBus";
import { EventBuilder } from "../events/EventBuilder";

export class JobExecutor {
  constructor(
    private readonly _logger: ILogger,
    private readonly _eventBus: IEventBus
  ) {}

  public async execute(job: Job, signal: AbortSignal): Promise<void> {
    const startTime = new Date();

    // Create job-specific logger context with correlationId
    const jobLogger = this._logger.child({
      jobId: job.id,
      correlationId: job.correlationId,
      jobName: job.name,
    });

    jobLogger.info(`Starting execution of job ${job.name} (${job.id})`);

    try {
      job.start(startTime);

      // Publish job.started event
      await this._eventBus.publish(
        new EventBuilder()
          .withName("job.started")
          .withCorrelationId(job.correlationId)
          .withSource("job-executor")
          .withPayload({ jobId: job.id, name: job.name })
          .build()
      );

      // Create JobContext
      const context: JobContext = {
        jobId: job.id,
        correlationId: job.correlationId,
        logger: jobLogger,
        eventBus: this._eventBus,
        signal,
      };

      // Check signal before running
      if (signal.aborted) {
        throw new Error("Job execution aborted before starting.");
      }

      // Execute the job
      const result = await job.execute(context);

      if (signal.aborted) {
        throw new Error("Job execution aborted during execution.");
      }

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      job.complete(endTime, result);

      jobLogger.info(`Successfully completed job ${job.name} (${job.id}) in ${durationMs}ms`);

      // Publish job.completed event
      await this._eventBus.publish(
        new EventBuilder()
          .withName("job.completed")
          .withCorrelationId(job.correlationId)
          .withSource("job-executor")
          .withPayload({ jobId: job.id, name: job.name, durationMs, result })
          .build()
      );
    } catch (error: any) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      // Check if this is a cancellation (either signal is aborted or error is an abort error)
      if (signal.aborted || error?.name === "AbortError" || error?.message?.includes("aborted")) {
        job.cancel(endTime);
        jobLogger.warn(`Job ${job.name} (${job.id}) was cancelled after ${durationMs}ms`);

        // Publish job.cancelled event
        await this._eventBus.publish(
          new EventBuilder()
            .withName("job.cancelled")
            .withCorrelationId(job.correlationId)
            .withSource("job-executor")
            .withPayload({ jobId: job.id, name: job.name, durationMs })
            .build()
        );
      } else {
        job.fail(endTime, error instanceof Error ? error : new Error(String(error)));
        jobLogger.error(
          `Job ${job.name} (${job.id}) failed after ${durationMs}ms`,
          {},
          error instanceof Error ? error : undefined
        );

        // Publish job.failed event
        await this._eventBus.publish(
          new EventBuilder()
            .withName("job.failed")
            .withCorrelationId(job.correlationId)
            .withSource("job-executor")
            .withPayload({
              jobId: job.id,
              name: job.name,
              durationMs,
              error: error?.message || String(error),
            })
            .build()
        );
      }
    }
  }
}
