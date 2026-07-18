import {
  IChannelManager,
  IChannelProvider,
  IAccountManager,
  IOAuthManager,
  ISynchronizer,
  IUploadQueueManager,
  IScheduleManager,
  ICapabilityResolver,
  IChannelMonitor,
  IHistoryManager,
} from "./interfaces";
import { ChannelManagerState } from "./ChannelManagerState";
import { PlatformProvider }    from "./PlatformProvider";
import { AccountStatus }       from "./AccountStatus";
import { UploadQueueState }    from "./UploadQueueState";
import { ScheduleStatus }      from "./ScheduleStatus";
import { CapabilityType }      from "./CapabilityType";
import { SyncStatus }          from "./SyncStatus";
import {
  ChannelManagerRequest,
  ChannelManagerResponse,
  ConnectedChannel,
  ChannelProfile,
  PlatformAccount,
  OAuthToken,
  RefreshToken,
  PlatformCapabilities,
  UploadQueue,
  QueueItem,
  ScheduledPost,
  PublishingHistory,
  HistoryEntry,
  DraftVideo,
  Playlist,
  SyncJob,
  SyncResult,
  ChannelReport,
  ChannelSnapshot,
  ChannelHealth,
  ChannelMetrics,
  ChannelStatisticsReference,
  Category,
  ProviderRateLimit,
} from "./models";
import { ChannelManagerValidator } from "./ChannelManagerValidator";
import {
  ChannelManagerException,
  ChannelNotFoundException,
  ProviderNotFoundException,
  OAuthException,
  TokenExpiredException,
  DuplicateChannelException,
  QueueConflictException,
  deepFreeze,
} from "./types";

// ─── Default Channel Provider (Base) ─────────────────────────────────────────

class BaseChannelProvider implements IChannelProvider {
  public readonly platform: PlatformProvider;
  private readonly _caps: PlatformCapabilities;

  constructor(platform: PlatformProvider, caps: PlatformCapabilities) {
    this.platform = platform;
    this._caps    = caps;
  }

  public async fetchProfile(_oauth: OAuthToken): Promise<Partial<ChannelProfile>> {
    return {
      channelId:       `${this.platform.toLowerCase()}-channel-001`,
      channelName:     `Shaily Studio on ${this.platform}`,
      displayName:     "Shaily Studio",
      description:     `Auto-managed ${this.platform} channel.`,
      subscriberCount: 10_000,
      videoCount:      120,
      viewCount:       5_000_000,
      language:        "en",
      verified:        false,
      monetized:       this.platform === PlatformProvider.YOUTUBE || this.platform === PlatformProvider.RUMBLE,
    };
  }

  public getCapabilities(): PlatformCapabilities { return this._caps; }

  public async validateToken(_oauth: OAuthToken): Promise<{ valid: boolean; expiresInSeconds: number }> {
    const now    = Date.now();
    const expiry = _oauth.expiresAt.getTime();
    return {
      valid:            expiry > now,
      expiresInSeconds: Math.max(0, Math.floor((expiry - now) / 1000)),
    };
  }

  public async fetchDrafts(_oauth: OAuthToken): Promise<DraftVideo[]> { return []; }

  public async fetchPlaylists(_oauth: OAuthToken): Promise<Playlist[]> { return []; }

  public async ping(): Promise<boolean> { return true; }
}

function makeRateLimit(uploadsPerDay: number): ProviderRateLimit {
  return { uploadsPerDay, requestsPerMinute: 300, requestsPerDay: 10_000, currentUploadsToday: 0, currentRequestsThisMinute: 0 };
}

const PROVIDER_CAPS: Record<PlatformProvider, PlatformCapabilities> = {
  [PlatformProvider.YOUTUBE]: {
    provider:             PlatformProvider.YOUTUBE,
    supported:            [CapabilityType.LONG_VIDEO, CapabilityType.SHORTS, CapabilityType.LIVE, CapabilityType.PLAYLISTS, CapabilityType.THUMBNAILS, CapabilityType.SUBTITLES, CapabilityType.CUSTOM_THUMBNAILS, CapabilityType.SCHEDULED_UPLOADS, CapabilityType.ANALYTICS, CapabilityType.COMMENTS, CapabilityType.MEMBERSHIP, CapabilityType.MONETIZATION],
    maxFileSizeBytes:     137_438_953_472, maxDurationSeconds: 43_200, maxTitleLength: 100, maxDescriptionLength: 5000, maxTagCount: 500,
    supportedResolutions: ["360P","480P","720P","1080P","1440P","4K"], supportedFormats: ["mp4","mov","avi","mkv"],
    rateLimit:            makeRateLimit(6),
  },
  [PlatformProvider.INSTAGRAM]: {
    provider:             PlatformProvider.INSTAGRAM,
    supported:            [CapabilityType.REELS, CapabilityType.STORIES, CapabilityType.THUMBNAILS, CapabilityType.ANALYTICS, CapabilityType.COMMENTS],
    maxFileSizeBytes:     4_294_967_296, maxDurationSeconds: 3_600, maxTitleLength: 2200, maxDescriptionLength: 2200, maxTagCount: 30,
    supportedResolutions: ["720P","1080P"], supportedFormats: ["mp4","mov"],
    rateLimit:            makeRateLimit(25),
  },
  [PlatformProvider.TIKTOK]: {
    provider:             PlatformProvider.TIKTOK,
    supported:            [CapabilityType.SHORTS, CapabilityType.SUBTITLES, CapabilityType.ANALYTICS, CapabilityType.COMMENTS, CapabilityType.SCHEDULED_UPLOADS],
    maxFileSizeBytes:     4_294_967_296, maxDurationSeconds: 600, maxTitleLength: 150, maxDescriptionLength: 2200, maxTagCount: 20,
    supportedResolutions: ["720P","1080P"], supportedFormats: ["mp4","mov","webm"],
    rateLimit:            makeRateLimit(10),
  },
  [PlatformProvider.FACEBOOK]: {
    provider:             PlatformProvider.FACEBOOK,
    supported:            [CapabilityType.LONG_VIDEO, CapabilityType.LIVE, CapabilityType.PLAYLISTS, CapabilityType.THUMBNAILS, CapabilityType.SCHEDULED_UPLOADS, CapabilityType.ANALYTICS, CapabilityType.COMMENTS, CapabilityType.MONETIZATION],
    maxFileSizeBytes:     10_737_418_240, maxDurationSeconds: 14_400, maxTitleLength: 255, maxDescriptionLength: 63_206, maxTagCount: 30,
    supportedResolutions: ["360P","480P","720P","1080P"], supportedFormats: ["mp4","mov","avi"],
    rateLimit:            makeRateLimit(50),
  },
  [PlatformProvider.X]: {
    provider:             PlatformProvider.X,
    supported:            [CapabilityType.SHORTS, CapabilityType.ANALYTICS, CapabilityType.COMMENTS],
    maxFileSizeBytes:     536_870_912, maxDurationSeconds: 140, maxTitleLength: 280, maxDescriptionLength: 280, maxTagCount: 10,
    supportedResolutions: ["720P","1080P"], supportedFormats: ["mp4","mov"],
    rateLimit:            makeRateLimit(100),
  },
  [PlatformProvider.LINKEDIN]: {
    provider:             PlatformProvider.LINKEDIN,
    supported:            [CapabilityType.LONG_VIDEO, CapabilityType.THUMBNAILS, CapabilityType.SUBTITLES, CapabilityType.SCHEDULED_UPLOADS, CapabilityType.ANALYTICS, CapabilityType.COMMENTS],
    maxFileSizeBytes:     5_368_709_120, maxDurationSeconds: 600, maxTitleLength: 200, maxDescriptionLength: 700, maxTagCount: 30,
    supportedResolutions: ["360P","720P","1080P"], supportedFormats: ["mp4","mov","avi"],
    rateLimit:            makeRateLimit(5),
  },
  [PlatformProvider.RUMBLE]: {
    provider:             PlatformProvider.RUMBLE,
    supported:            [CapabilityType.LONG_VIDEO, CapabilityType.LIVE, CapabilityType.THUMBNAILS, CapabilityType.SUBTITLES, CapabilityType.ANALYTICS, CapabilityType.MONETIZATION, CapabilityType.SCHEDULED_UPLOADS],
    maxFileSizeBytes:     10_737_418_240, maxDurationSeconds: 43_200, maxTitleLength: 200, maxDescriptionLength: 5000, maxTagCount: 20,
    supportedResolutions: ["360P","480P","720P","1080P","1440P","4K"], supportedFormats: ["mp4","mov","avi"],
    rateLimit:            makeRateLimit(10),
  },
  [PlatformProvider.CUSTOM]: {
    provider:             PlatformProvider.CUSTOM,
    supported:            Object.values(CapabilityType),
    maxFileSizeBytes:     Number.MAX_SAFE_INTEGER, maxDurationSeconds: Number.MAX_SAFE_INTEGER, maxTitleLength: 1000, maxDescriptionLength: 100_000, maxTagCount: 1000,
    supportedResolutions: ["360P","480P","720P","1080P","1440P","4K"], supportedFormats: ["mp4","mov","avi","mkv","webm"],
    rateLimit:            makeRateLimit(10_000),
  },
};

// ─── Provider Registry ────────────────────────────────────────────────────────

class ProviderRegistry {
  private readonly _map = new Map<PlatformProvider, IChannelProvider>();

  constructor(initial: IChannelProvider[]) {
    for (const p of initial) this._map.set(p.platform, p);
  }

  public registerProvider(provider: IChannelProvider): void {
    this._map.set(provider.platform, provider);
  }

  public removeProvider(platform: PlatformProvider): void {
    this._map.delete(platform);
  }

  public getProvider(platform: PlatformProvider): IChannelProvider {
    const p = this._map.get(platform);
    if (!p) throw new ProviderNotFoundException(platform);
    return p;
  }

  public listProviders(): PlatformProvider[] {
    return [...this._map.keys()];
  }
}

// ─── Default Account Manager ─────────────────────────────────────────────────

class DefaultAccountManager implements IAccountManager {
  private readonly _channels = new Map<string, ConnectedChannel>();

  public async connect(provider: PlatformProvider, account: PlatformAccount, oauth: OAuthToken): Promise<ConnectedChannel> {
    const channelId = account.accountId;
    if (this._channels.has(channelId)) throw new DuplicateChannelException(channelId);

    const channel: ConnectedChannel = {
      id:           channelId,
      provider,
      profile: {
        channelId,
        channelName:     account.displayName,
        displayName:     account.displayName,
        description:     "",
        subscriberCount: 0,
        videoCount:      0,
        viewCount:       0,
        language:        "en",
        verified:        false,
        monetized:       false,
      },
      account,
      oauth,
      capabilities: PROVIDER_CAPS[provider],
      health: {
        channelId, provider,
        isHealthy:           true,
        tokenStatus:         "VALID",
        tokenExpiresInHours: Math.floor((oauth.expiresAt.getTime() - Date.now()) / 3_600_000),
        apiReachable:        true,
        rateLimitRemaining:  1,
        uploadFailureRate:   0,
        lastCheckedAt:       new Date(),
        issues:              [],
        warnings:            [],
      },
      status:       AccountStatus.CONNECTED,
      connectedAt:  new Date(),
      metadata:     {},
    };
    this._channels.set(channelId, channel);
    return channel;
  }

  public async disconnect(channelId: string): Promise<void> {
    if (!this._channels.has(channelId)) throw new ChannelNotFoundException(channelId);
    const ch = this._channels.get(channelId)!;
    ch.status = AccountStatus.DISCONNECTED;
    this._channels.delete(channelId);
  }

  public getChannel(channelId: string): ConnectedChannel | undefined {
    return this._channels.get(channelId);
  }

  public listChannels(): ConnectedChannel[] {
    return [...this._channels.values()];
  }

  public updateStatus(channelId: string, status: AccountStatus): void {
    const ch = this._channels.get(channelId);
    if (ch) ch.status = status;
  }
}

// ─── Default OAuth Manager ────────────────────────────────────────────────────

class DefaultOAuthManager implements IOAuthManager {
  private readonly _tokens = new Map<string, OAuthToken>();

  public storeToken(channelId: string, token: OAuthToken): void {
    this._tokens.set(channelId, { ...token, isExpired: this.isExpired(token) });
  }

  public getToken(channelId: string): OAuthToken | undefined {
    return this._tokens.get(channelId);
  }

  public async refreshToken(channelId: string, refresh: RefreshToken): Promise<OAuthToken> {
    if (!refresh.token) throw new OAuthException(channelId, "Refresh token is missing.");
    const now      = new Date();
    const newToken: OAuthToken = {
      accessToken:      `refreshed-access-token-${Date.now()}`,
      refreshToken:     refresh.token,
      tokenType:        "Bearer",
      expiresAt:        new Date(now.getTime() + 3_600_000),
      scopes:           ["read", "write", "upload"],
      issuedAt:         now,
      isExpired:        false,
      expiresInSeconds: 3600,
    };
    this._tokens.set(channelId, newToken);
    return newToken;
  }

  public isExpired(token: OAuthToken, thresholdMinutes = 5): boolean {
    const buffer = thresholdMinutes * 60_000;
    return token.expiresAt.getTime() - Date.now() <= buffer;
  }

  public async revokeToken(channelId: string): Promise<void> {
    this._tokens.delete(channelId);
  }
}

// ─── Default Synchronizer ─────────────────────────────────────────────────────

class DefaultSynchronizer implements ISynchronizer {
  public async sync(channel: ConnectedChannel, provider: IChannelProvider): Promise<SyncResult> {
    const start = Date.now();
    const [profilePartial, drafts, playlists] = await Promise.all([
      provider.fetchProfile(channel.oauth),
      provider.fetchDrafts(channel.oauth),
      provider.fetchPlaylists(channel.oauth),
    ]);
    // Merge profile
    Object.assign(channel.profile, profilePartial);
    channel.lastSyncedAt = new Date();
    return {
      channelId:       channel.id,
      provider:        channel.provider,
      status:          SyncStatus.COMPLETED,
      syncedDrafts:    drafts.length,
      syncedPlaylists: playlists.length,
      syncedSchedules: 0,
      syncedHistory:   0,
      syncedProfile:   true,
      duration:        Date.now() - start,
      errors:          [],
      timestamp:       new Date(),
    };
  }

  public async syncProfile(channel: ConnectedChannel, provider: IChannelProvider): Promise<Partial<ChannelProfile>> {
    const partial = await provider.fetchProfile(channel.oauth);
    Object.assign(channel.profile, partial);
    return partial;
  }

  public async syncDrafts(channel: ConnectedChannel, provider: IChannelProvider): Promise<DraftVideo[]> {
    return provider.fetchDrafts(channel.oauth);
  }

  public async syncPlaylists(channel: ConnectedChannel, provider: IChannelProvider): Promise<Playlist[]> {
    return provider.fetchPlaylists(channel.oauth);
  }
}

// ─── Default Upload Queue Manager ────────────────────────────────────────────

class DefaultUploadQueueManager implements IUploadQueueManager {
  private readonly _queues  = new Map<string, Map<string, QueueItem>>();

  private _ensureQueue(channelId: string): Map<string, QueueItem> {
    if (!this._queues.has(channelId)) this._queues.set(channelId, new Map());
    return this._queues.get(channelId)!;
  }

  public enqueue(item: QueueItem): void {
    const queue = this._ensureQueue(item.channelId);
    if (queue.has(item.id)) throw new QueueConflictException(item.id);
    queue.set(item.id, { ...item, state: UploadQueueState.WAITING });
  }

  public dequeue(itemId: string): QueueItem | undefined {
    for (const [, queue] of this._queues) {
      if (queue.has(itemId)) {
        const item = queue.get(itemId)!;
        queue.delete(itemId);
        return item;
      }
    }
    return undefined;
  }

  public getQueue(channelId: string): UploadQueue {
    const queue = this._ensureQueue(channelId);
    const items = [...queue.values()];
    return {
      channelId,
      items,
      totalItems:      items.length,
      waitingCount:    items.filter(i => i.state === UploadQueueState.WAITING).length,
      uploadingCount:  items.filter(i => i.state === UploadQueueState.UPLOADING).length,
      publishedCount:  items.filter(i => i.state === UploadQueueState.PUBLISHED).length,
      failedCount:     items.filter(i => i.state === UploadQueueState.FAILED).length,
      lastUpdated:     new Date(),
    };
  }

  public requeueFailed(channelId: string): QueueItem[] {
    const queue   = this._ensureQueue(channelId);
    const requeued: QueueItem[] = [];
    for (const item of queue.values()) {
      if (item.state === UploadQueueState.FAILED && item.retryCount < item.maxRetries) {
        item.state = UploadQueueState.WAITING;
        item.retryCount++;
        requeued.push(item);
      }
    }
    return requeued;
  }

  public cancel(itemId: string): void {
    for (const queue of this._queues.values()) {
      if (queue.has(itemId)) {
        queue.get(itemId)!.state = UploadQueueState.CANCELLED;
        return;
      }
    }
  }

  public nextReady(channelId: string): QueueItem | undefined {
    const queue = this._ensureQueue(channelId);
    return [...queue.values()]
      .filter(i => i.state === UploadQueueState.WAITING || i.state === UploadQueueState.READY)
      .sort((a, b) => a.priority - b.priority)[0];
  }
}

// ─── Default Schedule Manager ─────────────────────────────────────────────────

class DefaultScheduleManager implements IScheduleManager {
  private readonly _schedules = new Map<string, ScheduledPost>();

  public schedule(post: ScheduledPost): void {
    this._schedules.set(post.id, post);
  }

  public cancel(postId: string): void {
    const post = this._schedules.get(postId);
    if (post) post.status = ScheduleStatus.FAILED;
  }

  public getSchedules(channelId: string): ScheduledPost[] {
    return [...this._schedules.values()].filter(p => p.channelId === channelId);
  }

  public getDuePosts(now = new Date()): ScheduledPost[] {
    return [...this._schedules.values()].filter(
      p => p.status === ScheduleStatus.PENDING && p.scheduledAt <= now
    );
  }

  public hasConflict(channelId: string, scheduledAt: Date): boolean {
    const windowMs = 5 * 60_000; // 5-minute buffer
    return [...this._schedules.values()].some(
      p => p.channelId === channelId &&
           p.status === ScheduleStatus.PENDING &&
           Math.abs(p.scheduledAt.getTime() - scheduledAt.getTime()) < windowMs
    );
  }
}

// ─── Default Capability Resolver ──────────────────────────────────────────────

class DefaultCapabilityResolver implements ICapabilityResolver {
  public resolve(provider: PlatformProvider): PlatformCapabilities {
    return PROVIDER_CAPS[provider] ?? PROVIDER_CAPS[PlatformProvider.CUSTOM];
  }

  public supports(provider: PlatformProvider, capability: CapabilityType): boolean {
    return this.resolve(provider).supported.includes(capability);
  }

  public getSupportedCapabilities(provider: PlatformProvider): CapabilityType[] {
    return this.resolve(provider).supported;
  }
}

// ─── Default Channel Monitor ──────────────────────────────────────────────────

class DefaultChannelMonitor implements IChannelMonitor {
  private readonly _healthMap = new Map<string, ChannelHealth>();

  public async checkHealth(channel: ConnectedChannel, provider: IChannelProvider): Promise<ChannelHealth> {
    const [tokenResult, apiReachable] = await Promise.all([
      provider.validateToken(channel.oauth),
      provider.ping(),
    ]);

    const expiresInHours = Math.floor(tokenResult.expiresInSeconds / 3600);
    const tokenStatus = !tokenResult.valid
      ? "EXPIRED"
      : expiresInHours < 1
        ? "EXPIRING_SOON"
        : "VALID";

    const health: ChannelHealth = {
      channelId:             channel.id,
      provider:              channel.provider,
      isHealthy:             tokenResult.valid && apiReachable,
      tokenStatus,
      tokenExpiresInHours:   expiresInHours,
      apiReachable,
      rateLimitRemaining:    1,
      uploadFailureRate:     0,
      lastCheckedAt:         new Date(),
      issues:                tokenResult.valid ? [] : [`Token expired for channel ${channel.id}`],
      warnings:              expiresInHours < 2 ? [`Token expiring in ${expiresInHours}h`] : [],
    };

    this._healthMap.set(channel.id, health);
    return health;
  }

  public getHealth(channelId: string): ChannelHealth | undefined {
    return this._healthMap.get(channelId);
  }

  public updateHealth(channelId: string, health: ChannelHealth): void {
    this._healthMap.set(channelId, health);
  }
}

// ─── Default History Manager ──────────────────────────────────────────────────

class DefaultHistoryManager implements IHistoryManager {
  private readonly _histories = new Map<string, PublishingHistory>();

  private _ensure(channelId: string): PublishingHistory {
    if (!this._histories.has(channelId)) {
      this._histories.set(channelId, {
        channelId, entries: [], totalUploads: 0, successfulUploads: 0,
        failedUploads: 0, manualUploads: 0, scheduledUploads: 0,
      });
    }
    return this._histories.get(channelId)!;
  }

  public record(channelId: string, entry: HistoryEntry): void {
    const history = this._ensure(channelId);
    history.entries.push(entry);
    history.totalUploads++;
    history.successfulUploads++;
    if (entry.source === "SCHEDULED") history.scheduledUploads++;
    if (entry.source === "MANUAL")    history.manualUploads++;
    history.lastUploadAt = entry.publishedAt;
  }

  public getHistory(channelId: string): PublishingHistory {
    return this._ensure(channelId);
  }

  public markDeleted(channelId: string, entryId: string): void {
    const history = this._ensure(channelId);
    const entry   = history.entries.find(e => e.id === entryId);
    if (entry) { entry.deleted = true; entry.deletedAt = new Date(); }
  }
}

// ─── Channel Manager Engine ───────────────────────────────────────────────────

export class ChannelManagerEngine implements IChannelManager {
  private _state = ChannelManagerState.CREATED;
  private readonly _responses: ChannelManagerResponse[] = [];
  private readonly _snapshots = new Map<string, ChannelSnapshot>();
  private readonly _reports   = new Map<string, ChannelReport>();
  private readonly _drafts    = new Map<string, DraftVideo[]>();
  private readonly _playlists = new Map<string, Playlist[]>();
  private readonly _metrics   = new Map<string, ChannelMetrics>();

  private readonly _providerRegistry: ProviderRegistry;
  private readonly _accountManager:   IAccountManager;
  private readonly _oauthManager:     IOAuthManager;
  private readonly _synchronizer:     ISynchronizer;
  private readonly _queueManager:     IUploadQueueManager;
  private readonly _scheduler:        IScheduleManager;
  private readonly _capResolver:      ICapabilityResolver;
  private readonly _monitor:          IChannelMonitor;
  private readonly _historyManager:   IHistoryManager;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    accountManager?: IAccountManager,
    oauthManager?: IOAuthManager,
    synchronizer?: ISynchronizer,
    queueManager?: IUploadQueueManager,
    scheduler?: IScheduleManager,
    capResolver?: ICapabilityResolver,
    monitor?: IChannelMonitor,
    historyManager?: IHistoryManager,
    extraProviders?: IChannelProvider[]
  ) {
    this._accountManager = accountManager || new DefaultAccountManager();
    this._oauthManager   = oauthManager   || new DefaultOAuthManager();
    this._synchronizer   = synchronizer   || new DefaultSynchronizer();
    this._queueManager   = queueManager   || new DefaultUploadQueueManager();
    this._scheduler      = scheduler      || new DefaultScheduleManager();
    this._capResolver    = capResolver    || new DefaultCapabilityResolver();
    this._monitor        = monitor        || new DefaultChannelMonitor();
    this._historyManager = historyManager || new DefaultHistoryManager();

    const builtIn: IChannelProvider[] = Object.values(PlatformProvider).map(
      p => new BaseChannelProvider(p, PROVIDER_CAPS[p])
    );
    this._providerRegistry = new ProviderRegistry([...builtIn, ...(extraProviders ?? [])]);
  }

  public get state(): ChannelManagerState { return this._state; }

  // ─── Provider Registry (public API) ────────────────────────────────────────

  public registerProvider(provider: IChannelProvider): void {
    this._providerRegistry.registerProvider(provider);
  }

  public removeProvider(platform: PlatformProvider): void {
    this._providerRegistry.removeProvider(platform);
  }

  public getProvider(platform: PlatformProvider): IChannelProvider {
    return this._providerRegistry.getProvider(platform);
  }

  public listProviders(): PlatformProvider[] {
    return this._providerRegistry.listProviders();
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    ChannelManagerValidator.validateStateTransition("engine", this._state, ChannelManagerState.INITIALIZED);
    this._state = ChannelManagerState.INITIALIZED;
  }

  public async start(): Promise<void> {
    this._state = ChannelManagerState.READY;
  }

  public async stop(): Promise<void> {
    this._state = ChannelManagerState.PAUSED;
  }

  public getSnapshot(channelId: string): ChannelSnapshot {
    const s = this._snapshots.get(channelId);
    if (!s) throw new ChannelNotFoundException(channelId);
    return s;
  }

  public getReport(channelId: string): ChannelReport {
    const r = this._reports.get(channelId);
    if (!r) throw new ChannelNotFoundException(channelId);
    return r;
  }

  public getConnectedChannels(): ConnectedChannel[] {
    return this._accountManager.listChannels();
  }

  public getHistory(): ChannelManagerResponse[] {
    return [...this._responses];
  }

  // ─── Core Execute Method ────────────────────────────────────────────────────

  public async execute(request: ChannelManagerRequest): Promise<ChannelManagerResponse> {
    ChannelManagerValidator.validateRequest(request);

    await this._publishEvent("ChannelManagerActionStarted", request.id, {
      action: request.action, channelId: request.channelId, provider: request.provider,
    });

    let connectedChannels: ConnectedChannel[] = this._accountManager.listChannels();
    let syncResults: SyncResult[] = [];

    switch (request.action) {

      // ── CONNECT ─────────────────────────────────────────────────────────────
      case "CONNECT": {
        ChannelManagerValidator.validateConnectPayload(request);
        this._state = ChannelManagerState.CONNECTING;

        const provider = request.provider!;
        const payload  = request.payload as any;
        const account: PlatformAccount = {
          accountId:      payload.accountId,
          platformUserId: payload.platformUserId ?? payload.accountId,
          displayName:    payload.displayName ?? provider,
          email:          payload.email,
          provider,
          status:         AccountStatus.CONNECTED,
          scopes:         payload.scopes ?? ["read", "write", "upload"],
          createdAt:      new Date(),
          updatedAt:      new Date(),
        };
        const oauth: OAuthToken = {
          accessToken:      payload.accessToken,
          refreshToken:     payload.refreshToken,
          tokenType:        "Bearer",
          expiresAt:        payload.expiresAt ? new Date(payload.expiresAt) : new Date(Date.now() + 3_600_000),
          scopes:           account.scopes,
          issuedAt:         new Date(),
          isExpired:        false,
          expiresInSeconds: 3600,
        };

        ChannelManagerValidator.validateOAuthToken(oauth, account.accountId);
        const channel = await this._accountManager.connect(provider, account, oauth);
        this._oauthManager.storeToken(channel.id, oauth);

        // Sync profile after connecting
        const providerImpl = this._providerRegistry.getProvider(provider);
        const profile = await providerImpl.fetchProfile(oauth);
        Object.assign(channel.profile, profile);

        this._state = ChannelManagerState.CONNECTED;
        await this._publishEvent("ChannelConnected", request.id, { channelId: channel.id, provider });
        connectedChannels = this._accountManager.listChannels();
        break;
      }

      // ── DISCONNECT ───────────────────────────────────────────────────────────
      case "DISCONNECT": {
        const channelId = request.channelId!;
        await this._accountManager.disconnect(channelId);
        await this._oauthManager.revokeToken(channelId);
        this._state = ChannelManagerState.DISCONNECTED;
        await this._publishEvent("ChannelDisconnected", request.id, { channelId });
        connectedChannels = this._accountManager.listChannels();
        break;
      }

      // ── SYNC ─────────────────────────────────────────────────────────────────
      case "SYNC": {
        this._state = ChannelManagerState.SYNCING;
        const channelsToSync = request.channelId
          ? [this._accountManager.getChannel(request.channelId)].filter(Boolean) as ConnectedChannel[]
          : this._accountManager.listChannels();

        await this._publishEvent("SynchronizationStarted", request.id, { count: channelsToSync.length });

        for (const ch of channelsToSync) {
          const pImpl = this._providerRegistry.getProvider(ch.provider);
          // Auto-refresh expired token
          if (this._oauthManager.isExpired(ch.oauth)) {
            if (ch.oauth.refreshToken) {
              const newToken = await this._oauthManager.refreshToken(ch.id, {
                token: ch.oauth.refreshToken!, channelId: ch.id, provider: ch.provider,
                issuedAt: new Date(), rotated: false,
              });
              ch.oauth = newToken;
              await this._publishEvent("TokenRefreshed", request.id, { channelId: ch.id });
            }
          }
          const result = await this._synchronizer.sync(ch, pImpl);
          syncResults.push(result);
        }

        this._state = ChannelManagerState.READY;
        await this._publishEvent("SynchronizationCompleted", request.id, {
          channels: channelsToSync.length, results: syncResults.length,
        });
        connectedChannels = this._accountManager.listChannels();
        break;
      }

      // ── REFRESH_TOKEN ────────────────────────────────────────────────────────
      case "REFRESH_TOKEN": {
        const channelId = request.channelId!;
        const channel   = this._accountManager.getChannel(channelId);
        if (!channel) throw new ChannelNotFoundException(channelId);
        if (!channel.oauth.refreshToken) throw new OAuthException(channelId, "No refresh token stored.");

        const newToken = await this._oauthManager.refreshToken(channelId, {
          token: channel.oauth.refreshToken!, channelId, provider: channel.provider,
          issuedAt: new Date(), rotated: false,
        });
        channel.oauth = newToken;
        this._oauthManager.storeToken(channelId, newToken);
        await this._publishEvent("TokenRefreshed", request.id, { channelId });
        connectedChannels = this._accountManager.listChannels();
        break;
      }

      // ── QUEUE ────────────────────────────────────────────────────────────────
      case "QUEUE": {
        const payload = request.payload as any;
        const item: QueueItem = {
          id:           payload.id ?? `qi-${Date.now()}`,
          channelId:    request.channelId ?? payload.channelId,
          provider:     request.provider  ?? payload.provider,
          videoPath:    payload.videoPath,
          title:        payload.title ?? "",
          description:  payload.description ?? "",
          tags:         payload.tags ?? [],
          state:        UploadQueueState.WAITING,
          priority:     payload.priority ?? 5,
          enqueuedAt:   new Date(),
          retryCount:   0,
          maxRetries:   payload.maxRetries ?? 3,
          thumbnailPath: payload.thumbnailPath,
          subtitlePath:  payload.subtitlePath,
          scheduledAt:   payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
        };
        ChannelManagerValidator.validateQueueItem(item);
        this._queueManager.enqueue(item);
        await this._publishEvent("UploadQueued", request.id, { itemId: item.id, channelId: item.channelId });
        connectedChannels = this._accountManager.listChannels();
        break;
      }

      // ── SCHEDULE ─────────────────────────────────────────────────────────────
      case "SCHEDULE": {
        const payload = request.payload as any;
        const post: ScheduledPost = {
          id:          payload.id ?? `sp-${Date.now()}`,
          channelId:   request.channelId ?? payload.channelId,
          provider:    request.provider  ?? payload.provider,
          title:       payload.title ?? "",
          description: payload.description ?? "",
          scheduledAt: new Date(payload.scheduledAt),
          timezone:    payload.timezone ?? "UTC",
          status:      ScheduleStatus.PENDING,
          createdAt:   new Date(),
        };
        ChannelManagerValidator.validateScheduledPost(post);
        if (this._scheduler.hasConflict(post.channelId, post.scheduledAt)) {
          throw new (await import("./types")).ScheduleConflictException(
            post.channelId, post.scheduledAt.toISOString()
          );
        }
        this._scheduler.schedule(post);
        await this._publishEvent("ScheduleCreated", request.id, {
          postId: post.id, channelId: post.channelId, scheduledAt: post.scheduledAt,
        });
        connectedChannels = this._accountManager.listChannels();
        break;
      }

      // ── GET_STATUS ───────────────────────────────────────────────────────────
      case "GET_STATUS": {
        this._state = ChannelManagerState.RUNNING;
        connectedChannels = this._accountManager.listChannels();
        for (const ch of connectedChannels) {
          const pImpl = this._providerRegistry.getProvider(ch.provider);
          const health = await this._monitor.checkHealth(ch, pImpl);
          ch.health = health;
          if (!health.isHealthy) {
            this._accountManager.updateStatus(ch.id, AccountStatus.ERROR);
          }
        }
        this._state = ChannelManagerState.READY;
        break;
      }
    }

    // ── Build snapshots + reports for each connected channel ─────────────────
    for (const ch of connectedChannels) {
      const queue    = this._queueManager.getQueue(ch.id);
      const schedules= this._scheduler.getSchedules(ch.id);
      const history  = this._historyManager.getHistory(ch.id);
      const drafts   = this._drafts.get(ch.id) ?? [];
      const playlists= this._playlists.get(ch.id) ?? [];

      const snap: ChannelSnapshot = deepFreeze({
        channelId:     ch.id,
        state:         this._state,
        provider:      ch.provider,
        accountStatus: ch.status,
        channelName:   ch.profile.channelName,
        queueLength:   queue.totalItems,
        scheduledPosts: schedules.length,
        draftCount:    drafts.length,
        historyCount:  history.totalUploads,
        tokenValid:    !this._oauthManager.isExpired(ch.oauth),
        lastSyncedAt:  ch.lastSyncedAt,
        capabilities:  Object.freeze([...ch.capabilities.supported]),
        timestamp:     new Date(),
      });

      const report: ChannelReport = {
        id:           `report-${ch.id}-${request.id}`,
        channelId:    ch.id,
        provider:     ch.provider,
        timestamp:    new Date(),
        requestId:    request.id,
        profile:      ch.profile,
        account:      ch.account,
        capabilities: ch.capabilities,
        health:       ch.health,
        queue,
        scheduledPosts: schedules,
        drafts,
        history,
        playlists,
        statistics: {
          channelId:              ch.id,
          provider:               ch.provider,
          subscriberCount:        ch.profile.subscriberCount,
          totalViews:             ch.profile.viewCount,
          totalVideos:            ch.profile.videoCount,
          averageViewsPerVideo:   ch.profile.videoCount > 0 ? ch.profile.viewCount / ch.profile.videoCount : 0,
          lastUpdated:            new Date(),
        },
        syncResults,
        warnings: ch.health.warnings,
        errors:   ch.health.issues,
      };

      this._snapshots.set(ch.id, snap);
      this._reports.set(ch.id, report);
    }

    // ── Memory Integration ───────────────────────────────────────────────────
    if (this.context?.memoryStore) {
      const store = this.context.memoryStore;
      const chList = connectedChannels.map(c => ({ id: c.id, provider: c.provider, status: c.status }));
      await store.set("channel-manager", `channels:${request.id}`, chList);
      for (const ch of connectedChannels) {
        await store.set("accounts", `account:${ch.id}`, { provider: ch.provider, status: ch.status });
        await store.set("oauth", `token:${ch.id}`, { isExpired: ch.oauth.isExpired, expiresAt: ch.oauth.expiresAt });
        await store.set("queue", `queue:${ch.id}`, this._queueManager.getQueue(ch.id));
        await store.set("drafts", `drafts:${ch.id}`, this._drafts.get(ch.id) ?? []);
        await store.set("history", `history:${ch.id}`, this._historyManager.getHistory(ch.id));
        await store.set("schedule", `schedule:${ch.id}`, this._scheduler.getSchedules(ch.id));
      }
    }

    // ── Decision Integration ─────────────────────────────────────────────────
    if (this.context?.registry) {
      try {
        const token = { name: "IDecisionEngine" };
        if (this.context.registry.has?.(token)) {
          const dec = this.context.registry.resolve?.(token) as any;
          if (dec?.record) {
            await dec.record({
              channelManagerRequestId: request.id,
              action:                  request.action,
              connectedCount:          connectedChannels.length,
              syncResults:             syncResults.length,
            });
          }
        }
      } catch (_) {}
    }

    // ── Planning Integration ─────────────────────────────────────────────────
    if (this.context?.planningEngine) {
      try {
        await this.context.planningEngine.createTask({
          type:      "CHANNEL_MANAGER_ACTION_COMPLETE",
          requestId: request.id,
          action:    request.action,
          channels:  connectedChannels.length,
        });
      } catch (_) {}
    }

    const response: ChannelManagerResponse = {
      id:                `cm-resp-${request.id}`,
      requestId:         request.id,
      state:             this._state,
      connectedChannels,
      syncResults,
      queueSnapshot:     connectedChannels.length > 0
        ? this._queueManager.getQueue(connectedChannels[0].id)
        : { channelId: "none", items: [], totalItems: 0, waitingCount: 0, uploadingCount: 0, publishedCount: 0, failedCount: 0, lastUpdated: new Date() },
      report:            connectedChannels.length > 0
        ? this._reports.get(connectedChannels[0].id)!
        : {} as ChannelReport,
      snapshot:          connectedChannels.length > 0
        ? this._snapshots.get(connectedChannels[0].id)!
        : {} as ChannelSnapshot,
      timestamp:         new Date(),
    };

    this._responses.push(response);
    await this._publishEvent("ChannelManagerActionCompleted", request.id, {
      action:   request.action,
      channels: connectedChannels.length,
      state:    this._state,
    });

    return response;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async _publishEvent(name: string, correlationId: string, payload: Record<string, unknown>): Promise<void> {
    if (this.context?.eventBus) {
      try {
        await this.context.eventBus.publish({
          id:           `evt-${name.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`,
          name,
          timestamp:    new Date(),
          correlationId,
          source:       "ChannelManagerEngine",
          payload,
          metadata:     {},
        });
      } catch (_) {}
    }
  }
}
