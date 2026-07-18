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
  DraftVideo,
  Playlist,
  SyncJob,
  SyncResult,
  ChannelReport,
  ChannelSnapshot,
  ChannelHealth,
  ChannelMetrics,
} from "./models";
import { ChannelManagerState } from "./ChannelManagerState";
import { PlatformProvider }    from "./PlatformProvider";
import { AccountStatus }       from "./AccountStatus";
import { CapabilityType }      from "./CapabilityType";

// ─── Core Engine ──────────────────────────────────────────────────────────────

export interface IChannelManager {
  readonly state: ChannelManagerState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  execute(request: ChannelManagerRequest): Promise<ChannelManagerResponse>;
  getSnapshot(channelId: string): ChannelSnapshot;
  getReport(channelId: string): ChannelReport;
  getConnectedChannels(): ConnectedChannel[];
  getHistory(): ChannelManagerResponse[];
}

// ─── Platform Provider Interface ──────────────────────────────────────────────

export interface IChannelProvider {
  readonly platform: PlatformProvider;

  /** Fetches the current channel profile from the platform */
  fetchProfile(oauth: OAuthToken): Promise<Partial<ChannelProfile>>;

  /** Resolves what capabilities this platform supports */
  getCapabilities(): PlatformCapabilities;

  /** Verifies current token is valid; returns health info */
  validateToken(oauth: OAuthToken): Promise<{ valid: boolean; expiresInSeconds: number }>;

  /** Fetches drafts from the platform */
  fetchDrafts(oauth: OAuthToken): Promise<DraftVideo[]>;

  /** Fetches playlists from the platform */
  fetchPlaylists(oauth: OAuthToken): Promise<Playlist[]>;

  /** Checks if platform API is reachable */
  ping(): Promise<boolean>;
}

// ─── Account Manager ──────────────────────────────────────────────────────────

export interface IAccountManager {
  /** Register a new channel with OAuth credentials */
  connect(
    provider: PlatformProvider,
    account: PlatformAccount,
    oauth: OAuthToken
  ): Promise<ConnectedChannel>;

  /** Disconnect and remove a channel */
  disconnect(channelId: string): Promise<void>;

  /** Get a connected channel by ID */
  getChannel(channelId: string): ConnectedChannel | undefined;

  /** List all connected channels */
  listChannels(): ConnectedChannel[];

  /** Update channel status */
  updateStatus(channelId: string, status: AccountStatus): void;
}

// ─── OAuth Manager ────────────────────────────────────────────────────────────

export interface IOAuthManager {
  /** Stores an OAuth token for a channel */
  storeToken(channelId: string, token: OAuthToken): void;

  /** Retrieves the current OAuth token for a channel */
  getToken(channelId: string): OAuthToken | undefined;

  /** Refreshes the OAuth token using the refresh token */
  refreshToken(channelId: string, refreshToken: RefreshToken): Promise<OAuthToken>;

  /** Checks if the token is expired or expiring within the threshold */
  isExpired(token: OAuthToken, thresholdMinutes?: number): boolean;

  /** Revokes a token */
  revokeToken(channelId: string): Promise<void>;
}

// ─── Synchronizer ─────────────────────────────────────────────────────────────

export interface ISynchronizer {
  /** Runs a full sync for a channel: profile, drafts, playlists, history */
  sync(
    channel: ConnectedChannel,
    provider: IChannelProvider
  ): Promise<SyncResult>;

  /** Syncs only channel profile */
  syncProfile(channel: ConnectedChannel, provider: IChannelProvider): Promise<Partial<ChannelProfile>>;

  /** Syncs drafts and detects merge conflicts */
  syncDrafts(channel: ConnectedChannel, provider: IChannelProvider): Promise<DraftVideo[]>;

  /** Syncs playlists */
  syncPlaylists(channel: ConnectedChannel, provider: IChannelProvider): Promise<Playlist[]>;
}

// ─── Upload Queue Manager ─────────────────────────────────────────────────────

export interface IUploadQueueManager {
  /** Adds an item to the upload queue */
  enqueue(item: QueueItem): void;

  /** Removes an item from the queue */
  dequeue(itemId: string): QueueItem | undefined;

  /** Returns the full queue for a channel */
  getQueue(channelId: string): UploadQueue;

  /** Moves a failed item back to WAITING for retry */
  requeueFailed(channelId: string): QueueItem[];

  /** Cancels a queued item */
  cancel(itemId: string): void;

  /** Returns the next item ready for upload */
  nextReady(channelId: string): QueueItem | undefined;
}

// ─── Schedule Manager ─────────────────────────────────────────────────────────

export interface IScheduleManager {
  /** Creates a scheduled post */
  schedule(post: ScheduledPost): void;

  /** Cancels a scheduled post */
  cancel(postId: string): void;

  /** Returns all scheduled posts for a channel */
  getSchedules(channelId: string): ScheduledPost[];

  /** Returns posts due to be published right now */
  getDuePosts(now?: Date): ScheduledPost[];

  /** Detects scheduling conflicts for a given channel and time */
  hasConflict(channelId: string, scheduledAt: Date): boolean;
}

// ─── Capability Resolver ──────────────────────────────────────────────────────

export interface ICapabilityResolver {
  /** Returns capabilities for a given platform */
  resolve(provider: PlatformProvider): PlatformCapabilities;

  /** Checks if a platform supports a given capability */
  supports(provider: PlatformProvider, capability: CapabilityType): boolean;

  /** Returns all capabilities supported by a platform */
  getSupportedCapabilities(provider: PlatformProvider): CapabilityType[];
}

// ─── Channel Monitor ──────────────────────────────────────────────────────────

export interface IChannelMonitor {
  /** Evaluates channel health: token, API, rate limits */
  checkHealth(channel: ConnectedChannel, provider: IChannelProvider): Promise<ChannelHealth>;

  /** Returns the stored health for a channel */
  getHealth(channelId: string): ChannelHealth | undefined;

  /** Stores updated health for a channel */
  updateHealth(channelId: string, health: ChannelHealth): void;
}

// ─── History Manager ──────────────────────────────────────────────────────────

export interface IHistoryManager {
  /** Appends a completed upload to history */
  record(channelId: string, entry: import("./models").HistoryEntry): void;

  /** Returns publishing history for a channel */
  getHistory(channelId: string): PublishingHistory;

  /** Marks a historical entry as deleted */
  markDeleted(channelId: string, entryId: string): void;
}
