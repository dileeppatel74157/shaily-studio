import {
  PublishingRequest,
  PublishingResponse,
  PublishingJob,
  PublishingResult,
  PublishingMetadata,
  PublishingSchedule,
  PublishingSnapshot,
  PublishingReport,
} from "./models";
import { PublishingState }    from "./PublishingState";
import { PublishingPlatform } from "./PublishingPlatform";
import { PublishingStatus }   from "./PublishingStatus";

// ─── Core Engine ──────────────────────────────────────────────────────────────

export interface IPublishingEngine {
  readonly state: PublishingState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  publish(request: PublishingRequest): Promise<PublishingResponse>;
  cancel(publishingId: string): Promise<void>;
  retry(publishingId: string): Promise<PublishingResponse>;
  getReport(publishingId: string): PublishingReport;
  getSnapshot(publishingId: string): PublishingSnapshot;
  getHistory(): PublishingResponse[];
}

// ─── Platform Provider ────────────────────────────────────────────────────────

export interface IPlatformProvider {
  /** Platform this provider handles */
  readonly platform: PublishingPlatform;

  /**
   * Upload video and associated assets to the platform.
   * Returns the job updated with platformVideoId and publishedUrl (or scheduledAt).
   */
  upload(
    job: PublishingJob,
    assets: {
      videoPath: string;
      thumbnailPath?: string;
      subtitlePath?: string;
      metadata: PublishingMetadata;
    }
  ): Promise<PublishingJob>;

  /**
   * Schedule a previously uploaded video for future publishing.
   */
  schedule(job: PublishingJob, scheduledAt: Date): Promise<PublishingJob>;

  /**
   * Poll the platform for the current processing status of the video.
   */
  getStatus(job: PublishingJob): Promise<PublishingStatus>;

  /**
   * Cancel an in-progress upload or scheduled publish.
   */
  cancel(job: PublishingJob): Promise<void>;
}

// ─── Metadata Builder ─────────────────────────────────────────────────────────

export interface IMetadataBuilder {
  /**
   * Auto-generates publishing metadata by querying research, strategy,
   * channel, and script engines from the agent context.
   */
  build(
    request: PublishingRequest,
    context: Record<string, unknown>
  ): Promise<PublishingMetadata>;
}

// ─── Schedule Planner ─────────────────────────────────────────────────────────

export interface ISchedulePlanner {
  /**
   * Resolves the final publish schedule.
   * Supports: publish-now, scheduled, recurring, and calendar-aware ordering.
   */
  plan(schedule: PublishingSchedule): PublishingSchedule;

  /**
   * Returns the next publish Date from a recurring rule and timezone.
   */
  nextOccurrence(recurrenceRule: string, timezone: string, after?: Date): Date | null;

  /**
   * Validates that the scheduled time is in the future and timezone is valid.
   */
  validate(schedule: PublishingSchedule): void;
}

// ─── Upload Manager ───────────────────────────────────────────────────────────

export interface IUploadManager {
  /**
   * Executes the full upload sequence for one job:
   * video → thumbnail → subtitle → metadata → playlist assignment → scheduling/publishing.
   * Reports progress via the monitor.
   */
  upload(
    job: PublishingJob,
    provider: IPlatformProvider,
    assets: {
      videoPath: string;
      thumbnailPath?: string;
      subtitlePath?: string;
      metadata: PublishingMetadata;
    },
    onProgress: (job: PublishingJob) => void
  ): Promise<PublishingJob>;
}

// ─── Retry Manager ────────────────────────────────────────────────────────────

export interface IRetryManager {
  /**
   * Determines whether a failed job should be retried.
   */
  shouldRetry(job: PublishingJob): boolean;

  /**
   * Calculates the delay in milliseconds before the next retry attempt
   * using exponential backoff.
   */
  retryDelayMs(job: PublishingJob): number;

  /**
   * Attempts to retry a failed upload job.
   * Returns the updated job after the retry attempt.
   */
  retry(
    job: PublishingJob,
    provider: IPlatformProvider,
    assets: {
      videoPath: string;
      thumbnailPath?: string;
      subtitlePath?: string;
      metadata: PublishingMetadata;
    },
    uploadManager: IUploadManager
  ): Promise<PublishingJob>;
}

// ─── Publishing Monitor ───────────────────────────────────────────────────────

export interface IPublishingMonitor {
  /**
   * Records a progress update for a specific job.
   */
  update(job: PublishingJob): void;

  /**
   * Returns the current snapshot of a job's progress.
   */
  getProgress(jobId: string): {
    uploadProgress: number;
    processingProgress: number;
    status: PublishingStatus;
    eta?: number;
    warnings: string[];
    retries: number;
    platformVideoId?: string;
    publishedUrl?: string;
  } | undefined;

  /**
   * Returns all monitored jobs' progress snapshots.
   */
  getAllProgress(): Map<string, {
    uploadProgress: number;
    processingProgress: number;
    status: PublishingStatus;
    eta?: number;
    warnings: string[];
    retries: number;
    platformVideoId?: string;
    publishedUrl?: string;
  }>;
}
