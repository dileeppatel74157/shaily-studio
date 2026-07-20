import { YouTubeState } from "./YouTubeState";
import { UploadState } from "./UploadState";
import { PrivacyStatus } from "./PrivacyStatus";
import { VideoCategory } from "./VideoCategory";
import { ThumbnailState } from "./ThumbnailState";
import { PlaylistState } from "./PlaylistState";
import { YouTubeEventType } from "./YouTubeEventType";
import {
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
import {
  YouTubeException,
  AuthenticationException,
  UploadException,
  deepFreeze
} from "./types";
import { YouTubeValidator } from "./YouTubeValidator";
import { KnowledgeNodeType } from "../knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "../knowledge-base/KnowledgeSource";

export class YouTubeIntegrationEngine implements IYouTubeIntegrationEngine {
  private _state: YouTubeState = YouTubeState.CREATED;
  private _eventHandlers = new Map<string, Array<(payload: any) => void>>();
  private _videos = new Map<string, YouTubeVideo>();
  private _session?: OAuthSession;

  // Statistics
  private _stats: YouTubeEngineStatistics = {
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    totalBytesUploaded: 0
  };

  // Managers
  private readonly _authMgr: IAuthenticationManager;
  private readonly _uploadMgr: IUploadManager;
  private readonly _metadataMgr: IMetadataManager;
  private readonly _thumbnailMgr: IThumbnailManager;
  private readonly _playlistMgr: IPlaylistManager;
  private readonly _scheduleMgr: IScheduleManager;
  private readonly _statisticsMgr: IStatisticsManager;
  private readonly _processingMgr: IProcessingManager;
  private readonly _captionMgr: ICaptionManager;
  private readonly _publishMgr: IPublishManager;

  constructor(public readonly context: any) {
    if (!context) {
      throw new Error("Context is required for YouTubeIntegrationEngine.");
    }

    this._authMgr = new AuthenticationManagerImpl(this);
    this._uploadMgr = new UploadManagerImpl(this);
    this._metadataMgr = new MetadataManagerImpl(this);
    this._thumbnailMgr = new ThumbnailManagerImpl(this);
    this._playlistMgr = new PlaylistManagerImpl(this);
    this._scheduleMgr = new ScheduleManagerImpl(this);
    this._statisticsMgr = new StatisticsManagerImpl(this);
    this._processingMgr = new ProcessingManagerImpl(this);
    this._captionMgr = new CaptionManagerImpl(this);
    this._publishMgr = new PublishManagerImpl(this);
  }

  public getState(): YouTubeState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state === YouTubeState.READY || this._state === YouTubeState.FAILED) {
      this._state = YouTubeState.CREATED;
    }
    this._state = YouTubeState.INITIALIZING;
    await this._emit(YouTubeEventType.UPLOAD_PROGRESS, { phase: "INITIALIZE" });
    this._state = YouTubeState.READY;
  }

  public async start(): Promise<void> {
    if (this._state !== YouTubeState.READY) {
      throw new YouTubeException(`Cannot start YouTube Engine in state: ${this._state}`);
    }
  }

  public async stop(): Promise<void> {
    this._state = YouTubeState.READY;
  }

  // ─── Main Operations ────────────────────────────────────────────────────────

  public async uploadVideo(request: UploadRequest): Promise<UploadResponse> {
    if (this._state !== YouTubeState.READY) {
      throw new YouTubeException("YouTube integration engine is not ready.");
    }

    this._stats.totalUploads++;
    this._state = YouTubeState.UPLOADING;

    try {
      // 1. Validation
      YouTubeValidator.assertValid(request);

      // 2. Authentication check
      if (!this._authMgr.isAuthorized()) {
        throw new AuthenticationException("No valid OAuth session found.");
      }

      await this._emit(YouTubeEventType.UPLOAD_STARTED, { requestId: request.id, title: request.title });

      // Create video object in tracking map
      const video: YouTubeVideo = {
        id: request.id,
        title: request.title,
        description: request.description,
        privacy: request.privacy,
        category: request.category,
        tags: request.tags,
        videoFileUrl: request.videoFileUrl,
        status: UploadState.PENDING
      };
      this._videos.set(request.id, video);

      // Simulate upload progress events
      for (let p = 10; p <= 100; p += 30) {
        await this._emit(YouTubeEventType.UPLOAD_PROGRESS, { requestId: request.id, progressPercent: Math.min(p, 100) });
      }

      // Complete Upload phase
      video.status = UploadState.UPLOADING;
      this._stats.totalBytesUploaded += 25 * 1024 * 1024; // Mock size

      const response = await this._uploadMgr.startUpload(request);

      // 3. Process Metadata
      await this._metadataMgr.buildMetadata(video, {
        title: request.title,
        description: request.description,
        tags: request.tags,
        category: request.category
      });

      // 4. Thumbnail upload
      if (request.thumbnailUrl) {
        await this._thumbnailMgr.uploadThumbnail(video, request.thumbnailUrl);
      }

      // 5. Captions
      if (request.captionsSrtUrl) {
        await this._captionMgr.attachCaptions(video, request.captionsSrtUrl, "en");
      }

      // 6. Playlist assignment
      if (request.playlistId) {
        await this._playlistMgr.assignPlaylist(video, request.playlistId);
      }

      // 7. Schedule / Publish
      if (request.privacy === PrivacyStatus.SCHEDULED && request.scheduleTime) {
        await this._scheduleMgr.schedulePublish(video, request.scheduleTime);
      } else {
        await this._publishMgr.publishVideo(video, request.privacy);
      }

      // 8. Initialize stats & processing
      this._state = YouTubeState.PROCESSING;
      await this._processingMgr.monitorProcessing(video.id);

      if (request.analyticsSeed) {
        await this._statisticsMgr.initializeStatistics(video, request.analyticsSeed);
      }

      // Mark completed
      video.status = UploadState.SUCCEEDED;
      this._state = YouTubeState.COMPLETED;
      this._stats.successfulUploads++;

      // Archive in Knowledge Base
      if (this.context.knowledgeBaseEngine?.store) {
        await this.context.knowledgeBaseEngine.store({
          type: KnowledgeNodeType.DOCUMENT,
          title: `YouTube Video: ${request.title}`,
          content: JSON.stringify(video),
          source: KnowledgeSource.PIPELINE_ENGINE
        });
      }

      // Save to database upload history
      await this._dbLog(video.id, "SUCCEEDED", video.videoId ?? "mock-vid-123");

      // Save snapshot to memory store
      if (this.context.memoryStore?.set) {
        await this.context.memoryStore.set("youtube", `snapshot:${video.id}`, JSON.stringify(video));
      }

      await this._emit(YouTubeEventType.VIDEO_PUBLISHED, { videoId: video.videoId, videoUrl: `https://youtube.com/watch?v=${video.videoId}` });

      return response;

    } catch (err: any) {
      this._state = YouTubeState.FAILED;
      this._stats.failedUploads++;
      if (this._videos.has(request.id)) {
        this._videos.get(request.id)!.status = UploadState.FAILED;
      }
      await this._dbLog(request.id, "FAILED", "");
      throw err;
    }
  }

  // ─── Snapshots & Telemetry ──────────────────────────────────────────────────

  public getSnapshot(): VideoSnapshot {
    const snap: VideoSnapshot = {
      youtubeId: `yt-snap-${Date.now()}`,
      state: this._state,
      activeUploadsCount: Array.from(this._videos.values()).filter(v => v.status === UploadState.UPLOADING || v.status === UploadState.PROCESSING).length,
      isAuthorized: this._authMgr.isAuthorized(),
      timestamp: new Date()
    };
    return deepFreeze(snap);
  }

  public getStatistics(): YouTubeEngineStatistics {
    return this._stats;
  }

  // ─── Manager Getters ────────────────────────────────────────────────────────

  public getAuthenticationManager(): IAuthenticationManager { return this._authMgr; }
  public getUploadManager(): IUploadManager { return this._uploadMgr; }
  public getMetadataManager(): IMetadataManager { return this._metadataMgr; }
  public getThumbnailManager(): IThumbnailManager { return this._thumbnailMgr; }
  public getPlaylistManager(): IPlaylistManager { return this._playlistMgr; }
  public getScheduleManager(): IScheduleManager { return this._scheduleMgr; }
  public getStatisticsManager(): IStatisticsManager { return this._statisticsMgr; }
  public getProcessingManager(): IProcessingManager { return this._processingMgr; }
  public getCaptionManager(): ICaptionManager { return this._captionMgr; }
  public getPublishManager(): IPublishManager { return this._publishMgr; }

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

  public async _emit(event: YouTubeEventType | string, payload: Record<string, any>): Promise<void> {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(payload);
      }
    }

    if (this.context.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-yt-${event.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name: event,
          timestamp: new Date(),
          source: "YouTubeIntegrationEngine",
          payload
        });
      } catch (_) {}
    }
  }

  private async _dbLog(requestId: string, status: string, videoId: string): Promise<void> {
    if (this.context.databaseEngine?.getQueryManager()?.execute) {
      try {
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-yt-${Date.now()}`,
          sql: "INSERT INTO youtube_uploads (request_id, status, video_id, uploaded_at) VALUES (?, ?, ?, ?)",
          parameters: [requestId, status, videoId, new Date().toISOString()]
        });
      } catch (_) {}
    }
  }

  // Session management for internal use
  public setSession(session?: OAuthSession): void {
    this._session = session;
  }

  public getSession(): OAuthSession | undefined {
    return this._session;
  }

  public getVideosMap(): Map<string, YouTubeVideo> {
    return this._videos;
  }
}

// ─── Subsystem Implementation Modules ─────────────────────────────────────────

class AuthenticationManagerImpl implements IAuthenticationManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async authorize(authCode: string): Promise<OAuthSession> {
    if (!authCode || authCode.trim() === "") {
      throw new AuthenticationException("Authorization code cannot be empty.");
    }
    const session: OAuthSession = {
      accessToken: `access-${Date.now()}`,
      refreshToken: `refresh-${Date.now()}`,
      expiryDate: new Date(Date.now() + 3600 * 1000),
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      channelId: "UC-mock-channel-123",
      channelName: "Shaily AI Studio Channel"
    };
    this._engine.setSession(session);
    return session;
  }

  public getOAuthSession(): OAuthSession | undefined {
    return this._engine.getSession();
  }

  public async revoke(): Promise<void> {
    this._engine.setSession(undefined);
  }

  public isAuthorized(): boolean {
    const s = this._engine.getSession();
    return s !== undefined && s.expiryDate.getTime() > Date.now();
  }
}

class UploadManagerImpl implements IUploadManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async startUpload(request: UploadRequest): Promise<UploadResponse> {
    const video = this._engine.getVideosMap().get(request.id);
    if (!video) {
      throw new UploadException("Video object not registered.");
    }

    video.videoId = "mock-vid-123";
    video.status = UploadState.PROCESSING;

    const response: UploadResponse = {
      id: `up-resp-${Date.now()}`,
      requestId: request.id,
      videoId: video.videoId,
      videoUrl: `https://youtube.com/watch?v=${video.videoId}`,
      status: UploadState.PROCESSING,
      startedAt: new Date()
    };

    return response;
  }

  public async cancelUpload(requestId: string): Promise<void> {
    const video = this._engine.getVideosMap().get(requestId);
    if (video) {
      video.status = UploadState.CANCELLED;
    }
  }

  public getVideo(requestId: string): YouTubeVideo | undefined {
    return this._engine.getVideosMap().get(requestId);
  }
}

class MetadataManagerImpl implements IMetadataManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async buildMetadata(video: YouTubeVideo, meta: Partial<VideoMetadata>): Promise<YouTubeVideo> {
    if (meta.title) video.title = meta.title;
    if (meta.description) video.description = meta.description;
    if (meta.tags) video.tags = meta.tags;
    if (meta.category) video.category = meta.category;
    return video;
  }
}

class ThumbnailManagerImpl implements IThumbnailManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async uploadThumbnail(video: YouTubeVideo, thumbnailUrl: string): Promise<Thumbnail> {
    const thumb: Thumbnail = {
      id: `thumb-${Date.now()}`,
      url: thumbnailUrl,
      state: ThumbnailState.UPLOADED,
      uploadedAt: new Date()
    };
    video.thumbnail = thumb;
    await this._engine._emit(YouTubeEventType.THUMBNAIL_UPLOADED, { videoId: video.videoId, thumbUrl: thumbnailUrl });
    return thumb;
  }
}

class PlaylistManagerImpl implements IPlaylistManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async assignPlaylist(video: YouTubeVideo, playlistId: string): Promise<Playlist> {
    const playlist: Playlist = {
      id: playlistId,
      title: "Shaily AI Content Pillar",
      state: PlaylistState.UPDATED,
      itemCount: 12
    };
    video.playlist = playlist;
    await this._engine._emit(YouTubeEventType.PLAYLIST_UPDATED, { videoId: video.videoId, playlistId });
    return playlist;
  }
}

class ScheduleManagerImpl implements IScheduleManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async schedulePublish(video: YouTubeVideo, publishTime: Date): Promise<YouTubeVideo> {
    video.schedule = {
      publishTime,
      timezone: "UTC"
    };
    video.privacy = PrivacyStatus.SCHEDULED;
    return video;
  }
}

class StatisticsManagerImpl implements IStatisticsManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async initializeStatistics(video: YouTubeVideo, baseline: Record<string, any>): Promise<VideoStatistics> {
    const stats: VideoStatistics = {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      estimatedMinutesWatched: 0,
      averageViewDurationSeconds: 0,
      ctrPercent: baseline.expectedCtrPercent ?? 5.5
    };
    video.statistics = stats;
    return stats;
  }

  public async getStatistics(videoId: string): Promise<VideoStatistics> {
    return {
      views: 1500,
      likes: 120,
      comments: 15,
      shares: 8,
      estimatedMinutesWatched: 4500,
      averageViewDurationSeconds: 180,
      ctrPercent: 6.2
    };
  }
}

class ProcessingManagerImpl implements IProcessingManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async monitorProcessing(videoId: string): Promise<ProcessingStatus> {
    const video = this._engine.getVideosMap().get(videoId);
    const status: ProcessingStatus = {
      status: "HD_READY",
      progressPercent: 100,
      lastUpdated: new Date()
    };
    if (video) {
      video.processing = status;
    }
    return status;
  }
}

class CaptionManagerImpl implements ICaptionManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async attachCaptions(video: YouTubeVideo, captionsSrtUrl: string, language: string): Promise<CaptionFile> {
    const caption: CaptionFile = {
      id: `cap-${Date.now()}`,
      language,
      url: captionsSrtUrl,
      format: "srt",
      isDraft: false
    };
    if (!video.captions) video.captions = [];
    video.captions.push(caption);
    return caption;
  }
}

class PublishManagerImpl implements IPublishManager {
  constructor(private readonly _engine: YouTubeIntegrationEngine) {}

  public async publishVideo(video: YouTubeVideo, privacy: PrivacyStatus): Promise<YouTubeVideo> {
    video.privacy = privacy;
    video.publishedAt = new Date();
    return video;
  }
}
