import { UploadState } from "./UploadState";
import { PrivacyStatus } from "./PrivacyStatus";
import { VideoCategory } from "./VideoCategory";
import { ThumbnailState } from "./ThumbnailState";
import { PlaylistState } from "./PlaylistState";
import { YouTubeState } from "./YouTubeState";

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  category: VideoCategory;
  language: string;
  madeForKids: boolean;
  license?: string;
  embeddable?: boolean;
}

export interface Thumbnail {
  id: string;
  url: string;
  state: ThumbnailState;
  uploadedAt?: Date;
}

export interface Playlist {
  id: string;
  title: string;
  state: PlaylistState;
  itemCount: number;
}

export interface PublishSchedule {
  publishTime: Date;
  timezone: string;
}

export interface CaptionFile {
  id: string;
  language: string;
  url: string;
  format: string;
  isDraft: boolean;
}

export interface EndScreen {
  id: string;
  elements: Array<{ type: string; url?: string; timeOffsetMs: number }>;
}

export interface Card {
  id: string;
  type: string;
  teaserText: string;
  url: string;
  timeOffsetMs: number;
}

export interface VideoStatistics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  estimatedMinutesWatched: number;
  averageViewDurationSeconds: number;
  ctrPercent: number;
}

export interface AnalyticsSeed {
  expectedViews: number;
  expectedCtrPercent: number;
  retentionBaselinePercent: number;
}

export interface ProcessingStatus {
  status: "PENDING" | "PROCESSING" | "HD_READY" | "COMPLETED" | "FAILED";
  progressPercent: number;
  lastUpdated: Date;
}

export interface YouTubeVideo {
  id: string;
  videoId?: string;
  title: string;
  description: string;
  privacy: PrivacyStatus;
  category: VideoCategory;
  tags: string[];
  videoFileUrl: string;
  thumbnail?: Thumbnail;
  playlist?: Playlist;
  captions?: CaptionFile[];
  schedule?: PublishSchedule;
  endScreen?: EndScreen;
  cards?: Card[];
  statistics?: VideoStatistics;
  processing?: ProcessingStatus;
  status: UploadState;
  publishedAt?: Date;
}

export interface UploadRequest {
  id: string;
  projectId: string;
  videoFileUrl: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl: string;
  privacy: PrivacyStatus;
  category: VideoCategory;
  playlistId?: string;
  scheduleTime?: Date;
  captionsSrtUrl?: string;
  analyticsSeed?: AnalyticsSeed;
}

export interface UploadResponse {
  id: string;
  requestId: string;
  videoId: string;
  videoUrl: string;
  status: UploadState;
  startedAt: Date;
}

export interface UploadProgress {
  requestId: string;
  bytesUploaded: number;
  totalBytes: number;
  percent: number;
  speedBytesPerSecond: number;
  etaSeconds: number;
}

export interface OAuthSession {
  accessToken: string;
  refreshToken: string;
  expiryDate: Date;
  scopes: string[];
  channelId?: string;
  channelName?: string;
}

export interface UploadHistory {
  id: string;
  requestId: string;
  videoId: string;
  title: string;
  status: UploadState;
  uploadedAt: Date;
}

export interface VideoSnapshot {
  youtubeId: string;
  state: YouTubeState;
  activeUploadsCount: number;
  isAuthorized: boolean;
  timestamp: Date;
}

export interface YouTubeEngineStatistics {
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  totalBytesUploaded: number;
}

export interface YouTubeValidationIssue {
  field: string;
  message: string;
  severity: "WARNING" | "CRITICAL";
}

export interface YouTubeValidationReport {
  valid: boolean;
  issues: YouTubeValidationIssue[];
  timestamp: Date;
}
