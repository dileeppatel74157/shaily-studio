import {
  IPublishingEngine,
  IPlatformProvider,
  IMetadataBuilder,
  ISchedulePlanner,
  IUploadManager,
  IRetryManager,
  IPublishingMonitor,
} from "./interfaces";
import { PublishingState }    from "./PublishingState";
import { PublishingPlatform } from "./PublishingPlatform";
import { PublishingStatus }   from "./PublishingStatus";
import { PrivacyType }        from "./PrivacyType";
import {
  PublishingRequest,
  PublishingResponse,
  PublishingJob,
  PublishingResult,
  PublishingMetadata,
  PublishingSchedule,
  PublishingMetrics,
  PublishingReport,
  PublishingSnapshot,
  PublishingTarget,
  PublishingAnalyticsReference,
} from "./models";
import { PublishingValidator } from "./PublishingValidator";
import {
  PublishingException,
  PublishingValidationException,
  DuplicatePublishingException,
  InvalidPublishingStateException,
  PublishingPlatformException,
  PublishingRetryExhaustedException,
  deepFreeze,
} from "./types";

// ─── Default Metadata Builder ─────────────────────────────────────────────────

class DefaultMetadataBuilder implements IMetadataBuilder {
  public async build(
    request: PublishingRequest,
    context: Record<string, unknown>
  ): Promise<PublishingMetadata> {
    // Pull from script/research/channel/strategy engines if available
    let title = "Untitled Video";
    let description = "Watch this amazing video.";
    let tags: string[] = [];
    let hashtags: string[] = [];
    let keywords: string[] = [];
    let category: string | undefined;
    let cta: string | undefined;
    let playlist: string | undefined;

    // Script Engine: extract title and CTA
    if (context?.scriptEngine) {
      try {
        const scriptHistory = (context.scriptEngine as any).getHistory?.();
        const lastScript = scriptHistory?.[scriptHistory.length - 1];
        if (lastScript?.title) title = lastScript.title;
        if (lastScript?.cta) cta = lastScript.cta;
      } catch (_) {}
    }

    // Research Engine: extract trending keywords and SEO tags
    if (context?.researchEngine) {
      try {
        const researchHistory = (context.researchEngine as any).getHistory?.();
        const lastResearch = researchHistory?.[researchHistory.length - 1];
        if (lastResearch?.keywords) keywords = lastResearch.keywords.slice(0, 15);
        if (lastResearch?.hashtags) hashtags = lastResearch.hashtags.slice(0, 10);
        if (lastResearch?.tags) tags = lastResearch.tags.slice(0, 30);
      } catch (_) {}
    }

    // Channel Engine: extract brand defaults
    if (context?.channelEngine) {
      try {
        const channelHistory = (context.channelEngine as any).getHistory?.();
        const lastChannel = channelHistory?.[channelHistory.length - 1];
        if (lastChannel?.defaultPlaylist) playlist = lastChannel.defaultPlaylist;
        if (lastChannel?.defaultCategory) category = lastChannel.defaultCategory;
        if (lastChannel?.defaultCta && !cta) cta = lastChannel.defaultCta;
      } catch (_) {}
    }

    // Strategy Engine: extract description template
    if (context?.strategyEngine) {
      try {
        const strategyHistory = (context.strategyEngine as any).getHistory?.();
        const lastStrategy = strategyHistory?.[strategyHistory.length - 1];
        if (lastStrategy?.description) description = lastStrategy.description;
      } catch (_) {}
    }

    // Apply any overrides from the request
    if (request.options?.metadataOverrides) {
      const overrides = request.options.metadataOverrides;
      if (overrides.title)       title       = overrides.title;
      if (overrides.description) description = overrides.description;
      if (overrides.tags)        tags        = overrides.tags;
      if (overrides.hashtags)    hashtags    = overrides.hashtags;
      if (overrides.keywords)    keywords    = overrides.keywords;
      if (overrides.category)    category    = overrides.category;
      if (overrides.cta)         cta         = overrides.cta;
      if (overrides.playlist)    playlist    = overrides.playlist;
    }

    return {
      title,
      description,
      tags,
      hashtags,
      keywords,
      category,
      cta,
      playlist,
      chapters: [],
      pinnedComment: undefined,
      endScreenReferences: [],
      language: "en",
      allowComments: true,
      allowRatings: true,
    };
  }
}

// ─── Default Schedule Planner ─────────────────────────────────────────────────

class DefaultSchedulePlanner implements ISchedulePlanner {
  private static readonly VALID_TIMEZONES = new Set([
    "UTC", "America/New_York", "America/Los_Angeles", "America/Chicago",
    "America/Denver", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Asia/Kolkata", "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore",
    "Australia/Sydney", "Pacific/Auckland",
  ]);

  public plan(schedule: PublishingSchedule): PublishingSchedule {
    if (schedule.mode === "now") {
      return { ...schedule, publishAt: new Date() };
    }
    return schedule;
  }

  public nextOccurrence(
    recurrenceRule: string,
    timezone: string,
    after?: Date
  ): Date | null {
    // Basic weekly recurrence mock — production would use a cron library
    const base = after ?? new Date();
    if (recurrenceRule.startsWith("FREQ=WEEKLY")) {
      const next = new Date(base);
      next.setDate(next.getDate() + 7);
      return next;
    }
    if (recurrenceRule.startsWith("FREQ=DAILY")) {
      const next = new Date(base);
      next.setDate(next.getDate() + 1);
      return next;
    }
    return null;
  }

  public validate(schedule: PublishingSchedule): void {
    if (schedule.mode === "scheduled" || schedule.mode === "recurring") {
      if (!schedule.publishAt) {
        throw new PublishingValidationException(
          `PublishingSchedule in mode "${schedule.mode}" requires a publishAt date.`
        );
      }
      if (schedule.publishAt <= new Date()) {
        throw new PublishingValidationException(
          `PublishingSchedule.publishAt must be a future date.`
        );
      }
    }
    if (schedule.timezone && !DefaultSchedulePlanner.VALID_TIMEZONES.has(schedule.timezone)) {
      throw new PublishingValidationException(
        `Invalid timezone "${schedule.timezone}". Please use a valid IANA timezone string.`
      );
    }
  }
}

// ─── Default Upload Manager ───────────────────────────────────────────────────

class DefaultUploadManager implements IUploadManager {
  public async upload(
    job: PublishingJob,
    provider: IPlatformProvider,
    assets: {
      videoPath: string;
      thumbnailPath?: string;
      subtitlePath?: string;
      metadata: PublishingMetadata;
    },
    onProgress: (job: PublishingJob) => void
  ): Promise<PublishingJob> {
    // Stage 1: video upload (0 → 80%)
    job.state = PublishingState.UPLOADING;
    job.status = PublishingStatus.RUNNING;
    job.uploadProgress = 0;
    onProgress(job);

    // Simulate upload progress in stages
    job.uploadProgress = 25;
    onProgress(job);
    job.uploadProgress = 50;
    onProgress(job);
    job.uploadProgress = 75;
    onProgress(job);
    job.uploadProgress = 100;
    onProgress(job);

    // Stage 2: Delegate to platform provider
    const updatedJob = await provider.upload(job, assets);
    updatedJob.uploadProgress = 100;

    // Stage 3: platform processing (0 → 100%)
    updatedJob.state = PublishingState.PROCESSING;
    updatedJob.processingProgress = 50;
    onProgress(updatedJob);
    updatedJob.processingProgress = 100;
    onProgress(updatedJob);

    return updatedJob;
  }
}

// ─── Default Retry Manager ────────────────────────────────────────────────────

class DefaultRetryManager implements IRetryManager {
  public shouldRetry(job: PublishingJob): boolean {
    return job.retryCount < job.maxRetries && job.status === PublishingStatus.FAILED;
  }

  public retryDelayMs(job: PublishingJob): number {
    // Exponential backoff: 2^retryCount * 1000ms (max 30s)
    return Math.min(Math.pow(2, job.retryCount) * 1000, 30_000);
  }

  public async retry(
    job: PublishingJob,
    provider: IPlatformProvider,
    assets: {
      videoPath: string;
      thumbnailPath?: string;
      subtitlePath?: string;
      metadata: PublishingMetadata;
    },
    uploadManager: IUploadManager
  ): Promise<PublishingJob> {
    if (!this.shouldRetry(job)) {
      throw new PublishingRetryExhaustedException(job.id, job.maxRetries);
    }

    job.retryCount += 1;
    job.status = PublishingStatus.RETRYING;
    job.error = undefined;

    return uploadManager.upload(job, provider, assets, (_j) => {});
  }
}

// ─── Default Publishing Monitor ───────────────────────────────────────────────

class DefaultPublishingMonitor implements IPublishingMonitor {
  private readonly _progress = new Map<string, {
    uploadProgress: number;
    processingProgress: number;
    status: PublishingStatus;
    eta?: number;
    warnings: string[];
    retries: number;
    platformVideoId?: string;
    publishedUrl?: string;
  }>();

  public update(job: PublishingJob): void {
    this._progress.set(job.id, {
      uploadProgress: job.uploadProgress,
      processingProgress: job.processingProgress,
      status: job.status,
      warnings: [...job.warnings],
      retries: job.retryCount,
      platformVideoId: job.platformVideoId,
      publishedUrl: job.publishedUrl,
    });
  }

  public getProgress(jobId: string) {
    return this._progress.get(jobId);
  }

  public getAllProgress() {
    return new Map(this._progress);
  }
}

// ─── Platform Providers ───────────────────────────────────────────────────────

class BasePlatformProvider implements IPlatformProvider {
  public readonly platform: PublishingPlatform;

  constructor(platform: PublishingPlatform) {
    this.platform = platform;
  }

  public async upload(
    job: PublishingJob,
    _assets: {
      videoPath: string;
      thumbnailPath?: string;
      subtitlePath?: string;
      metadata: PublishingMetadata;
    }
  ): Promise<PublishingJob> {
    const videoId = `${this.platform.toLowerCase()}-vid-${Math.random().toString(36).substring(2, 10)}`;
    const url = this._buildUrl(videoId);

    job.platformVideoId = videoId;
    job.publishedUrl = url;
    job.status = job.target.account.platform === this.platform
      ? PublishingStatus.SUCCESS
      : PublishingStatus.FAILED;
    job.state = PublishingState.PUBLISHED;
    job.publishedAt = new Date();
    return job;
  }

  public async schedule(job: PublishingJob, scheduledAt: Date): Promise<PublishingJob> {
    job.scheduledAt = scheduledAt;
    job.status = PublishingStatus.SCHEDULED;
    job.state = PublishingState.SCHEDULING;
    return job;
  }

  public async getStatus(job: PublishingJob): Promise<PublishingStatus> {
    return job.status;
  }

  public async cancel(job: PublishingJob): Promise<void> {
    job.status = PublishingStatus.FAILED;
    job.state = PublishingState.CANCELLED;
  }

  protected _buildUrl(videoId: string): string {
    const urlMap: Record<string, string> = {
      [PublishingPlatform.YOUTUBE]:   `https://www.youtube.com/watch?v=${videoId}`,
      [PublishingPlatform.INSTAGRAM]: `https://www.instagram.com/reel/${videoId}/`,
      [PublishingPlatform.TIKTOK]:    `https://www.tiktok.com/@user/video/${videoId}`,
      [PublishingPlatform.FACEBOOK]:  `https://www.facebook.com/watch/?v=${videoId}`,
      [PublishingPlatform.X]:         `https://x.com/i/status/${videoId}`,
      [PublishingPlatform.LINKEDIN]:  `https://www.linkedin.com/feed/update/urn:li:video:${videoId}`,
      [PublishingPlatform.RUMBLE]:    `https://rumble.com/v${videoId}.html`,
      [PublishingPlatform.CUSTOM]:    `https://custom-platform.example.com/video/${videoId}`,
    };
    return urlMap[this.platform] ?? `https://unknown-platform.example.com/video/${videoId}`;
  }
}

class YouTubeProvider   extends BasePlatformProvider { constructor() { super(PublishingPlatform.YOUTUBE); } }
class InstagramProvider extends BasePlatformProvider { constructor() { super(PublishingPlatform.INSTAGRAM); } }
class TikTokProvider    extends BasePlatformProvider { constructor() { super(PublishingPlatform.TIKTOK); } }
class FacebookProvider  extends BasePlatformProvider { constructor() { super(PublishingPlatform.FACEBOOK); } }
class XProvider         extends BasePlatformProvider { constructor() { super(PublishingPlatform.X); } }
class LinkedInProvider  extends BasePlatformProvider { constructor() { super(PublishingPlatform.LINKEDIN); } }
class RumbleProvider    extends BasePlatformProvider { constructor() { super(PublishingPlatform.RUMBLE); } }
class CustomPlatformProvider extends BasePlatformProvider { constructor() { super(PublishingPlatform.CUSTOM); } }

// ─── Platform Router ──────────────────────────────────────────────────────────

class PlatformRouter {
  private readonly _registry = new Map<PublishingPlatform, IPlatformProvider>();

  constructor(providers: IPlatformProvider[]) {
    for (const provider of providers) {
      this._registry.set(provider.platform, provider);
    }
  }

  public route(platform: PublishingPlatform): IPlatformProvider {
    const provider = this._registry.get(platform);
    if (!provider) {
      throw new PublishingPlatformException(platform, `No provider registered for platform "${platform}".`);
    }
    return provider;
  }

  public register(provider: IPlatformProvider): void {
    this._registry.set(provider.platform, provider);
  }

  public has(platform: PublishingPlatform): boolean {
    return this._registry.has(platform);
  }
}

// ─── Publishing Engine ────────────────────────────────────────────────────────

export class PublishingEngine implements IPublishingEngine {
  private _state = PublishingState.CREATED;
  private readonly _requests   = new Map<string, PublishingRequest>();
  private readonly _responses  = new Map<string, PublishingResponse>();
  private readonly _snapshots  = new Map<string, PublishingSnapshot>();
  private readonly _reports    = new Map<string, PublishingReport>();
  private readonly _history: PublishingResponse[] = [];

  private readonly _metadataBuilder: IMetadataBuilder;
  private readonly _schedulePlanner: ISchedulePlanner;
  private readonly _uploadManager:   IUploadManager;
  private readonly _retryManager:    IRetryManager;
  private readonly _monitor:         IPublishingMonitor;
  private readonly _router:          PlatformRouter;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    metadataBuilder?: IMetadataBuilder,
    schedulePlanner?: ISchedulePlanner,
    uploadManager?: IUploadManager,
    retryManager?: IRetryManager,
    monitor?: IPublishingMonitor,
    extraProviders?: IPlatformProvider[]
  ) {
    this._metadataBuilder = metadataBuilder || new DefaultMetadataBuilder();
    this._schedulePlanner = schedulePlanner || new DefaultSchedulePlanner();
    this._uploadManager   = uploadManager   || new DefaultUploadManager();
    this._retryManager    = retryManager    || new DefaultRetryManager();
    this._monitor         = monitor         || new DefaultPublishingMonitor();

    // Register all built-in platform providers
    const builtInProviders: IPlatformProvider[] = [
      new YouTubeProvider(),
      new InstagramProvider(),
      new TikTokProvider(),
      new FacebookProvider(),
      new XProvider(),
      new LinkedInProvider(),
      new RumbleProvider(),
      new CustomPlatformProvider(),
    ];

    this._router = new PlatformRouter([
      ...builtInProviders,
      ...(extraProviders ?? []),
    ]);
  }

  public get state(): PublishingState {
    return this._state;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    PublishingValidator.validateStateTransition("engine", this._state, PublishingState.INITIALIZED);
    this._state = PublishingState.INITIALIZED;
  }

  public async start(): Promise<void> {
    this._state = PublishingState.PREPARING;
  }

  public async stop(): Promise<void> {
    this._state = PublishingState.CANCELLED;
  }

  public getReport(publishingId: string): PublishingReport {
    const report = this._reports.get(publishingId);
    if (!report) {
      throw new PublishingException(`No report found for publishing job "${publishingId}".`);
    }
    return report;
  }

  public getSnapshot(publishingId: string): PublishingSnapshot {
    const snap = this._snapshots.get(publishingId);
    if (!snap) {
      throw new PublishingException(`No snapshot found for publishing job "${publishingId}".`);
    }
    return snap;
  }

  public getHistory(): PublishingResponse[] {
    return [...this._history];
  }

  public async cancel(publishingId: string): Promise<void> {
    const response = this._responses.get(publishingId);
    if (!response) {
      throw new PublishingException(`Publishing request "${publishingId}" not found.`);
    }
    for (const job of response.jobs) {
      if (
        job.state !== PublishingState.PUBLISHED &&
        job.state !== PublishingState.CANCELLED
      ) {
        const provider = this._router.route(job.platform);
        await provider.cancel(job);
      }
    }
    this._state = PublishingState.CANCELLED;
    await this._publishEvent("PublishingCancelled", publishingId, { publishingId });
  }

  public async retry(publishingId: string): Promise<PublishingResponse> {
    const originalResponse = this._responses.get(publishingId);
    if (!originalResponse) {
      throw new PublishingException(`Publishing request "${publishingId}" not found for retry.`);
    }
    const originalRequest = this._requests.get(publishingId);
    if (!originalRequest) {
      throw new PublishingException(`Publishing request data for "${publishingId}" is missing.`);
    }

    // Re-run only the failed jobs
    const failedJobs = originalResponse.jobs.filter(
      (j) => j.status === PublishingStatus.FAILED
    );

    const videoPath     = this._resolveVideoPath(originalRequest);
    const thumbnailPath = originalRequest.options?.thumbnailPath;
    const subtitlePath  = originalRequest.options?.subtitlePath;
    const metadata      = originalResponse.report.metadata;

    for (const job of failedJobs) {
      await this._publishEvent("RetryStarted", publishingId, { jobId: job.id, platform: job.platform });
      const provider = this._router.route(job.platform);
      const retried = await this._retryManager.retry(job, provider, {
        videoPath,
        thumbnailPath,
        subtitlePath,
        metadata,
      }, this._uploadManager);

      // Update in-place
      const idx = originalResponse.jobs.indexOf(job);
      if (idx >= 0) originalResponse.jobs[idx] = retried;
      await this._publishEvent("RetryCompleted", publishingId, { jobId: retried.id, status: retried.status });
    }

    // Rebuild results and report
    const updatedResults = this._buildResults(originalResponse.jobs);
    const updatedMetrics = this._buildMetrics(originalResponse.jobs, updatedResults);
    originalResponse.results = updatedResults;
    originalResponse.metrics = updatedMetrics;

    return originalResponse;
  }

  // ─── Core Publish Method ─────────────────────────────────────────────────

  public async publish(request: PublishingRequest): Promise<PublishingResponse> {
    // ── Phase 1: Validate ────────────────────────────────────────────────
    this._state = PublishingState.VALIDATING;
    PublishingValidator.validateRequest(request);

    if (this._requests.has(request.id) && !request.options?.allowDuplicate) {
      throw new DuplicatePublishingException(request.id);
    }
    this._requests.set(request.id, request);

    await this._publishEvent("PublishingStarted", request.id, {
      qualityId: request.qualityId,
      renderId:  request.renderId,
      targets:   request.targets.length,
    });

    // ── Phase 2: Prepare ─────────────────────────────────────────────────
    this._state = PublishingState.PREPARING;

    // Build metadata
    const publishingMetadata = await this._metadataBuilder.build(request, this.context ?? {});
    await this._publishEvent("MetadataGenerated", request.id, {
      title: publishingMetadata.title,
      tags:  publishingMetadata.tags.length,
    });

    // Validate metadata
    PublishingValidator.validateMetadata(publishingMetadata);

    // Plan schedule
    const resolvedSchedule = this._schedulePlanner.plan(request.schedule);

    // Resolve asset paths
    const videoPath     = this._resolveVideoPath(request);
    const thumbnailPath = request.options?.thumbnailPath;
    const subtitlePath  = request.options?.subtitlePath;

    const maxRetries = request.options?.maxRetries ?? 3;

    // ── Phase 3: Build Jobs ──────────────────────────────────────────────
    const jobs: PublishingJob[] = request.targets.map((target) =>
      this._buildJob(request.id, target, maxRetries)
    );

    // ── Phase 4: Upload to Each Platform ─────────────────────────────────
    this._state = PublishingState.UPLOADING;

    for (const job of jobs) {
      await this._publishEvent("UploadStarted", request.id, {
        jobId:    job.id,
        platform: job.platform,
      });

      const provider = this._router.route(job.platform);

      try {
        // Schedule Planner
        if (resolvedSchedule.mode !== "now" && resolvedSchedule.publishAt) {
          this._state = PublishingState.SCHEDULING;
          const scheduledJob = await provider.schedule(job, resolvedSchedule.publishAt);
          Object.assign(job, scheduledJob);
          await this._publishEvent("PublishingScheduled", request.id, {
            jobId:       job.id,
            platform:    job.platform,
            scheduledAt: job.scheduledAt,
          });
        } else {
          // Upload now
          const updatedJob = await this._uploadManager.upload(
            job,
            provider,
            { videoPath, thumbnailPath, subtitlePath, metadata: publishingMetadata },
            (progressJob) => {
              this._monitor.update(progressJob);
              this._publishEvent("UploadProgress", request.id, {
                jobId:          progressJob.id,
                platform:       progressJob.platform,
                uploadProgress: progressJob.uploadProgress,
              }).catch(() => {});
            }
          );
          Object.assign(job, updatedJob);
        }

        job.status = job.scheduledAt ? PublishingStatus.SCHEDULED : PublishingStatus.SUCCESS;
        job.state  = job.scheduledAt ? PublishingState.SCHEDULING : PublishingState.PUBLISHED;
        job.completedAt = new Date();
        this._monitor.update(job);

        await this._publishEvent("UploadCompleted", request.id, {
          jobId:          job.id,
          platform:       job.platform,
          platformVideoId: job.platformVideoId,
          publishedUrl:   job.publishedUrl,
        });
      } catch (err: unknown) {
        job.status = PublishingStatus.FAILED;
        job.state  = PublishingState.FAILED;
        job.error  = err instanceof Error ? err.message : String(err);
        this._monitor.update(job);

        // Auto-retry on failure
        if (this._retryManager.shouldRetry(job)) {
          try {
            await this._publishEvent("RetryStarted", request.id, {
              jobId:   job.id,
              attempt: job.retryCount + 1,
            });
            const retried = await this._retryManager.retry(
              job, provider,
              { videoPath, thumbnailPath, subtitlePath, metadata: publishingMetadata },
              this._uploadManager
            );
            Object.assign(job, retried);
            await this._publishEvent("RetryCompleted", request.id, {
              jobId:   job.id,
              status:  job.status,
            });
          } catch (_retryErr) {
            job.status = PublishingStatus.FAILED;
            job.error  = _retryErr instanceof Error ? _retryErr.message : String(_retryErr);
          }
        }
      }
    }

    // ── Phase 5: Build Results, Metrics, Report ───────────────────────────
    const results  = this._buildResults(jobs);
    const metrics  = this._buildMetrics(jobs, results);
    const analyticsRefs = this._buildAnalyticsRefs(jobs);

    const report: PublishingReport = {
      id:          `report-${request.id}`,
      timestamp:   new Date(),
      requestId:   request.id,
      qualityId:   request.qualityId,
      renderId:    request.renderId,
      jobs:        [...jobs],
      results,
      metadata:    publishingMetadata,
      schedule:    resolvedSchedule,
      metrics,
      analyticsRefs,
      warnings:    jobs.flatMap((j) => j.warnings),
      errors:      jobs.filter((j) => j.error).map((j) => j.error!),
    };

    // Determine final state
    const allFailed  = jobs.every((j) => j.status === PublishingStatus.FAILED);
    const anySuccess = jobs.some((j) => j.status === PublishingStatus.SUCCESS || j.status === PublishingStatus.SCHEDULED);

    this._state = allFailed
      ? PublishingState.FAILED
      : anySuccess
        ? PublishingState.PUBLISHED
        : PublishingState.FAILED;

    // ── Phase 6: Snapshot ─────────────────────────────────────────────────
    const snapshot: PublishingSnapshot = deepFreeze({
      publishingId:     request.id,
      state:            this._state,
      totalTargets:     jobs.length,
      successfulUploads: metrics.successfulUploads,
      failedUploads:    metrics.failedUploads,
      publishedPlatforms: metrics.publishedPlatforms,
      failedPlatforms:  metrics.failedPlatforms,
      totalRetries:     metrics.totalRetries,
      timestamp:        new Date(),
    });
    this._snapshots.set(request.id, snapshot);

    const response: PublishingResponse = {
      id:        `pub-resp-${request.id}`,
      requestId: request.id,
      state:     this._state,
      jobs:      [...jobs],
      results,
      report,
      metrics,
      snapshot,
      timestamp: new Date(),
    };

    this._responses.set(request.id, response);
    this._reports.set(request.id, report);
    this._history.push(response);

    // ── Phase 7: Integrations ─────────────────────────────────────────────

    // Memory Integration
    if (this.context?.memoryStore) {
      const store = this.context.memoryStore;
      await store.set("publishing-history", `publishing:${request.id}`, response, {
        qualityId: request.qualityId,
        renderId:  request.renderId,
      });
      await store.set("published-video-ids", `pub-ids:${request.id}`,
        jobs.filter((j) => j.platformVideoId).map((j) => ({
          platform: j.platform,
          videoId: j.platformVideoId,
          url: j.publishedUrl,
        }))
      );
      if (metrics.failedUploads > 0) {
        await store.set("failed-uploads", `failed:${request.id}`,
          jobs.filter((j) => j.status === PublishingStatus.FAILED).map((j) => ({
            jobId: j.id,
            platform: j.platform,
            error: j.error,
          }))
        );
      }
    }

    // Decision Engine Integration
    if (this.context?.registry) {
      try {
        const token = { name: "IDecisionEngine" } as any;
        if (this.context.registry.has(token)) {
          const decisionEngine = this.context.registry.resolve(token) as any;
          if (decisionEngine?.record) {
            await decisionEngine.record({
              publishingId:      request.id,
              qualityId:         request.qualityId,
              publishedPlatforms: metrics.publishedPlatforms,
              failedPlatforms:   metrics.failedPlatforms,
              totalRetries:      metrics.totalRetries,
              successRate:       metrics.totalTargets > 0
                ? (metrics.successfulUploads / metrics.totalTargets) * 100
                : 0,
              uploadDurationSeconds: metrics.totalUploadDurationSeconds,
              schedule: resolvedSchedule.mode,
              metadata: {
                title:    publishingMetadata.title,
                tagsCount: publishingMetadata.tags.length,
                hashtagsCount: publishingMetadata.hashtags.length,
              },
            });
          }
        }
      } catch (_) {}
    }

    // Planning Engine Integration
    if (this.context?.planningEngine) {
      try {
        const planningEngine = this.context.planningEngine as any;
        if (planningEngine?.createTask) {
          await planningEngine.createTask({
            type: "PUBLISHING_COMPLETE",
            publishingId: request.id,
            results,
          });
        }
      } catch (_) {}
    }

    await this._publishEvent("PublishingCompleted", request.id, {
      state:             this._state,
      successCount:      metrics.successfulUploads,
      failureCount:      metrics.failedUploads,
      publishedPlatforms: metrics.publishedPlatforms,
    });

    return response;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private _buildJob(
    requestId: string,
    target: PublishingTarget,
    maxRetries: number
  ): PublishingJob {
    return {
      id:                  `job-${requestId}-${target.platform}`,
      requestId,
      platform:            target.platform,
      target,
      status:              PublishingStatus.PENDING,
      state:               PublishingState.PREPARING,
      uploadProgress:      0,
      processingProgress:  0,
      retryCount:          0,
      maxRetries,
      warnings:            [],
    };
  }

  private _buildResults(jobs: PublishingJob[]): PublishingResult[] {
    return jobs.map((job) => ({
      jobId:                    job.id,
      platform:                 job.platform,
      status:                   job.status,
      platformVideoId:          job.platformVideoId,
      publishedUrl:             job.publishedUrl,
      uploadDurationSeconds:    0.5, // mock
      processingDurationSeconds: 1.0, // mock
      retries:                  job.retryCount,
      publishedAt:              job.publishedAt,
      scheduledAt:              job.scheduledAt,
      error:                    job.error,
      warnings:                 [...job.warnings],
    }));
  }

  private _buildMetrics(jobs: PublishingJob[], results: PublishingResult[]): any {
    const successful = jobs.filter(
      (j) => j.status === PublishingStatus.SUCCESS || j.status === PublishingStatus.SCHEDULED
    );
    const failed = jobs.filter((j) => j.status === PublishingStatus.FAILED);
    const scheduled = jobs.filter((j) => j.status === PublishingStatus.SCHEDULED);
    const totalRetries = jobs.reduce((sum, j) => sum + j.retryCount, 0);
    const totalUpload = results.reduce((sum, r) => sum + r.uploadDurationSeconds, 0);
    const totalProcessing = results.reduce((sum, r) => sum + r.processingDurationSeconds, 0);

    return {
      totalTargets:              jobs.length,
      successfulUploads:         successful.length,
      failedUploads:             failed.length,
      scheduledUploads:          scheduled.length,
      totalRetries,
      totalUploadDurationSeconds: totalUpload,
      totalProcessingDurationSeconds: totalProcessing,
      averageUploadSpeedMbps:    50, // mock
      metadataGenerationTimeSeconds: 0.1,
      publishedPlatforms: successful.map((j) => j.platform),
      failedPlatforms:   failed.map((j) => j.platform),
    };
  }

  private _buildAnalyticsRefs(jobs: PublishingJob[]): PublishingAnalyticsReference[] {
    return jobs
      .filter((j) => j.platformVideoId && j.publishedUrl)
      .map((j) => ({
        jobId:           j.id,
        platform:        j.platform,
        platformVideoId: j.platformVideoId!,
        publishedUrl:    j.publishedUrl!,
      }));
  }

  private _resolveVideoPath(request: PublishingRequest): string {
    // Try render engine history for the actual output path
    if (this.context?.renderEngine) {
      try {
        const renderHistory = this.context.renderEngine.getHistory();
        const renderResp = renderHistory.find(
          (r: any) => r.requestId === request.renderId
        ) || renderHistory[renderHistory.length - 1];
        if (renderResp?.outputPath) return renderResp.outputPath;
      } catch (_) {}
    }
    return `/outputs/${request.renderId}.mp4`;
  }

  private async _publishEvent(
    name: string,
    correlationId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (this.context?.eventBus) {
      try {
        await this.context.eventBus.publish({
          id:            `evt-${name.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`,
          name,
          timestamp:     new Date(),
          correlationId,
          source:        "PublishingEngine",
          payload,
          metadata:      {},
        });
      } catch (_) {}
    }
  }
}
