// ─── Enums ────────────────────────────────────────────────────────────────────
export { YouTubeState } from "./YouTubeState";
export { UploadState } from "./UploadState";
export { PrivacyStatus } from "./PrivacyStatus";
export { VideoCategory } from "./VideoCategory";
export { ThumbnailState } from "./ThumbnailState";
export { PlaylistState } from "./PlaylistState";
export { YouTubeEventType } from "./YouTubeEventType";
export { YouTubeValidationResult } from "./YouTubeValidationResult";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
  YouTubeVideo,
  UploadRequest,
  UploadResponse,
  VideoMetadata,
  Thumbnail,
  Playlist,
  UploadProgress,
  PublishSchedule,
  OAuthSession,
  VideoStatistics,
  UploadHistory,
  AnalyticsSeed,
  ProcessingStatus,
  CaptionFile,
  EndScreen,
  Card,
  VideoSnapshot,
  YouTubeEngineStatistics,
  YouTubeValidationIssue,
  YouTubeValidationReport
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
  IYouTubeIntegrationEngine,
  IAuthenticationManager,
  IUploadManager,
  IMetadataManager,
  IThumbnailManager,
  IPlaylistManager,
  IScheduleManager,
  IStatisticsManager,
  IProcessingManager,
  ICaptionManager,
  IPublishManager
} from "./interfaces";

// ─── Exceptions & Utilities ───────────────────────────────────────────────────
export {
  YouTubeException,
  AuthenticationException,
  UploadException,
  MetadataException,
  ScheduleException,
  ProcessingException,
  ValidationException,
  deepFreeze
} from "./types";

// ─── Engine, Builder, Validator ───────────────────────────────────────────────
export { YouTubeIntegrationEngine } from "./YouTubeIntegrationEngine";
export { YouTubeIntegrationBuilder } from "./YouTubeIntegrationBuilder";
export { YouTubeValidator } from "./YouTubeValidator";
