import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { ContentPipelineState } from "./ContentPipelineState";
import { ContentStage } from "./ContentStage";
import { AssetType } from "./AssetType";
import { AssetStatus } from "./AssetStatus";
import { CompositionState } from "./CompositionState";
import { RenderQuality } from "./RenderQuality";
import { PipelineEventType } from "./PipelineEventType";
import { PipelineValidationResult } from "./PipelineValidationResult";
import {
  IContentPipelineEngine,
  IStoryboardManager,
  IScenePlanner,
  IImageGenerationManager,
  IVoiceGenerationManager,
  IMusicGenerationManager,
  ISfxGenerationManager,
  IVideoGenerationManager,
  ICompositionManager,
  IRenderManager,
  IQualityManager
} from "./interfaces";
import {
  Storyboard,
  Scene,
  Shot,
  VoiceSegment,
  Subtitle,
  MusicTrack,
  SoundEffect,
  VideoSegment,
  CompositionTimeline,
  GeneratedAsset,
  RenderReport,
  QualityReport,
  PublishingPackage,
  ExecutionSnapshot,
  ContentPipelineStatistics,
  TimelineTrack,
  AssetReference
} from "./models";
import {
  ContentPipelineException,
  PipelineExecutionException,
  deepFreeze
} from "./types";
import { KnowledgeNodeType } from "../knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "../knowledge-base/KnowledgeSource";
import { ContentPipelineValidator } from "./ContentPipelineValidator";
import { GenerationMode } from "../media-provider/GenerationMode";

export class ContentPipelineEngine implements IContentPipelineEngine {
  private _state: ContentPipelineState = ContentPipelineState.CREATED;
  private _currentStage: ContentStage = ContentStage.STORYBOARD;
  private _progressPercent: number = 0;
  private _eventHandlers = new Map<string, Array<(payload: any) => void>>();
  private _reports = new Map<string, PublishingPackage>();

  // Statistics
  private _stats: ContentPipelineStatistics = {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    averageRunDurationMs: 0,
    totalCostUsd: 0.0,
    totalAssetsGenerated: 0
  };

  // Metrics
  private _metrics = {
    stageDurationsMs: {} as Record<ContentStage, number>,
    totalDurationMs: 0,
    costUsd: 0.0,
    promptTokens: 0,
    completionTokens: 0,
    assetsGeneratedCount: 0
  };

  // Managers
  private readonly _storyboardMgr: IStoryboardManager;
  private readonly _scenePlanner: IScenePlanner;
  private readonly _imageGenerationMgr: IImageGenerationManager;
  private readonly _voiceGenerationMgr: IVoiceGenerationManager;
  private readonly _musicGenerationMgr: IMusicGenerationManager;
  private readonly _sfxGenerationMgr: ISfxGenerationManager;
  private readonly _videoGenerationMgr: IVideoGenerationManager;
  private readonly _compositionMgr: ICompositionManager;
  private readonly _renderMgr: IRenderManager;
  private readonly _qualityMgr: IQualityManager;

  constructor(public readonly context: any) {
    if (!context) {
      throw new Error("Context is required for ContentPipelineEngine.");
    }

    // Initialize default implementations of managers
    this._storyboardMgr = new StoryboardManagerImpl(this);
    this._scenePlanner = new ScenePlannerImpl(this);
    this._imageGenerationMgr = new ImageGenerationManagerImpl(this);
    this._voiceGenerationMgr = new VoiceGenerationManagerImpl(this);
    this._musicGenerationMgr = new MusicGenerationManagerImpl(this);
    this._sfxGenerationMgr = new SfxGenerationManagerImpl(this);
    this._videoGenerationMgr = new VideoGenerationManagerImpl(this);
    this._compositionMgr = new CompositionManagerImpl(this);
    this._renderMgr = new RenderManagerImpl(this);
    this._qualityMgr = new QualityManagerImpl(this);
  }

  public getState(): ContentPipelineState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    this._state = ContentPipelineState.INITIALIZING;
    await this._emit(PipelineEventType.STAGE_STARTED, { stage: "INITIALIZE" });
    this._state = ContentPipelineState.READY;
    await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: "INITIALIZE" });
  }

  public async start(): Promise<void> {
    if (this._state !== ContentPipelineState.READY && this._state !== ContentPipelineState.STOPPED) {
      throw new PipelineExecutionException(`Cannot start pipeline in state: ${this._state}`);
    }
    this._state = ContentPipelineState.EXECUTING;
  }

  public async stop(): Promise<void> {
    this._state = ContentPipelineState.STOPPED;
  }

  public async pause(): Promise<void> {
    if (this._state !== ContentPipelineState.EXECUTING) {
      throw new PipelineExecutionException("Can only pause an executing pipeline.");
    }
    this._state = ContentPipelineState.PAUSED;
  }

  public async resume(): Promise<void> {
    if (this._state !== ContentPipelineState.PAUSED) {
      throw new PipelineExecutionException("Can only resume a paused pipeline.");
    }
    this._state = ContentPipelineState.EXECUTING;
  }

  // ─── Execution Orchestrator ─────────────────────────────────────────────────

  public async execute(scriptId: string, projectId: string, topicPrompt?: string): Promise<PublishingPackage> {
    if (this._state !== ContentPipelineState.EXECUTING) {
      throw new PipelineExecutionException("Pipeline must be in EXECUTING state to run.");
    }

    const startTime = Date.now();
    this._stats.totalRuns++;
    await this._emit(PipelineEventType.PIPELINE_STARTED, { scriptId, projectId });

    try {
      // 1. Storyboard Stage
      this._currentStage = ContentStage.STORYBOARD;
      this._progressPercent = 10;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.STORYBOARD });
      const storyboard = await this._storyboardMgr.generateStoryboard(scriptId, projectId, topicPrompt);
      await this._saveCheckpoint(projectId, ContentStage.STORYBOARD, storyboard);
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.STORYBOARD });

      // 2. Scene Planning Stage
      this._currentStage = ContentStage.SCENE_PLANNING;
      this._progressPercent = 20;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.SCENE_PLANNING });
      const scenes = await this._scenePlanner.planScenes(storyboard.id);
      await this._saveCheckpoint(projectId, ContentStage.SCENE_PLANNING, scenes);
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.SCENE_PLANNING });

      // 3. Image Generation Stage
      this._currentStage = ContentStage.IMAGE_GENERATION;
      this._progressPercent = 30;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.IMAGE_GENERATION });
      const images = await this._imageGenerationMgr.generateImages(scenes);
      this._metrics.assetsGeneratedCount += images.length;
      await this._emit(PipelineEventType.ASSET_GENERATED, { type: "IMAGE", count: images.length });
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.IMAGE_GENERATION });

      // 4. Voice Generation Stage
      this._currentStage = ContentStage.VOICE_GENERATION;
      this._progressPercent = 40;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.VOICE_GENERATION });
      const voice = await this._voiceGenerationMgr.generateVoice(scenes);
      this._metrics.assetsGeneratedCount += voice.length;
      await this._emit(PipelineEventType.ASSET_GENERATED, { type: "VOICE", count: voice.length });
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.VOICE_GENERATION });

      // 5. Music Generation Stage
      this._currentStage = ContentStage.MUSIC_GENERATION;
      this._progressPercent = 50;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.MUSIC_GENERATION });
      const music = await this._musicGenerationMgr.generateMusic("Synthwave electronic background track", storyboard.totalDurationSeconds);
      this._metrics.assetsGeneratedCount += 1;
      await this._emit(PipelineEventType.ASSET_GENERATED, { type: "MUSIC", count: 1 });
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.MUSIC_GENERATION });

      // 6. SFX Generation Stage
      this._currentStage = ContentStage.SFX_GENERATION;
      this._progressPercent = 60;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.SFX_GENERATION });
      const sfx = await this._sfxGenerationMgr.generateSfx(scenes);
      this._metrics.assetsGeneratedCount += sfx.length;
      await this._emit(PipelineEventType.ASSET_GENERATED, { type: "SFX", count: sfx.length });
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.SFX_GENERATION });

      // 7. Video Generation Stage
      this._currentStage = ContentStage.VIDEO_GENERATION;
      this._progressPercent = 70;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.VIDEO_GENERATION });
      const videos = await this._videoGenerationMgr.generateVideos(scenes);
      this._metrics.assetsGeneratedCount += videos.length;
      await this._emit(PipelineEventType.ASSET_GENERATED, { type: "VIDEO", count: videos.length });
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.VIDEO_GENERATION });

      // 8. Composition Stage
      this._currentStage = ContentStage.COMPOSITION;
      this._progressPercent = 80;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.COMPOSITION });
      const timeline = await this._compositionMgr.assembleTimeline(scenes, images, videos, voice, music, sfx);
      await this._saveCheckpoint(projectId, ContentStage.COMPOSITION, timeline);
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.COMPOSITION });

      // 9. Rendering Stage
      this._currentStage = ContentStage.RENDERING;
      this._progressPercent = 90;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.RENDERING });
      const renderReport = await this._renderMgr.render(timeline, RenderQuality.HIGH);
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.RENDERING });

      // 10. QA review & package
      this._currentStage = ContentStage.QUALITY_ASSURANCE;
      this._progressPercent = 95;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.QUALITY_ASSURANCE });
      const qaReport = await this._qualityMgr.review(timeline, renderReport);
      if (!qaReport.passed) {
        await this._emit(PipelineEventType.QUALITY_FAILED, { issues: qaReport.missingAssets });
        throw new Error("QA validation failed.");
      }
      await this._emit(PipelineEventType.STAGE_COMPLETED, { stage: ContentStage.QUALITY_ASSURANCE });

      // 11. Publishing Package
      this._currentStage = ContentStage.PUBLISHING_PACKAGE;
      this._progressPercent = 100;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.PUBLISHING_PACKAGE });

      const pack: PublishingPackage = {
        id: `pack-${Date.now()}`,
        projectId,
        videoFileUrl: renderReport.renderedFileUrl,
        thumbnail: {
          id: `thumb-${Date.now()}`,
          thumbnailUrl: "https://mockmedia.ai/thumbs/primary.png",
          variants: ["https://mockmedia.ai/thumbs/primary.png"],
          width: 1280,
          height: 720
        },
        title: "Deep Dive into TypeScript Features",
        description: "A complete programming tutorial discussing core patterns.",
        tags: ["programming", "typescript", "architecture"],
        captionsSrtUrl: "https://mockmedia.ai/captions/123.srt",
        metadata: { renderQuality: RenderQuality.HIGH },
        analyticsSeed: { expectedViews: 1000 },
        timestamp: new Date()
      };

      // Validator checks
      ContentPipelineValidator.assertValid(storyboard, timeline, pack);

      // Save complete package to Knowledge Base
      if (this.context.knowledgeBaseEngine?.store) {
        await this.context.knowledgeBaseEngine.store({
          type: KnowledgeNodeType.DOCUMENT,
          title: `Publish Package: ${projectId}`,
          content: JSON.stringify(pack),
          source: KnowledgeSource.PIPELINE_ENGINE
        });
      }

      this._reports.set(projectId, pack);
      this._state = ContentPipelineState.COMPLETED;

      // Update statistics
      this._stats.successfulRuns++;
      const duration = Date.now() - startTime;
      this._metrics.totalDurationMs = duration;
      this._stats.averageRunDurationMs =
        (this._stats.averageRunDurationMs * (this._stats.successfulRuns - 1) + duration) /
        this._stats.successfulRuns;
      this._stats.totalAssetsGenerated += this._metrics.assetsGeneratedCount;
      this._stats.totalCostUsd += 0.50; // Mock run cost

      // Save to memory store
      if (this.context.memoryStore?.set) {
        await this.context.memoryStore.set("content-pipeline", `history:${projectId}`, JSON.stringify(pack));
      }

      await this._emit(PipelineEventType.PIPELINE_COMPLETED, { projectId, duration });
      return pack;

    } catch (err: any) {
      this._state = ContentPipelineState.FAILED;
      this._stats.failedRuns++;
      throw err;
    }
  }

  // ─── Snapshots & Telemetry ──────────────────────────────────────────────────

  public getSnapshot(): ExecutionSnapshot {
    const snap: ExecutionSnapshot = {
      pipelineId: `content-snap-${Date.now()}`,
      state: this._state,
      currentStage: this._currentStage,
      progressPercent: this._progressPercent,
      metrics: {
        stageDurationsMs: this._metrics.stageDurationsMs,
        totalDurationMs: this._metrics.totalDurationMs,
        costUsd: this._metrics.costUsd,
        promptTokens: this._metrics.promptTokens,
        completionTokens: this._metrics.completionTokens,
        assetsGeneratedCount: this._metrics.assetsGeneratedCount
      },
      timestamp: new Date()
    };
    return deepFreeze(snap);
  }

  public getStatistics(): ContentPipelineStatistics {
    return this._stats;
  }

  // ─── Manager Getters ────────────────────────────────────────────────────────

  public getStoryboardManager(): IStoryboardManager { return this._storyboardMgr; }
  public getScenePlanner(): IScenePlanner { return this._scenePlanner; }
  public getImageGenerationManager(): IImageGenerationManager { return this._imageGenerationMgr; }
  public getVoiceGenerationManager(): IVoiceGenerationManager { return this._voiceGenerationMgr; }
  public getMusicGenerationManager(): IMusicGenerationManager { return this._musicGenerationMgr; }
  public getSfxGenerationManager(): ISfxGenerationManager { return this._sfxGenerationMgr; }
  public getVideoGenerationManager(): IVideoGenerationManager { return this._videoGenerationMgr; }
  public getCompositionManager(): ICompositionManager { return this._compositionMgr; }
  public getRenderManager(): IRenderManager { return this._renderMgr; }
  public getQualityManager(): IQualityManager { return this._qualityMgr; }

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

  private async _emit(event: PipelineEventType, payload: Record<string, any>): Promise<void> {
    // Local events
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(payload);
      }
    }
    // Global Event Bus
    if (this.context.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-${event.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name: event,
          timestamp: new Date(),
          source: "ContentPipelineEngine",
          payload
        });
      } catch (_) {}
    }
  }

  private async _dbLog(projectId: string, stage: string, status: string): Promise<void> {
    if (this.context.databaseEngine?.getQueryManager()?.execute) {
      try {
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-log-${Date.now()}`,
          sql: "INSERT INTO content_pipeline_logs (project_id, stage, status, logged_at) VALUES (?, ?, ?, ?)",
          parameters: [projectId, stage, status, new Date().toISOString()]
        });
      } catch (_) {}
    }
  }

  private async _saveCheckpoint(projectId: string, stage: ContentStage, data: any): Promise<void> {
    await this._dbLog(projectId, stage, "CHECKPOINT_SAVED");
    if (this.context.databaseEngine?.getQueryManager()?.execute) {
      try {
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-chk-${Date.now()}`,
          sql: "INSERT INTO content_checkpoints (project_id, stage, checkpoint_data) VALUES (?, ?, ?)",
          parameters: [projectId, stage, JSON.stringify(data)]
        });
      } catch (_) {}
    }
  }
}

// ─── Subsystem Implementation Modules ─────────────────────────────────────────

class StoryboardManagerImpl implements IStoryboardManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async generateStoryboard(scriptId: string, projectId: string, topicPrompt?: string): Promise<Storyboard> {
    // Automatically convert script parameters
    const mockScenes: Scene[] = [
      {
        id: "sc-1",
        sceneNumber: 1,
        title: "Introduction",
        scriptText: "Welcome to this deep dive into TypeScript features.",
        durationSeconds: 10,
        shots: [
          {
            id: "shot-1",
            shotNumber: 1,
            description: "Opening code editor",
            camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-in", focus: "Code" },
            durationSeconds: 10,
            visualPrompt: "Futuristic editor with bright glowing letters"
          }
        ],
        transition: "Cut"
      }
    ];

    let scenes: Scene[] = mockScenes;

    if (topicPrompt) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.trim() === "") {
        console.warn("GEMINI_API_KEY is missing or empty. Falling back to mock storyboard.");
      } else {
        let timeoutId: any;
        try {
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 30000);

          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are a scriptwriter for short-form vertical videos. Given the topic below, write a script broken into 3-5 scenes for a video of approximately <total 15-30 seconds>. Respond ONLY with valid JSON (no markdown fences, no commentary) matching this exact shape:
{ "scenes": [ { "title": string, "scriptText": string, "durationSeconds": number, "visualPrompt": string } ] }
Topic: ${topicPrompt}`
                }]
              }],
              generationConfig: { responseMimeType: "application/json" }
            }),
            signal: controller.signal
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const responseData = await response.json() as any;
          const text = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new Error("Invalid response format: text content not found in candidates");
          }

          const parsed = JSON.parse(text);
          if (!parsed || !Array.isArray(parsed.scenes)) {
            throw new Error("Invalid response format: 'scenes' array not found or not an array");
          }

          scenes = parsed.scenes.map((scene: any, index: number) => {
            const sceneNum = index + 1;
            const sceneId = `sc-${sceneNum}`;
            const shotId = `shot-${sceneNum}`;
            const duration = typeof scene.durationSeconds === "number" ? scene.durationSeconds : 10;
            return {
              id: sceneId,
              sceneNumber: sceneNum,
              title: scene.title || `Scene ${sceneNum}`,
              scriptText: scene.scriptText || "",
              durationSeconds: duration,
              shots: [
                {
                  id: shotId,
                  shotNumber: 1,
                  description: scene.visualPrompt || "A visual scene portraying the topic",
                  camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-in", focus: "Subject" },
                  durationSeconds: duration,
                  visualPrompt: scene.visualPrompt || ""
                }
              ],
              transition: "Cut"
            };
          });
        } catch (err: any) {
          console.error("Failed to generate storyboard using Gemini API, falling back to mock storyboard:", err);
          scenes = mockScenes;
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }
    }

    const totalScenes = scenes.length;
    const totalDurationSeconds = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);

    const storyboard: Storyboard = {
      id: `story-${Date.now()}`,
      projectId,
      scriptId,
      scenes,
      totalScenes,
      totalDurationSeconds,
      createdAt: new Date()
    };

    // Store in Knowledge Base
    if (this._engine.context.knowledgeBaseEngine?.store) {
      await this._engine.context.knowledgeBaseEngine.store({
        type: KnowledgeNodeType.RESEARCH,
        title: `Storyboard for Project: ${projectId}`,
        content: JSON.stringify(storyboard),
        source: KnowledgeSource.PIPELINE_ENGINE
      });
    }

    return storyboard;
  }

  public getStoryboard(storyboardId: string): Storyboard | undefined {
    return undefined;
  }
}

class ScenePlannerImpl implements IScenePlanner {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async planScenes(storyboardId: string): Promise<Scene[]> {
    return [
      {
        id: "sc-1",
        sceneNumber: 1,
        title: "Introduction",
        scriptText: "Welcome to this deep dive into TypeScript features.",
        durationSeconds: 10,
        shots: [
          {
            id: "shot-1",
            shotNumber: 1,
            description: "Opening code editor",
            camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-in", focus: "Code" },
            durationSeconds: 10,
            visualPrompt: "Futuristic editor with bright glowing letters"
          }
        ],
        transition: "Cut"
      }
    ];
  }
}

class ImageGenerationManagerImpl implements IImageGenerationManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async generateImages(scenes: Scene[]): Promise<GeneratedAsset[]> {
    const assets: GeneratedAsset[] = [];
    for (const sc of scenes) {
      for (const sh of sc.shots) {
        let mediaUrl = "https://mockmedia.ai/images/fallback.png";
        if (this._engine.context.mediaProviderEngine?.getImageManager()?.generateImage) {
          const res = await this._engine.context.mediaProviderEngine.getImageManager().generateImage({
            id: `img-${sh.id}`,
            prompt: sh.visualPrompt,
            mode: "TEXT_TO_IMAGE"
          });
          mediaUrl = res.assets[0]?.url ?? mediaUrl;
        }
        assets.push({
          id: `img-asset-${sh.id}`,
          type: AssetType.IMAGE,
          url: mediaUrl,
          status: AssetStatus.GENERATED,
          createdAt: new Date(),
          sizeBytes: 1024 * 1024
        });
      }
    }
    return assets;
  }
}

class VoiceGenerationManagerImpl implements IVoiceGenerationManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async generateVoice(scenes: Scene[]): Promise<VoiceSegment[]> {
    const segments: VoiceSegment[] = [];
    let currentOffset = 0;

    for (const sc of scenes) {
      let audioUrl = "https://mockmedia.ai/voices/intro.mp3";
      if (this._engine.context.mediaProviderEngine?.getVoiceManager()?.textToSpeech) {
        const res = await this._engine.context.mediaProviderEngine.getVoiceManager().textToSpeech({
          id: `vox-${sc.id}`,
          text: sc.scriptText,
          voiceId: "Rachel",
          mode: GenerationMode.TEXT_TO_SPEECH
        });
        audioUrl = res.audioUrl ?? audioUrl;
      }
      segments.push({
        id: `vox-seg-${sc.id}`,
        sceneId: sc.id,
        text: sc.scriptText,
        audioUrl,
        durationSeconds: sc.durationSeconds,
        speakerId: "Rachel",
        startOffsetSeconds: currentOffset
      });
      currentOffset += sc.durationSeconds;
    }
    return segments;
  }
}

class MusicGenerationManagerImpl implements IMusicGenerationManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async generateMusic(prompt: string, durationSeconds: number): Promise<MusicTrack> {
    let audioUrl = "https://mockmedia.ai/music/background.mp3";
    if (this._engine.context.mediaProviderEngine?.getMusicManager()?.generateMusic) {
      const res = await this._engine.context.mediaProviderEngine.getMusicManager().generateMusic({
        id: "bg-music-req",
        prompt,
        durationSeconds,
        mode: GenerationMode.TEXT_TO_MUSIC
      });
      audioUrl = res.assets[0]?.url ?? audioUrl;
    }
    return {
      id: "track-1",
      title: "Synthesized Track",
      audioUrl,
      durationSeconds,
      volume: 0.15,
      loop: true
    };
  }
}

class SfxGenerationManagerImpl implements ISfxGenerationManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async generateSfx(scenes: Scene[]): Promise<SoundEffect[]> {
    const effects: SoundEffect[] = [];
    for (const sc of scenes) {
      let audioUrl = "https://mockmedia.ai/sfx/click.mp3";
      if (this._engine.context.mediaProviderEngine?.getMusicManager()?.generateSfx) {
        const res = await this._engine.context.mediaProviderEngine.getMusicManager().generateSfx({
          id: `sfx-${sc.id}`,
          prompt: "Key click",
          mode: GenerationMode.TEXT_TO_SFX
        });
        audioUrl = res.assets[0]?.url ?? audioUrl;
      }
      effects.push({
        id: `sfx-effect-${sc.id}`,
        name: "Key click",
        audioUrl,
        durationSeconds: 1.5,
        triggerOffsetSeconds: 0.5,
        sceneId: sc.id
      });
    }
    return effects;
  }
}

class VideoGenerationManagerImpl implements IVideoGenerationManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async generateVideos(scenes: Scene[]): Promise<VideoSegment[]> {
    const segments: VideoSegment[] = [];
    for (const sc of scenes) {
      for (const sh of sc.shots) {
        let videoUrl = "https://mockmedia.ai/videos/shot.mp4";
        if (this._engine.context.mediaProviderEngine?.getVideoManager()?.generateVideo) {
          const res = await this._engine.context.mediaProviderEngine.getVideoManager().generateVideo({
            id: `vid-${sh.id}`,
            prompt: sh.description,
            durationSeconds: sh.durationSeconds,
            mode: GenerationMode.TEXT_TO_VIDEO
          });
          videoUrl = res.assets[0]?.url ?? videoUrl;
        }
        segments.push({
          id: `vid-seg-${sh.id}`,
          sceneId: sc.id,
          shotId: sh.id,
          videoUrl,
          durationSeconds: sh.durationSeconds,
          fps: 30,
          resolution: "1080p"
        });
      }
    }
    return segments;
  }
}

class CompositionManagerImpl implements ICompositionManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async assembleTimeline(
    scenes: Scene[],
    images: GeneratedAsset[],
    videos: VideoSegment[],
    voice: VoiceSegment[],
    music: MusicTrack,
    sfx: SoundEffect[]
  ): Promise<CompositionTimeline> {
    const totalDur = scenes.reduce((acc, sc) => acc + sc.durationSeconds, 0);

    const imageRefs: AssetReference[] = images.map(img => ({
      id: img.id,
      type: AssetType.IMAGE,
      url: img.url,
      status: AssetStatus.APPROVED
    }));

    const videoRefs: AssetReference[] = videos.map(vid => ({
      id: vid.id,
      type: AssetType.VIDEO,
      url: vid.videoUrl,
      status: AssetStatus.APPROVED,
      meta: { resolution: vid.resolution, fps: vid.fps }
    }));

    const voiceRefs: AssetReference[] = voice.map(vox => ({
      id: vox.id,
      type: AssetType.VOICE,
      url: vox.audioUrl,
      status: AssetStatus.APPROVED,
      meta: { volume: 1.0, sceneId: vox.sceneId }
    }));

    const musicRefs: AssetReference[] = [
      {
        id: music.id,
        type: AssetType.MUSIC,
        url: music.audioUrl,
        status: AssetStatus.APPROVED,
        meta: { volume: music.volume, loop: music.loop }
      }
    ];

    const sfxRefs: AssetReference[] = sfx.map(fx => ({
      id: fx.id,
      type: AssetType.SFX,
      url: fx.audioUrl,
      status: AssetStatus.APPROVED,
      meta: { volume: 0.8, sceneId: fx.sceneId }
    }));

    const tracks: TimelineTrack[] = [
      { id: "tr-images", name: "Visual Layer (Images)", type: AssetType.IMAGE, assets: imageRefs },
      { id: "tr-videos", name: "Visual Layer (Videos)", type: AssetType.VIDEO, assets: videoRefs },
      { id: "tr-voice", name: "Voice-over track", type: AssetType.VOICE, assets: voiceRefs },
      { id: "tr-music", name: "Music background track", type: AssetType.MUSIC, assets: musicRefs },
      { id: "tr-sfx", name: "SFX overlay track", type: AssetType.SFX, assets: sfxRefs }
    ];

    return {
      id: `timeline-${Date.now()}`,
      tracks,
      durationSeconds: totalDur,
      resolution: "1920x1080",
      fps: 30,
      state: CompositionState.COMPLETED
    };
  }
}

class RenderManagerImpl implements IRenderManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async render(timeline: CompositionTimeline, quality: RenderQuality): Promise<RenderReport> {
    const mockReport: RenderReport = {
      id: `render-${Date.now()}`,
      quality,
      resolution: timeline.resolution,
      fps: timeline.fps,
      sizeBytes: 15 * 1024 * 1024,
      durationSeconds: timeline.durationSeconds,
      renderedFileUrl: "https://mockmedia.ai/renders/production-final.mp4",
      timestamp: new Date()
    };

    // Helper function to strip file:// and handle Windows paths
    const fileUrlToPath = (url: string): string => {
      if (url.startsWith("file://")) {
        let p = url.substring(7);
        if (/^\/[a-zA-Z]:/.test(p)) {
          p = p.substring(1);
        }
        return p;
      }
      return url;
    };

    // Promise wrapper for execFile
    const execFilePromise = (file: string, args: string[]): Promise<{ stdout: string; stderr: string }> => {
      return new Promise((resolve, reject) => {
        execFile(file, args, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
    };

    // 1. Extract tracks
    const imageTrack = timeline.tracks.find(t => t.id === "tr-images");
    const voiceTrack = timeline.tracks.find(t => t.id === "tr-voice");

    if (!imageTrack || !voiceTrack) {
      console.warn("RenderManagerImpl: Missing 'tr-images' or 'tr-voice' tracks. Falling back to mock render.");
      return mockReport;
    }

    const imageAssets = imageTrack.assets;
    const voiceAssets = voiceTrack.assets;

    if (imageAssets.length === 0 || voiceAssets.length === 0 || imageAssets.length !== voiceAssets.length) {
      console.warn(
        `RenderManagerImpl: Mismatch or empty tracks (images: ${imageAssets.length}, voice: ${voiceAssets.length}). Falling back to mock render.`
      );
      return mockReport;
    }

    let tempDir: string | undefined;

    try {
      // Create unique temp directory
      const timestamp = Date.now();
      const storageDir = path.join(process.cwd(), "storage", "media");
      tempDir = path.join(storageDir, `render-${timestamp}`);
      fs.mkdirSync(tempDir, { recursive: true });

      // 2. Convert URLs and process each scene
      const numScenes = imageAssets.length;
      for (let i = 0; i < numScenes; i++) {
        const imagePath = fileUrlToPath(imageAssets[i].url);
        const voicePath = fileUrlToPath(voiceAssets[i].url);

        // 3. Query voice duration using ffprobe
        const { stdout: durationStdout } = await execFilePromise("ffprobe", [
          "-v", "error",
          "-show_entries", "format=duration",
          "-of", "default=noprint_wrappers=1:nokey=1",
          voicePath
        ]);
        const duration = parseFloat(durationStdout.trim());
        if (isNaN(duration)) {
          throw new Error(`Failed to parse voice duration from ffprobe: "${durationStdout}"`);
        }

        // 4. Build per-scene clip
        const sceneOutputPath = path.join(tempDir, `scene-${i}.mp4`);
        await execFilePromise("ffmpeg", [
          "-y",
          "-loop", "1",
          "-i", imagePath,
          "-i", voicePath,
          "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-t", duration.toString(),
          "-pix_fmt", "yuv420p",
          "-r", "24",
          "-c:a", "aac",
          "-shortest",
          sceneOutputPath
        ]);
      }

      // 5. Create concat list
      const concatListPath = path.join(tempDir, "concat-list.txt");
      const concatContent = Array.from({ length: numScenes }, (_, i) => `file 'scene-${i}.mp4'`).join("\n");
      fs.writeFileSync(concatListPath, concatContent);

      // 6. Concatenate clips
      const finalOutputPath = path.join(tempDir, "final-output.mp4");
      await execFilePromise("ffmpeg", [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatListPath,
        "-c", "copy",
        finalOutputPath
      ]);

      // 7. Get final video details
      const stats = fs.statSync(finalOutputPath);
      const finalSizeBytes = stats.size;

      const { stdout: finalDurationStdout } = await execFilePromise("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        finalOutputPath
      ]);
      const finalDurationSeconds = parseFloat(finalDurationStdout.trim());
      if (isNaN(finalDurationSeconds)) {
        throw new Error(`Failed to parse final video duration: "${finalDurationStdout}"`);
      }

      // 8. Move/copy final video to standard storage directory
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      const finalFilename = `render-${timestamp}.mp4`;
      const destinationPath = path.join(storageDir, finalFilename);
      fs.copyFileSync(finalOutputPath, destinationPath);

      // Replace backslashes with forward slashes for Windows-compatible file:// URL
      const finalFileUrl = `file:///${destinationPath.replace(/\\/g, "/")}`;

      // 9. Return real RenderReport
      return {
        id: `render-${timestamp}`,
        quality,
        resolution: timeline.resolution,
        fps: timeline.fps,
        sizeBytes: finalSizeBytes,
        durationSeconds: finalDurationSeconds,
        renderedFileUrl: finalFileUrl,
        timestamp: new Date()
      };
    } catch (error) {
      console.error("FFmpeg/FFprobe rendering failed. Falling back to mock render report:", error);
      return mockReport;
    } finally {
      // 11. Clean up temporary directory and scene files
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error("RenderManagerImpl: Clean up of temporary files failed:", cleanupError);
        }
      }
    }
  }
}

class QualityManagerImpl implements IQualityManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async review(timeline: CompositionTimeline, report: RenderReport): Promise<QualityReport> {
    return {
      id: `qa-${Date.now()}`,
      passed: true,
      missingAssets: [],
      badSubtitles: [],
      durationMismatch: false,
      narrationMismatch: false,
      warnings: [],
      timestamp: new Date()
    };
  }
}
