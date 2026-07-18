import { ChannelManagerState } from "./ChannelManagerState";
import { PlatformProvider }    from "./PlatformProvider";
import { AccountStatus }       from "./AccountStatus";
import { UploadQueueState }    from "./UploadQueueState";
import { ScheduleStatus }      from "./ScheduleStatus";
import { CapabilityType }      from "./CapabilityType";
import { SyncStatus }          from "./SyncStatus";

// ─── Channel Manager Request ──────────────────────────────────────────────────

export interface ChannelManagerRequest {
  id: string;
  action: "CONNECT" | "DISCONNECT" | "SYNC" | "QUEUE" | "SCHEDULE" | "REFRESH_TOKEN" | "GET_STATUS";
  channelId?: string;
  provider?: PlatformProvider;
  state: ChannelManagerState;
  timestamp: Date;
  payload?: Record<string, unknown>;
  options?: {
    correlationId?: string;
    force?: boolean;
    dryRun?: boolean;
    syncAll?: boolean;
    notifyOnComplete?: boolean;
  };
}

// ─── Channel Manager Response ─────────────────────────────────────────────────

export interface ChannelManagerResponse {
  id: string;
  requestId: string;
  state: ChannelManagerState;
  connectedChannels: ConnectedChannel[];
  syncResults: SyncResult[];
  queueSnapshot: UploadQueue;
  report: ChannelReport;
  snapshot: ChannelSnapshot;
  timestamp: Date;
}

// ─── Connected Channel ────────────────────────────────────────────────────────

export interface ConnectedChannel {
  id: string;
  provider: PlatformProvider;
  profile: ChannelProfile;
  account: PlatformAccount;
  oauth: OAuthToken;
  capabilities: PlatformCapabilities;
  health: ChannelHealth;
  status: AccountStatus;
  connectedAt: Date;
  lastSyncedAt?: Date;
  metadata: Record<string, unknown>;
}

// ─── Channel Profile ──────────────────────────────────────────────────────────

export interface ChannelProfile {
  channelId: string;        // Platform-native channel ID
  channelName: string;
  displayName: string;
  description: string;
  avatarUrl?: string;
  bannerUrl?: string;
  customUrl?: string;       // e.g. youtube.com/@shailystudio
  country?: string;
  language: string;
  category?: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  createdAt?: Date;
  verified: boolean;
  monetized: boolean;
}

// ─── Platform Account ─────────────────────────────────────────────────────────

export interface PlatformAccount {
  accountId: string;        // Internal Shaily Studio account ID
  platformUserId: string;   // External platform user ID
  email?: string;
  displayName: string;
  provider: PlatformProvider;
  status: AccountStatus;
  scopes: string[];         // OAuth scopes granted
  createdAt: Date;
  updatedAt: Date;
}

// ─── OAuth Token ──────────────────────────────────────────────────────────────

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;        // "Bearer"
  expiresAt: Date;
  scopes: string[];
  issuedAt: Date;
  isExpired: boolean;
  expiresInSeconds: number; // Seconds remaining
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

export interface RefreshToken {
  token: string;
  channelId: string;
  provider: PlatformProvider;
  issuedAt: Date;
  expiresAt?: Date;         // Some platforms issue non-expiring refresh tokens
  usedAt?: Date;
  rotated: boolean;
}

// ─── Platform Capabilities ────────────────────────────────────────────────────

export interface PlatformCapabilities {
  provider: PlatformProvider;
  supported: CapabilityType[];
  maxFileSizeBytes: number;
  maxDurationSeconds: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  maxTagCount: number;
  supportedResolutions: string[];
  supportedFormats: string[];         // e.g. ["mp4", "mov"]
  rateLimit: ProviderRateLimit;
}

// ─── Provider Rate Limit ──────────────────────────────────────────────────────

export interface ProviderRateLimit {
  uploadsPerDay: number;
  requestsPerMinute: number;
  requestsPerDay: number;
  currentUploadsToday: number;
  currentRequestsThisMinute: number;
}

// ─── Upload Queue ─────────────────────────────────────────────────────────────

export interface UploadQueue {
  channelId: string;
  items: QueueItem[];
  totalItems: number;
  waitingCount: number;
  uploadingCount: number;
  publishedCount: number;
  failedCount: number;
  lastUpdated: Date;
}

// ─── Queue Item ───────────────────────────────────────────────────────────────

export interface QueueItem {
  id: string;
  channelId: string;
  provider: PlatformProvider;
  publishingJobId?: string;   // Link back to PublishingEngine job
  renderId?: string;          // Link back to RenderEngine output
  videoPath: string;
  thumbnailPath?: string;
  subtitlePath?: string;
  title: string;
  description: string;
  tags: string[];
  state: UploadQueueState;
  priority: number;           // Lower = higher priority
  scheduledAt?: Date;
  enqueuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  error?: string;
  platformVideoId?: string;
  publishedUrl?: string;
}

// ─── Scheduled Post ───────────────────────────────────────────────────────────

export interface ScheduledPost {
  id: string;
  channelId: string;
  provider: PlatformProvider;
  queueItemId?: string;
  title: string;
  description: string;
  scheduledAt: Date;
  timezone: string;
  status: ScheduleStatus;
  recurring?: RecurringSchedule;
  createdAt: Date;
  executedAt?: Date;
  platformVideoId?: string;
}

// ─── Recurring Schedule ───────────────────────────────────────────────────────

export interface RecurringSchedule {
  frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  daysOfWeek?: number[];     // 0=Sun, 1=Mon … 6=Sat
  hour: number;              // 0–23
  minute: number;            // 0–59
  timezone: string;
  nextOccurrence: Date;
  endDate?: Date;
  executionCount: number;
  maxExecutions?: number;
}

// ─── Publishing History ───────────────────────────────────────────────────────

export interface PublishingHistory {
  channelId: string;
  entries: HistoryEntry[];
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  manualUploads: number;
  scheduledUploads: number;
  lastUploadAt?: Date;
}

// ─── History Entry ────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  channelId: string;
  provider: PlatformProvider;
  title: string;
  platformVideoId: string;
  publishedUrl: string;
  publishedAt: Date;
  source: "QUEUE" | "SCHEDULED" | "MANUAL" | "DRAFT";
  retryCount: number;
  queueItemId?: string;
  publishingJobId?: string;
  deleted: boolean;
  deletedAt?: Date;
}

// ─── Draft Video ──────────────────────────────────────────────────────────────

export interface DraftVideo {
  id: string;
  channelId: string;
  provider: PlatformProvider;
  platformDraftId?: string;   // Platform-assigned draft ID
  title: string;
  description: string;
  tags: string[];
  videoPath?: string;
  thumbnailPath?: string;
  syncStatus: SyncStatus;
  isLocal: boolean;           // True if only exists locally
  isRemote: boolean;          // True if exists on platform
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
  mergeConflict: boolean;
}

// ─── Playlist ─────────────────────────────────────────────────────────────────

export interface Playlist {
  id: string;
  channelId: string;
  provider: PlatformProvider;
  platformPlaylistId: string;
  title: string;
  description: string;
  videoCount: number;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  provider: PlatformProvider;
  platformCategoryId: string;
  name: string;
  assignable: boolean;
}

// ─── Channel Statistics Reference ────────────────────────────────────────────

export interface ChannelStatisticsReference {
  channelId: string;
  provider: PlatformProvider;
  subscriberCount: number;
  totalViews: number;
  totalVideos: number;
  averageViewsPerVideo: number;
  lastUpdated: Date;
  analyticsRefId?: string;    // Link to AnalyticsEngine report
}

// ─── Channel Snapshot (Immutable) ────────────────────────────────────────────

export interface ChannelSnapshot {
  readonly channelId: string;
  readonly state: ChannelManagerState;
  readonly provider: PlatformProvider;
  readonly accountStatus: AccountStatus;
  readonly channelName: string;
  readonly queueLength: number;
  readonly scheduledPosts: number;
  readonly draftCount: number;
  readonly historyCount: number;
  readonly tokenValid: boolean;
  readonly lastSyncedAt?: Date;
  readonly capabilities: readonly CapabilityType[];
  readonly timestamp: Date;
}

// ─── Channel Report ───────────────────────────────────────────────────────────

export interface ChannelReport {
  id: string;
  channelId: string;
  provider: PlatformProvider;
  timestamp: Date;
  requestId: string;
  profile: ChannelProfile;
  account: PlatformAccount;
  capabilities: PlatformCapabilities;
  health: ChannelHealth;
  queue: UploadQueue;
  scheduledPosts: ScheduledPost[];
  drafts: DraftVideo[];
  history: PublishingHistory;
  playlists: Playlist[];
  statistics: ChannelStatisticsReference;
  syncResults: SyncResult[];
  warnings: string[];
  errors: string[];
}

// ─── Sync Job ─────────────────────────────────────────────────────────────────

export interface SyncJob {
  id: string;
  channelId: string;
  provider: PlatformProvider;
  status: SyncStatus;
  syncedItems: string[];      // What was synced
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// ─── Sync Result ──────────────────────────────────────────────────────────────

export interface SyncResult {
  channelId: string;
  provider: PlatformProvider;
  status: SyncStatus;
  syncedDrafts: number;
  syncedPlaylists: number;
  syncedSchedules: number;
  syncedHistory: number;
  syncedProfile: boolean;
  duration: number;           // ms
  errors: string[];
  timestamp: Date;
}

// ─── Channel Metrics ──────────────────────────────────────────────────────────

export interface ChannelMetrics {
  channelId: string;
  provider: PlatformProvider;
  uploadsLast7Days: number;
  uploadsLast30Days: number;
  failedUploadsLast7Days: number;
  averageUploadDuration: number;   // ms
  retrySuccessRate: number;        // 0–1
  tokenRefreshCount: number;
  syncJobCount: number;
  queueThroughput: number;         // items/day
  lastCalculated: Date;
}

// ─── Channel Health ───────────────────────────────────────────────────────────

export interface ChannelHealth {
  channelId: string;
  provider: PlatformProvider;
  isHealthy: boolean;
  tokenStatus: "VALID" | "EXPIRING_SOON" | "EXPIRED";
  tokenExpiresInHours: number;
  apiReachable: boolean;
  rateLimitRemaining: number;      // 0–1 (1 = full)
  uploadFailureRate: number;       // 0–1 (0 = no failures)
  lastCheckedAt: Date;
  issues: string[];
  warnings: string[];
}
