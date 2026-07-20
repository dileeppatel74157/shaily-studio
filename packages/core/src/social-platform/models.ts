import { PlatformType } from "./PlatformType";
import { PublishState } from "./PublishState";
import { ContentType } from "./ContentType";
import { VisibilityType } from "./VisibilityType";
import { AdapterState } from "./AdapterState";
import { SocialPlatformState } from "./SocialPlatformState";

export interface Caption {
  text: string;
  language: string;
  charCount: number;
}

export interface HashtagCollection {
  hashtags: string[];
  count: number;
}

export interface MentionCollection {
  mentions: string[];
  count: number;
}

export interface MediaAssetReference {
  id: string;
  type: "IMAGE" | "VIDEO" | "AUDIO";
  url: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface PlatformAccount {
  id: string;
  platform: PlatformType;
  username: string;
  displayName: string;
  accountId: string;
  authToken: string;
  expiryDate: Date;
  connectedAt: Date;
}

export interface PlatformAdapter {
  platform: PlatformType;
  state: AdapterState;
  version: string;
  capabilities: {
    supportedContentTypes: ContentType[];
    maxCaptionLength: number;
    maxHashtags: number;
    maxVideoDurationSeconds?: number;
    maxVideoSizeBytes?: number;
  };
}

export interface PublishSchedule {
  scheduledTime: Date;
  timezone: string;
}

export interface AnalyticsSeed {
  expectedImpressions: number;
  expectedEngagementRate: number;
  expectedClicks?: number;
  expectedShares?: number;
  expectedComments?: number;
}

export interface PlatformStatistics {
  impressions: number;
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
  clicks?: number;
}

export interface RetryAttempt {
  attemptNumber: number;
  lastAttemptAt: Date;
  errorMessage?: string;
  nextAttemptAt?: Date;
  canRetry: boolean;
}

export interface SocialPost {
  id: string;
  projectId: string;
  platforms: PlatformType[];
  contentType: ContentType;
  caption: Caption;
  hashtags: HashtagCollection;
  mentions: MentionCollection;
  media: MediaAssetReference[];
  visibility: VisibilityType;
  schedule?: PublishSchedule;
  status: PublishState;
  platformUrls: Record<PlatformType, string>;
  statistics: Record<PlatformType, PlatformStatistics>;
  retryAttempts: Record<PlatformType, RetryAttempt>;
  publishedAt?: Date;
}

export interface PublishRequest {
  id: string;
  projectId: string;
  platforms: PlatformType[];
  contentType: ContentType;
  caption: string;
  hashtags: string[];
  mentions: string[];
  media: Array<{ id: string; type: "IMAGE" | "VIDEO" | "AUDIO"; url: string; sizeBytes: number; width?: number; height?: number; durationSeconds?: number }>;
  visibility: VisibilityType;
  scheduleTime?: Date;
  analyticsSeed?: AnalyticsSeed;
}

export interface PublishResponse {
  id: string;
  requestId: string;
  postId: string;
  platformUrls: Record<PlatformType, string>;
  status: PublishState;
  startedAt: Date;
}

export interface PublishProgress {
  requestId: string;
  platform: PlatformType;
  percent: number;
  status: PublishState;
  message?: string;
}

export interface PublishHistory {
  id: string;
  requestId: string;
  postId: string;
  platform: PlatformType;
  status: PublishState;
  url?: string;
  publishedAt: Date;
}

export interface PublishSnapshot {
  snapshotId: string;
  state: SocialPlatformState;
  registeredAdaptersCount: number;
  connectedAccountsCount: number;
  timestamp: Date;
}

export interface SocialEngineStatistics {
  totalPublishes: number;
  successfulPublishes: number;
  failedPublishes: number;
  totalRetries: number;
}

export interface SocialValidationIssue {
  platform: PlatformType;
  rule: string;
  message: string;
  severity: "WARNING" | "CRITICAL";
}

export interface SocialValidationReport {
  valid: boolean;
  issues: SocialValidationIssue[];
  timestamp: Date;
}
