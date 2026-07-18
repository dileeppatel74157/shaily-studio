import { PublishingState }    from "./PublishingState";
import { PublishingPlatform } from "./PublishingPlatform";
import { PublishingStatus }   from "./PublishingStatus";
import { PrivacyType }        from "./PrivacyType";
import { UploadPriority }     from "./UploadPriority";

// ─── Publishing Request ───────────────────────────────────────────────────────

export interface PublishingRequest {
  /** Unique publishing request ID */
  id: string;
  /** ID of the QualityResponse that approved this video */
  qualityId: string;
  /** ID of the RenderingResponse providing the final video */
  renderId: string;
  /** One or more platform targets to publish to */
  targets: PublishingTarget[];
  /** Scheduling configuration */
  schedule: PublishingSchedule;
  /** Upload priority for queue ordering */
  priority: UploadPriority;
  state: PublishingState;
  timestamp: Date;
  options?: {
    correlationId?: string;
    /** Allow re-publishing a previously published video */
    allowDuplicate?: boolean;
    /** Auto-generate metadata from context engines */
    autoGenerateMetadata?: boolean;
    /** Custom metadata to override auto-generated values */
    metadataOverrides?: Partial<PublishingMetadata>;
    /** Maximum upload retries per target */
    maxRetries?: number;
    /** Custom thumbnail path (overrides render engine thumbnail) */
    thumbnailPath?: string;
    /** Custom subtitle/caption file path */
    subtitlePath?: string;
    /** Notify via event bus on each platform completion */
    notifyOnComplete?: boolean;
    /** Automatically assign to a playlist on supported platforms */
    autoPlaylist?: boolean;
    /** Add to content calendar after publishing */
    addToCalendar?: boolean;
  };
}

// ─── Publishing Response ──────────────────────────────────────────────────────

export interface PublishingResponse {
  id: string;
  requestId: string;
  state: PublishingState;
  jobs: PublishingJob[];
  results: PublishingResult[];
  report: PublishingReport;
  metrics: PublishingMetrics;
  snapshot: PublishingSnapshot;
  timestamp: Date;
}

// ─── Publishing Job ───────────────────────────────────────────────────────────

export interface PublishingJob {
  /** Unique job ID — format: job-{requestId}-{platform} */
  id: string;
  requestId: string;
  platform: PublishingPlatform;
  target: PublishingTarget;
  status: PublishingStatus;
  state: PublishingState;
  /** Upload progress 0–100 */
  uploadProgress: number;
  /** Platform processing progress 0–100 (after upload completes) */
  processingProgress: number;
  retryCount: number;
  maxRetries: number;
  /** Platform-assigned video ID after successful upload */
  platformVideoId?: string;
  /** Publicly accessible URL after publishing */
  publishedUrl?: string;
  /** Scheduled publish time (if applicable) */
  scheduledAt?: Date;
  /** Actual publish time */
  publishedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  warnings: string[];
}

// ─── Publishing Profile ───────────────────────────────────────────────────────

export interface PublishingProfile {
  id: string;
  name: string;
  /** Default platform to publish to */
  defaultPlatform: PublishingPlatform;
  /** Default privacy setting */
  defaultPrivacy: PrivacyType;
  /** Default upload priority */
  defaultPriority: UploadPriority;
  /** Default schedule strategy */
  defaultSchedule: PublishingSchedule;
  /** Linked platform accounts */
  accounts: PublishingAccount[];
  /** Content rules (max duration, file size limits, etc.) */
  rules: PublishingProfileRules;
}

// ─── Publishing Profile Rules ─────────────────────────────────────────────────

export interface PublishingProfileRules {
  /** Maximum file size in bytes (0 = no limit) */
  maxFileSizeBytes: number;
  /** Maximum video duration in seconds (0 = no limit) */
  maxDurationSeconds: number;
  /** Required minimum resolution (e.g. "1080P") */
  minResolution?: string;
  /** Allowed export formats */
  allowedFormats?: string[];
  /** Whether subtitles/captions are required */
  requireSubtitles: boolean;
  /** Whether a thumbnail is required */
  requireThumbnail: boolean;
}

// ─── Publishing Account ───────────────────────────────────────────────────────

export interface PublishingAccount {
  id: string;
  platform: PublishingPlatform;
  /** Display name of the account/channel */
  accountName: string;
  /** Platform-specific account/channel identifier */
  accountId: string;
  /** Whether the account is currently authenticated */
  authenticated: boolean;
  /** Token expiry date (if applicable) */
  tokenExpiresAt?: Date;
  /** Custom provider endpoint (for CUSTOM platform) */
  customEndpoint?: string;
}

// ─── Publishing Target ────────────────────────────────────────────────────────

export interface PublishingTarget {
  /** Unique target ID within the request */
  id: string;
  platform: PublishingPlatform;
  account: PublishingAccount;
  privacy: PrivacyType;
  /** Platform-specific metadata overrides */
  metadataOverrides?: Partial<PublishingMetadata>;
  /** Platform-specific category/content type ID */
  categoryId?: string;
  /** Playlist ID to add the video to */
  playlistId?: string;
  /** Additional platform-specific options */
  platformOptions?: Record<string, unknown>;
}

// ─── Publishing Metadata ──────────────────────────────────────────────────────

export interface PublishingMetadata {
  /** Video title (max 100 chars for most platforms) */
  title: string;
  /** Video description (max 5000 chars) */
  description: string;
  /** SEO tags */
  tags: string[];
  /** Platform hashtags (prefixed with #) */
  hashtags: string[];
  /** SEO keywords */
  keywords: string[];
  /** Platform-specific category */
  category?: string;
  /** Playlist name or ID */
  playlist?: string;
  /** Chapter markers: { title, timestampSeconds } */
  chapters?: Array<{ title: string; timestampSeconds: number }>;
  /** Call-to-action text */
  cta?: string;
  /** Pinned comment text */
  pinnedComment?: string;
  /** End screen references (linked video IDs) */
  endScreenReferences?: string[];
  /** Language code (e.g. "en", "hi") */
  language?: string;
  /** Whether comments are allowed */
  allowComments?: boolean;
  /** Whether ratings are visible */
  allowRatings?: boolean;
  /** Content rating (e.g. "all", "18+") */
  contentRating?: string;
}

// ─── Publishing Schedule ──────────────────────────────────────────────────────

export interface PublishingSchedule {
  /** "now" = publish immediately, "scheduled" = at publishAt, "recurring" = per recurrence */
  mode: "now" | "scheduled" | "recurring";
  /** Target publish date/time (required for "scheduled" and "recurring") */
  publishAt?: Date;
  /** IANA timezone string (e.g. "Asia/Kolkata") */
  timezone?: string;
  /** Recurring publish rule (cron-style expression) */
  recurrenceRule?: string;
  /** Maximum number of recurrences (0 = unlimited) */
  maxOccurrences?: number;
  /** Queue position override (lower = earlier) */
  queuePosition?: number;
}

// ─── Publishing Result ────────────────────────────────────────────────────────

export interface PublishingResult {
  jobId: string;
  platform: PublishingPlatform;
  status: PublishingStatus;
  /** Platform-assigned video ID */
  platformVideoId?: string;
  /** Live URL of the published video */
  publishedUrl?: string;
  /** Time taken to upload in seconds */
  uploadDurationSeconds: number;
  /** Time taken for platform processing in seconds */
  processingDurationSeconds: number;
  /** Total retries performed */
  retries: number;
  publishedAt?: Date;
  scheduledAt?: Date;
  error?: string;
  warnings: string[];
}

// ─── Publishing History ───────────────────────────────────────────────────────

export interface PublishingHistory {
  id: string;
  requestId: string;
  qualityId: string;
  renderId: string;
  platforms: PublishingPlatform[];
  results: PublishingResult[];
  overallStatus: PublishingStatus;
  timestamp: Date;
  /** Total upload time across all platforms in seconds */
  totalUploadSeconds: number;
  /** Count of platforms successfully published */
  successCount: number;
  /** Count of platforms that failed */
  failureCount: number;
}

// ─── Publishing Analytics Reference ──────────────────────────────────────────

export interface PublishingAnalyticsReference {
  jobId: string;
  platform: PublishingPlatform;
  platformVideoId: string;
  publishedUrl: string;
  /** Analytics dashboard URL (platform-specific) */
  analyticsUrl?: string;
  /** Estimated initial views within 24h (from Decision Engine) */
  estimatedInitialViews?: number;
  /** Predicted CTR % from thumbnail scoring */
  predictedCtr?: number;
}

// ─── Publishing Metrics ───────────────────────────────────────────────────────

export interface PublishingMetrics {
  totalTargets: number;
  successfulUploads: number;
  failedUploads: number;
  scheduledUploads: number;
  totalRetries: number;
  totalUploadDurationSeconds: number;
  totalProcessingDurationSeconds: number;
  averageUploadSpeedMbps: number;
  metadataGenerationTimeSeconds: number;
  publishedPlatforms: PublishingPlatform[];
  failedPlatforms: PublishingPlatform[];
}

// ─── Publishing Report ────────────────────────────────────────────────────────

export interface PublishingReport {
  id: string;
  timestamp: Date;
  requestId: string;
  qualityId: string;
  renderId: string;
  jobs: PublishingJob[];
  results: PublishingResult[];
  metadata: PublishingMetadata;
  schedule: PublishingSchedule;
  metrics: PublishingMetrics;
  analyticsRefs: PublishingAnalyticsReference[];
  warnings: string[];
  errors: string[];
}

// ─── Publishing Snapshot (Immutable) ─────────────────────────────────────────

export interface PublishingSnapshot {
  readonly publishingId: string;
  readonly state: PublishingState;
  readonly totalTargets: number;
  readonly successfulUploads: number;
  readonly failedUploads: number;
  readonly publishedPlatforms: readonly PublishingPlatform[];
  readonly failedPlatforms: readonly PublishingPlatform[];
  readonly totalRetries: number;
  readonly timestamp: Date;
}
