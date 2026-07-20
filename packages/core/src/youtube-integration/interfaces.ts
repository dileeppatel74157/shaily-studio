import { YouTubeState } from "./YouTubeState";
import { PrivacyStatus } from "./PrivacyStatus";
import {
  YouTubeVideo,
  UploadRequest,
  UploadResponse,
  VideoMetadata,
  Thumbnail,
  Playlist,
  OAuthSession,
  VideoStatistics,
  ProcessingStatus,
  CaptionFile,
  VideoSnapshot,
  YouTubeEngineStatistics
} from "./models";

export interface IYouTubeIntegrationEngine {
  getState(): YouTubeState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  uploadVideo(request: UploadRequest): Promise<UploadResponse>;
  getSnapshot(): VideoSnapshot;
  getStatistics(): YouTubeEngineStatistics;

  // Managers
  getAuthenticationManager(): IAuthenticationManager;
  getUploadManager(): IUploadManager;
  getMetadataManager(): IMetadataManager;
  getThumbnailManager(): IThumbnailManager;
  getPlaylistManager(): IPlaylistManager;
  getScheduleManager(): IScheduleManager;
  getStatisticsManager(): IStatisticsManager;
  getProcessingManager(): IProcessingManager;
  getCaptionManager(): ICaptionManager;
  getPublishManager(): IPublishManager;

  // Events
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface IAuthenticationManager {
  authorize(authCode: string): Promise<OAuthSession>;
  getOAuthSession(): OAuthSession | undefined;
  revoke(): Promise<void>;
  isAuthorized(): boolean;
}

export interface IUploadManager {
  startUpload(request: UploadRequest): Promise<UploadResponse>;
  cancelUpload(requestId: string): Promise<void>;
  getVideo(requestId: string): YouTubeVideo | undefined;
}

export interface IMetadataManager {
  buildMetadata(video: YouTubeVideo, meta: Partial<VideoMetadata>): Promise<YouTubeVideo>;
}

export interface IThumbnailManager {
  uploadThumbnail(video: YouTubeVideo, thumbnailUrl: string): Promise<Thumbnail>;
}

export interface IPlaylistManager {
  assignPlaylist(video: YouTubeVideo, playlistId: string): Promise<Playlist>;
}

export interface IScheduleManager {
  schedulePublish(video: YouTubeVideo, publishTime: Date): Promise<YouTubeVideo>;
}

export interface IStatisticsManager {
  initializeStatistics(video: YouTubeVideo, baseline: Record<string, any>): Promise<VideoStatistics>;
  getStatistics(videoId: string): Promise<VideoStatistics>;
}

export interface IProcessingManager {
  monitorProcessing(videoId: string): Promise<ProcessingStatus>;
}

export interface ICaptionManager {
  attachCaptions(video: YouTubeVideo, captionsSrtUrl: string, language: string): Promise<CaptionFile>;
}

export interface IPublishManager {
  publishVideo(video: YouTubeVideo, privacy: PrivacyStatus): Promise<YouTubeVideo>;
}
