import { SocialPlatformState } from "./SocialPlatformState";
import { PlatformType } from "./PlatformType";
import { PublishState } from "./PublishState";
import { ContentType } from "./ContentType";
import { VisibilityType } from "./VisibilityType";
import { AdapterState } from "./AdapterState";
import { SocialEventType } from "./SocialEventType";
import {
  ISocialPlatformEngine,
  IPlatformManager,
  IPublishManager,
  IMetadataManager,
  IMediaValidator,
  IScheduler,
  IRetryManager,
  IAnalyticsManager,
  IAdapterManager,
  IHistoryManager,
  IAccountManager
} from "./interfaces";
import {
  SocialPost,
  PublishRequest,
  PublishResponse,
  PlatformAccount,
  PlatformAdapter,
  Caption,
  HashtagCollection,
  MentionCollection,
  PublishHistory,
  PlatformStatistics,
  PublishSnapshot,
  SocialEngineStatistics,
  RetryAttempt
} from "./models";
import {
  SocialPlatformException,
  PlatformConnectionException,
  PublishingException,
  deepFreeze
} from "./types";
import { SocialPlatformValidator } from "./SocialPlatformValidator";
import { KnowledgeNodeType } from "../knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "../knowledge-base/KnowledgeSource";

export class SocialPlatformEngine implements ISocialPlatformEngine {
  private _state: SocialPlatformState = SocialPlatformState.CREATED;
  private _eventHandlers = new Map<string, Array<(payload: any) => void>>();
  private _posts = new Map<string, SocialPost>();

  // Internal collections
  private _registeredPlatforms: PlatformType[] = [];
  private _adapters = new Map<PlatformType, PlatformAdapter>();
  private _accounts = new Map<string, PlatformAccount>();
  private _historyList: PublishHistory[] = [];

  // Statistics
  private _stats: SocialEngineStatistics = {
    totalPublishes: 0,
    successfulPublishes: 0,
    failedPublishes: 0,
    totalRetries: 0
  };

  // Managers
  private readonly _platformMgr: IPlatformManager;
  private readonly _publishMgr: IPublishManager;
  private readonly _metadataMgr: IMetadataManager;
  private readonly _mediaValidator: IMediaValidator;
  private readonly _scheduler: IScheduler;
  private readonly _retryMgr: IRetryManager;
  private readonly _analyticsMgr: IAnalyticsManager;
  private readonly _adapterMgr: IAdapterManager;
  private readonly _historyMgr: IHistoryManager;
  private readonly _accountMgr: IAccountManager;

  constructor(public readonly context: any) {
    if (!context) {
      throw new Error("Context is required for SocialPlatformEngine.");
    }

    this._platformMgr = new PlatformManagerImpl(this);
    this._publishMgr = new PublishManagerImpl(this);
    this._metadataMgr = new MetadataManagerImpl(this);
    this._mediaValidator = new MediaValidatorImpl(this);
    this._scheduler = new SchedulerImpl(this);
    this._retryMgr = new RetryManagerImpl(this);
    this._analyticsMgr = new AnalyticsManagerImpl(this);
    this._adapterMgr = new AdapterManagerImpl(this);
    this._historyMgr = new HistoryManagerImpl(this);
    this._accountMgr = new AccountManagerImpl(this);
  }

  public getState(): SocialPlatformState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state === SocialPlatformState.READY) {
      this._state = SocialPlatformState.CREATED;
    }
    this._state = SocialPlatformState.INITIALIZING;
    await this._emit(SocialEventType.PUBLISH_PROGRESS, { phase: "INITIALIZE" });
    this._state = SocialPlatformState.READY;
  }

  public async start(): Promise<void> {
    if (this._state !== SocialPlatformState.READY) {
      throw new SocialPlatformException(`Cannot start Social Engine in state: ${this._state}`);
    }
  }

  public async stop(): Promise<void> {
    this._state = SocialPlatformState.STOPPED;
  }

  // ─── Main Operations ────────────────────────────────────────────────────────

  public async publishContent(request: PublishRequest): Promise<PublishResponse> {
    if (this._state !== SocialPlatformState.READY) {
      throw new SocialPlatformException("Social Platform engine is not ready.");
    }

    this._stats.totalPublishes++;
    this._state = SocialPlatformState.PUBLISHING;

    try {
      // 1. Validation check
      const connected = this._accountMgr.getConnectedAccounts().map(a => a.platform);
      const registered = this._adapterMgr.listAdapters().map(a => a.platform);
      SocialPlatformValidator.assertValid(request, connected, registered);

      // Duplicate publish prevention check
      if (this._posts.has(request.id)) {
        throw new PublishingException("Post with this request ID is already being processed.");
      }

      await this._emit(SocialEventType.PUBLISH_STARTED, { requestId: request.id, platforms: request.platforms });

      // Create SocialPost tracking object
      const retryAttempts: Record<PlatformType, RetryAttempt> = {} as any;
      const platformUrls: Record<PlatformType, string> = {} as any;
      const statsMap: Record<PlatformType, PlatformStatistics> = {} as any;

      for (const p of request.platforms) {
        retryAttempts[p] = { attemptNumber: 0, lastAttemptAt: new Date(), canRetry: true };
        platformUrls[p] = "";
        statsMap[p] = { impressions: 0, engagementRate: 0, likes: 0, comments: 0, shares: 0 };
      }

      const post: SocialPost = {
        id: request.id,
        projectId: request.projectId,
        platforms: request.platforms,
        contentType: request.contentType,
        caption: { text: request.caption, language: "en", charCount: request.caption.length },
        hashtags: { hashtags: request.hashtags, count: request.hashtags.length },
        mentions: { mentions: request.mentions, count: request.mentions.length },
        media: request.media.map(m => ({ id: m.id, type: m.type, url: m.url, sizeBytes: m.sizeBytes, width: m.width, height: m.height, durationSeconds: m.durationSeconds })),
        visibility: request.visibility,
        status: PublishState.PENDING,
        platformUrls,
        statistics: statsMap,
        retryAttempts
      };

      this._posts.set(request.id, post);

      // Trigger adapter manager busy states
      for (const p of request.platforms) {
        const adapter = this._adapterMgr.getAdapter(p);
        if (adapter) adapter.state = AdapterState.BUSY;
      }

      // Simulate adapter uploads & retry scenarios
      for (const p of request.platforms) {
        await this._emit(SocialEventType.PUBLISH_PROGRESS, { requestId: request.id, platform: p, percent: 50 });

        let publishSuccess = false;
        let retries = 0;

        while (!publishSuccess && retries < 2) {
          try {
            // Mock connection check
            if (p === PlatformType.INSTAGRAM && this.context.forceInstagramFailure && retries === 0) {
              throw new PlatformConnectionException("Instagram temporary network timeout.");
            }

            // Perform metadata adaptations
            await this._metadataMgr.adaptMetadata(post, p);

            // Mock publishing endpoints URL return
            post.platformUrls[p] = `https://${p.toLowerCase()}.com/p/mock-post-${request.id}`;
            publishSuccess = true;

            // Log history
            const hist: PublishHistory = {
              id: `hist-${Date.now()}-${p}`,
              requestId: request.id,
              postId: `post-${request.id}`,
              platform: p,
              status: PublishState.PUBLISHED,
              url: post.platformUrls[p],
              publishedAt: new Date()
            };
            await this._historyMgr.logPublish(hist);

          } catch (err: any) {
            retries++;
            this._stats.totalRetries++;
            post.retryAttempts[p].attemptNumber = retries;
            post.retryAttempts[p].errorMessage = err.message;

            await this._emit(SocialEventType.RETRY_STARTED, { platform: p, attempt: retries });
            const canContinue = await this._retryMgr.handleRetry(post, p, err.message);
            if (!canContinue) {
              throw err;
            }
          }
        }

        // Initialize analytics metrics
        if (request.analyticsSeed) {
          await this._analyticsMgr.initializeAnalytics(post, p, request.analyticsSeed);
        }

        // Complete progress
        await this._emit(SocialEventType.PUBLISH_PROGRESS, { requestId: request.id, platform: p, percent: 100 });
        const adapter = this._adapterMgr.getAdapter(p);
        if (adapter) adapter.state = AdapterState.READY;
      }

      post.status = PublishState.PUBLISHED;
      post.publishedAt = new Date();
      this._state = SocialPlatformState.COMPLETED;
      this._stats.successfulPublishes++;

      // Archive in Knowledge Base
      if (this.context.knowledgeBaseEngine?.store) {
        await this.context.knowledgeBaseEngine.store({
          type: KnowledgeNodeType.DOCUMENT,
          title: `Publish Metadata: ${request.id}`,
          content: JSON.stringify(post),
          source: KnowledgeSource.PIPELINE_ENGINE
        });
        await this.context.knowledgeBaseEngine.store({
          type: KnowledgeNodeType.RESEARCH,
          title: `Social History: ${request.id}`,
          content: JSON.stringify(this._historyList),
          source: KnowledgeSource.PIPELINE_ENGINE
        });
      }

      // Save record in Database
      await this._dbLog(post.id, "PUBLISHED", 200);

      // Save snapshot to memory store
      if (this.context.memoryStore?.set) {
        await this.context.memoryStore.set("social", `snapshot:${post.id}`, JSON.stringify(post));
      }

      await this._emit(SocialEventType.PUBLISH_COMPLETED, { postId: `post-${post.id}`, urls: post.platformUrls });

      const response: PublishResponse = {
        id: `pub-resp-${Date.now()}`,
        requestId: request.id,
        postId: `post-${post.id}`,
        platformUrls: post.platformUrls,
        status: PublishState.PUBLISHED,
        startedAt: new Date()
      };

      return response;

    } catch (err: any) {
      this._state = SocialPlatformState.FAILED;
      this._stats.failedPublishes++;
      if (this._posts.has(request.id)) {
        this._posts.get(request.id)!.status = PublishState.FAILED;
      }
      await this._dbLog(request.id, "FAILED", 500);
      throw err;
    }
  }

  // ─── Snapshots & Telemetry ──────────────────────────────────────────────────

  public getSnapshot(): PublishSnapshot {
    const snap: PublishSnapshot = {
      snapshotId: `soc-snap-${Date.now()}`,
      state: this._state,
      registeredAdaptersCount: this._adapters.size,
      connectedAccountsCount: this._accounts.size,
      timestamp: new Date()
    };
    return deepFreeze(snap);
  }

  public getStatistics(): SocialEngineStatistics {
    return this._stats;
  }

  // ─── Manager Getters ────────────────────────────────────────────────────────

  public getPlatformManager(): IPlatformManager { return this._platformMgr; }
  public getPublishManager(): IPublishManager { return this._publishMgr; }
  public getMetadataManager(): IMetadataManager { return this._metadataMgr; }
  public getMediaValidator(): IMediaValidator { return this._mediaValidator; }
  public getScheduler(): IScheduler { return this._scheduler; }
  public getRetryManager(): IRetryManager { return this._retryMgr; }
  public getAnalyticsManager(): IAnalyticsManager { return this._analyticsMgr; }
  public getAdapterManager(): IAdapterManager { return this._adapterMgr; }
  public getHistoryManager(): IHistoryManager { return this._historyMgr; }
  public getAccountManager(): IAccountManager { return this._accountMgr; }

  // ─── Event Bus Helpers ──────────────────────────────────────────────────────

  public on(event: string, handler: (payload: any) => void): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: (payload: any) => void): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    }
  }

  public async _emit(event: SocialEventType | string, payload: Record<string, any>): Promise<void> {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(payload);
      }
    }

    if (this.context.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-soc-${event.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name: event,
          timestamp: new Date(),
          source: "SocialPlatformEngine",
          payload
        });
      } catch (_) {}
    }
  }

  private async _dbLog(postId: string, status: string, score: number): Promise<void> {
    if (this.context.databaseEngine?.getQueryManager()?.execute) {
      try {
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-soc-hist-${Date.now()}`,
          sql: "INSERT INTO social_publish_history (post_id, status, score, logged_at) VALUES (?, ?, ?, ?)",
          parameters: [postId, status, score, new Date().toISOString()]
        });
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-soc-stats-${Date.now()}`,
          sql: "INSERT INTO social_publish_statistics (post_id, impressions, engagement) VALUES (?, ?, ?)",
          parameters: [postId, 1000, 5.5]
        });
      } catch (_) {}
    }
  }

  // Internal collections accessor helpers
  public getRegisteredPlatformsList(): PlatformType[] { return this._registeredPlatforms; }
  public getAdaptersMap(): Map<PlatformType, PlatformAdapter> { return this._adapters; }
  public getAccountsMap(): Map<string, PlatformAccount> { return this._accounts; }
  public getHistoryListRef(): PublishHistory[] { return this._historyList; }
  public getPostsMap(): Map<string, SocialPost> { return this._posts; }
}

// ─── Subsystem Implementation Modules ─────────────────────────────────────────

class PlatformManagerImpl implements IPlatformManager {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public async registerPlatform(platform: PlatformType, name: string): Promise<void> {
    const list = this._engine.getRegisteredPlatformsList();
    if (!list.includes(platform)) {
      list.push(platform);
    }
    // Automatically register default adapter
    this._engine.getAdapterManager().registerAdapter({
      platform,
      state: AdapterState.READY,
      version: "1.0.0",
      capabilities: {
        supportedContentTypes: [ContentType.IMAGE, ContentType.REEL, ContentType.STORY, ContentType.TEXT],
        maxCaptionLength: platform === PlatformType.X ? 280 : 2200,
        maxHashtags: platform === PlatformType.INSTAGRAM ? 30 : 10
      }
    });
  }

  public getSupportedPlatforms(): PlatformType[] {
    return this._engine.getRegisteredPlatformsList();
  }
}

class PublishManagerImpl implements IPublishManager {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public async startPublish(request: PublishRequest): Promise<PublishResponse> {
    return this._engine.publishContent(request);
  }

  public async cancelPublish(requestId: string): Promise<void> {
    const post = this._engine.getPostsMap().get(requestId);
    if (post) post.status = PublishState.CANCELLED;
  }

  public getPost(requestId: string): SocialPost | undefined {
    return this._engine.getPostsMap().get(requestId);
  }
}

class MetadataManagerImpl implements IMetadataManager {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public async adaptMetadata(post: SocialPost, platform: PlatformType): Promise<{ caption: Caption; hashtags: HashtagCollection; mentions: MentionCollection }> {
    let cleanCaptionText = post.caption.text;
    if (platform === PlatformType.X && cleanCaptionText.length > 280) {
      cleanCaptionText = cleanCaptionText.substring(0, 277) + "...";
    }
    return {
      caption: { text: cleanCaptionText, language: "en", charCount: cleanCaptionText.length },
      hashtags: { hashtags: post.hashtags.hashtags, count: post.hashtags.count },
      mentions: { mentions: post.mentions.mentions, count: post.mentions.count }
    };
  }
}

class MediaValidatorImpl implements IMediaValidator {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public async validateMedia(media: any, platform: PlatformType): Promise<boolean> {
    if (!media || !media.url) return false;
    if (media.sizeBytes && media.sizeBytes > 100 * 1024 * 1024) return false;
    return true;
  }
}

class SchedulerImpl implements IScheduler {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public async schedulePublish(post: SocialPost, publishTime: Date): Promise<SocialPost> {
    post.schedule = {
      scheduledTime: publishTime,
      timezone: "UTC"
    };
    post.visibility = VisibilityType.SCHEDULED;
    return post;
  }
}

class RetryManagerImpl implements IRetryManager {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public async handleRetry(post: SocialPost, platform: PlatformType, error: string): Promise<boolean> {
    const attempt = post.retryAttempts[platform];
    if (attempt && attempt.attemptNumber < 2) {
      attempt.canRetry = true;
      attempt.lastAttemptAt = new Date();
      return true; // OK to retry
    }
    return false; // Stop retrying
  }
}

class AnalyticsManagerImpl implements IAnalyticsManager {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public async initializeAnalytics(post: SocialPost, platform: PlatformType, baseline: any): Promise<PlatformStatistics> {
    const stats: PlatformStatistics = {
      impressions: baseline.expectedImpressions ?? 100,
      engagementRate: baseline.expectedEngagementRate ?? 5.0,
      likes: 0,
      comments: 0,
      shares: 0
    };
    post.statistics[platform] = stats;
    await this._engine._emit(SocialEventType.ANALYTICS_INITIALIZED, { platform, postId: post.id });
    return stats;
  }

  public async getAnalytics(postId: string, platform: PlatformType): Promise<PlatformStatistics> {
    return {
      impressions: 1200,
      engagementRate: 6.8,
      likes: 95,
      comments: 12,
      shares: 4
    };
  }
}

class AdapterManagerImpl implements IAdapterManager {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public registerAdapter(adapter: PlatformAdapter): void {
    this._engine.getAdaptersMap().set(adapter.platform, adapter);
  }

  public getAdapter(platform: PlatformType): PlatformAdapter | undefined {
    return this._engine.getAdaptersMap().get(platform);
  }

  public listAdapters(): PlatformAdapter[] {
    return Array.from(this._engine.getAdaptersMap().values());
  }
}

class HistoryManagerImpl implements IHistoryManager {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public async logPublish(history: PublishHistory): Promise<void> {
    this._engine.getHistoryListRef().push(history);
  }

  public async getHistory(postId: string): Promise<PublishHistory[]> {
    return this._engine.getHistoryListRef().filter(h => h.postId === postId);
  }
}

class AccountManagerImpl implements IAccountManager {
  constructor(private readonly _engine: SocialPlatformEngine) {}

  public async connectAccount(account: PlatformAccount): Promise<void> {
    this._engine.getAccountsMap().set(account.id, account);
    await this._engine._emit(SocialEventType.PLATFORM_CONNECTED, { platform: account.platform, accountId: account.accountId });
  }

  public async disconnectAccount(accountId: string): Promise<void> {
    this._engine.getAccountsMap().delete(accountId);
  }

  public getConnectedAccounts(): PlatformAccount[] {
    return Array.from(this._engine.getAccountsMap().values());
  }

  public isAccountConnected(platform: PlatformType): boolean {
    return Array.from(this._engine.getAccountsMap().values()).some(a => a.platform === platform);
  }
}
