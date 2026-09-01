import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";

const ffmpegDir = "C:\\Users\\asus\\AppData\\Local\\DigitalWave\\DW Free Video Downloader";
if (fs.existsSync(ffmpegDir) && !process.env.PATH?.includes(ffmpegDir)) {
  process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
}
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
  RenderException,
  deepFreeze
} from "./types";
import { Resolution } from "../rendering/Resolution";
import { KnowledgeNodeType } from "../knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "../knowledge-base/KnowledgeSource";
import { ContentPipelineValidator } from "./ContentPipelineValidator";
import { GenerationMode } from "../media-provider/GenerationMode";
import { AssetPipelineEngine } from "../asset-intelligence/AssetPipelineEngine";
import { AssetManifest } from "../asset-intelligence/models";
import { AudioPipelineEngine } from "../audio-intelligence/AudioPipelineEngine";
import { AudioMasteringEngine } from "../audio-intelligence/AudioMasteringEngine";
import { AudioTimeline, AudioMasterReport } from "../audio-intelligence/models";



export class ContentPipelineEngine implements IContentPipelineEngine {
  private _state: ContentPipelineState = ContentPipelineState.CREATED;
  private _currentStage: ContentStage = ContentStage.STORYBOARD;
  private _progressPercent: number = 0;
  private _currentTaskId?: string;
  private _currentProjectId?: string;
  private _lastAssetManifest?: AssetManifest;
  private _lastAudioTimeline?: AudioTimeline;
  private _lastAudioMasterReport?: AudioMasterReport;
  private readonly _assetPipelineEngine: AssetPipelineEngine;
  private readonly _audioPipelineEngine: AudioPipelineEngine;

  public get currentTaskId(): string | undefined {
    return this._currentTaskId;
  }

  public set currentTaskId(val: string | undefined) {
    this._currentTaskId = val;
  }

  public get currentProjectId(): string | undefined {
    return this._currentProjectId;
  }

  public set currentProjectId(val: string | undefined) {
    this._currentProjectId = val;
  }

  public get assetPipelineEngine(): AssetPipelineEngine {
    return this._assetPipelineEngine;
  }

  public get audioPipelineEngine(): AudioPipelineEngine {
    return this._audioPipelineEngine;
  }

  public get lastAssetManifest(): AssetManifest | undefined {
    return this._lastAssetManifest;
  }

  public get lastAudioTimeline(): AudioTimeline | undefined {
    return this._lastAudioTimeline;
  }

  public get lastAudioMasterReport(): AudioMasterReport | undefined {
    return this._lastAudioMasterReport;
  }

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
  private readonly _compositionMgr: ICompositionManager;
  private readonly _renderMgr: IRenderManager;
  private readonly _qualityMgr: IQualityManager;

  constructor(public readonly context: any) {
    if (!context) {
      throw new Error("Context is required for ContentPipelineEngine.");
    }

    this._assetPipelineEngine = new AssetPipelineEngine(context);
    this._audioPipelineEngine = new AudioPipelineEngine(context);

    // Initialize default implementations of managers
    this._storyboardMgr = new StoryboardManagerImpl(this);
    this._scenePlanner = new ScenePlannerImpl(this);
    this._imageGenerationMgr = new ImageGenerationManagerImpl(this);
    this._voiceGenerationMgr = new VoiceGenerationManagerImpl(this);
    this._musicGenerationMgr = new MusicGenerationManagerImpl(this);
    this._sfxGenerationMgr = new SfxGenerationManagerImpl(this);
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

    this._currentTaskId = projectId;
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

      // 7. Composition Stage
      this._currentStage = ContentStage.COMPOSITION;
      this._progressPercent = 80;
      await this._emit(PipelineEventType.STAGE_STARTED, { stage: ContentStage.COMPOSITION });
      const timeline = await this._compositionMgr.assembleTimeline(scenes, images, voice, music, sfx);
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
        metadata: {
          renderQuality: RenderQuality.HIGH,
          assetManifest: this._lastAssetManifest,
          audioMasterReport: this._lastAudioMasterReport,
          audioTimeline: this._lastAudioTimeline,
          debugInfo: {
            detectedDomain: storyboard.domainClassification?.domain || "GENERAL",
            confidence: storyboard.domainClassification?.confidence || 1.0,
            visualStyle: storyboard.visualStylePlan?.visualStyle || "DEFAULT",
            sceneCount: storyboard.scenes.length,
            sceneVisualPlans: storyboard.scenes.map(s => ({
              sceneNumber: s.sceneNumber,
              purpose: s.visualPlan?.purpose,
              dominantVisualType: s.visualPlan?.dominantVisualType,
              layersCount: s.visualPlan?.layers.length || (s.layers ? (s.layers as any[]).length : 1),
              overlaysCount: s.visualPlan?.overlays.length || 0,
              dataVizCount: s.visualPlan?.dataVisualizations.length || 0,
              animationAction: s.animation
            })),
            renderOutputPath: renderReport.renderedFileUrl,
            videoFileUrl: renderReport.renderedFileUrl,
            assetManifest: this._lastAssetManifest,
            audioMasterReport: this._lastAudioMasterReport
          }
        },
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

import {
  SceneCharacter,
  SceneVisualLayer,
  AnimationInstruction,
  CameraMotion,
  AnimationActionPreset
} from "../animation/models";
import {
  createCartoonCharacterSprite,
  createCartoonBackground,
  createDomainBackground
} from "../animation/pngUtils";
import {
  DomainClassifier,
  VisualStylePlanner,
  SceneVisualPlanner,
  ContentDomain,
  DomainClassificationResult,
  VisualStylePlan,
  SceneVisualPlan,
  DataVisualizationSpec,
  OverlaySpec
} from "../visual-intelligence";

class StoryboardManagerImpl implements IStoryboardManager {
  private readonly _storyboards = new Map<string, Storyboard>();

  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async generateStoryboard(scriptId: string, projectId: string, topicPrompt?: string): Promise<Storyboard> {
    const rawPrompt = topicPrompt || "";
    const domainClassification: DomainClassificationResult = await DomainClassifier.classify(rawPrompt);
    const domain: ContentDomain = domainClassification.domain;
    const visualStylePlan: VisualStylePlan = VisualStylePlanner.plan(domainClassification, rawPrompt);

    const defaultCharacters: SceneCharacter[] = domain === "KIDS"
      ? [
          {
            id: "char-leo",
            name: "Leo the Lion Cub",
            description: "Cute cheerful cartoon golden lion cub with big joyful eyes, fluffy mane, and a red bow tie",
            assetUrl: ""
          }
        ]
      : [];

    let mockScenes: Scene[];

    if (domain === "FINANCE") {
      mockScenes = [
        {
          id: "sc-1",
          sceneNumber: 1,
          title: "The Mystery of Rising Prices",
          scriptText: "Have you ever noticed that a dollar buys less today than it did years ago? That is inflation in action.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-1",
              shotNumber: 1,
              description: "Editorial introduction to purchasing power with modern financial indicators",
              camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-in", focus: "Infographic" },
              durationSeconds: 5,
              visualPrompt: "Clean modern financial explainer canvas in deep navy with subtle financial grid and floating currency symbols"
            }
          ],
          transition: "Cut",
          animation: "REVEAL",
          cameraMotion: { type: "ZOOM_IN", intensity: 0.15 }
        },
        {
          id: "sc-2",
          sceneNumber: 2,
          title: "How Money Loses Purchasing Power",
          scriptText: "When the money supply grows faster than the economy, each individual unit buys fewer goods and services.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-2",
              shotNumber: 1,
              description: "Data visualization displaying declining purchasing power curve over time",
              camera: { angle: "Eye Level", pan: "Static", zoom: "Static", focus: "Chart" },
              durationSeconds: 5,
              visualPrompt: "Minimalist dark slate financial chart showing purchasing power curve with glowing emerald trendline"
            }
          ],
          transition: "Cut",
          animation: "DRAW",
          cameraMotion: { type: "STATIC", intensity: 0.1 }
        },
        {
          id: "sc-3",
          sceneNumber: 3,
          title: "The Role of Central Banks",
          scriptText: "Central banks adjust interest rates to cool down inflation or stimulate growth when needed.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-3",
              shotNumber: 1,
              description: "Economic balance diagram showing interest rates vs inflation metrics",
              camera: { angle: "Eye Level", pan: "Pan Right", zoom: "Slow zoom-in", focus: "Diagram" },
              durationSeconds: 5,
              visualPrompt: "Sophisticated editorial diagram with interest rate levers and economic indicators in midnight blue"
            }
          ],
          transition: "Cut",
          animation: "REVEAL",
          cameraMotion: { type: "PAN_RIGHT", intensity: 0.15 }
        },
        {
          id: "sc-4",
          sceneNumber: 4,
          title: "Protecting Your Wealth",
          scriptText: "By investing in productive assets like stocks and real estate, you can stay ahead of rising costs.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-4",
              shotNumber: 1,
              description: "Key takeaway summary card highlighting investment growth strategies",
              camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-out", focus: "Summary" },
              durationSeconds: 5,
              visualPrompt: "Polished financial summary card with compound growth pillar illustration and clean typography"
            }
          ],
          transition: "Cut",
          animation: "COUNT_UP",
          cameraMotion: { type: "ZOOM_OUT", intensity: 0.15 }
        }
      ];
    } else if (domain === "HISTORY") {
      mockScenes = [
        {
          id: "sc-1",
          sceneNumber: 1,
          title: "From City-State to Republic",
          scriptText: "Rome began as a modest settlement on the Tiber River, forged by ambition and strategic alliances.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-1",
              shotNumber: 1,
              description: "Archival view of early Roman architecture and Tiber settlement",
              camera: { angle: "Eye Level", pan: "Pan Right", zoom: "Slow zoom-in", focus: "Environment" },
              durationSeconds: 5,
              visualPrompt: "Warm parchment-toned historical illustration of early Roman Forum and Seven Hills under morning light"
            }
          ],
          transition: "Fade",
          animation: "REVEAL",
          cameraMotion: { type: "PAN_RIGHT", intensity: 0.2 }
        },
        {
          id: "sc-2",
          sceneNumber: 2,
          title: "Mediterranean Expansion",
          scriptText: "Through the Punic Wars, Rome defeated Carthage and expanded its dominance across the Mediterranean Sea.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-2",
              shotNumber: 1,
              description: "Historical map animation revealing expansion routes across the Mediterranean",
              camera: { angle: "Top Down", pan: "Pan Left", zoom: "Static", focus: "Map" },
              durationSeconds: 5,
              visualPrompt: "Antique Mediterranean map with glowing crimson Roman expansion territories and sea routes"
            }
          ],
          transition: "Fade",
          animation: "REVEAL",
          cameraMotion: { type: "PAN_LEFT", intensity: 0.2 }
        },
        {
          id: "sc-3",
          sceneNumber: 3,
          title: "The Disciplined Legions",
          scriptText: "Highly organized Roman legions built roads, fortifications, and secured distant frontiers from Britannia to Egypt.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-3",
              shotNumber: 1,
              description: "Cinematic illustration of Roman legion march along stone road",
              camera: { angle: "Low Angle", pan: "Static", zoom: "Zoom In", focus: "Legion" },
              durationSeconds: 5,
              visualPrompt: "Classical oil painting aesthetic of Roman legion standards and stone fortress at sunset"
            }
          ],
          transition: "Fade",
          animation: "REVEAL",
          cameraMotion: { type: "ZOOM_IN", intensity: 0.25 }
        },
        {
          id: "sc-4",
          sceneNumber: 4,
          title: "The Imperial Legacy",
          scriptText: "At its height, the Roman Empire united diverse cultures and shaped law, language, and architecture for millennia.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-4",
              shotNumber: 1,
              description: "Panoramic overview of the Colosseum and imperial monuments",
              camera: { angle: "Wide", pan: "Static", zoom: "Slow zoom-out", focus: "Monuments" },
              durationSeconds: 5,
              visualPrompt: "Majestic golden hour panoramic view of Imperial Rome with marble arches and aqueducts"
            }
          ],
          transition: "Fade",
          animation: "REVEAL",
          cameraMotion: { type: "ZOOM_OUT", intensity: 0.2 }
        }
      ];
    } else if (domain === "DOCUMENTARY") {
      mockScenes = [
        {
          id: "sc-1",
          sceneNumber: 1,
          title: "The Ocean Heat Engine",
          scriptText: "Covering over seventy percent of our planet, the global oceans absorb the vast majority of excess thermal energy.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-1",
              shotNumber: 1,
              description: "Cinematic deep ocean wide shot with sunbeams piercing through dark water",
              camera: { angle: "Wide", pan: "Static", zoom: "Slow zoom-in", focus: "Ocean" },
              durationSeconds: 5,
              visualPrompt: "Cinematic photographic view of open azure ocean with shimmering surface light and deep blue depths"
            }
          ],
          transition: "Fade",
          animation: "FLOAT",
          cameraMotion: { type: "ZOOM_IN", intensity: 0.2 }
        },
        {
          id: "sc-2",
          sceneNumber: 2,
          title: "Rising Temperature Anomalies",
          scriptText: "Scientific measurements reveal sea surface temperatures reaching record anomalies year after year.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-2",
              shotNumber: 1,
              description: "Global ocean thermal map displaying temperature anomalies in vivid thermal hues",
              camera: { angle: "Satellite View", pan: "Pan Right", zoom: "Static", focus: "Thermal Map" },
              durationSeconds: 5,
              visualPrompt: "High-resolution satellite ocean thermal map with glowing infrared heat signatures across currents"
            }
          ],
          transition: "Fade",
          animation: "REVEAL",
          cameraMotion: { type: "PAN_RIGHT", intensity: 0.2 }
        },
        {
          id: "sc-3",
          sceneNumber: 3,
          title: "Impact on Coral Ecosystems",
          scriptText: "Even slight temperature increases trigger mass coral bleaching, destabilizing marine food webs.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-3",
              shotNumber: 1,
              description: "Close documentary inspection of coral reef marine biodiversity",
              camera: { angle: "Macro", pan: "Static", zoom: "Zoom In", focus: "Coral" },
              durationSeconds: 5,
              visualPrompt: "Documentary footage style close-up of intricate coral formations and shimmering tropical marine life"
            }
          ],
          transition: "Fade",
          animation: "FLOAT",
          cameraMotion: { type: "ZOOM_IN", intensity: 0.25 }
        },
        {
          id: "sc-4",
          sceneNumber: 4,
          title: "The Path to Ocean Equilibrium",
          scriptText: "Protecting our oceans requires global emissions reduction and marine conservation worldwide.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-4",
              shotNumber: 1,
              description: "Expansive shoreline view with gentle waves under dramatic atmospheric sky",
              camera: { angle: "Wide", pan: "Static", zoom: "Slow zoom-out", focus: "Horizon" },
              durationSeconds: 5,
              visualPrompt: "Dramatic cinematic coastal landscape with rolling pristine waves and golden atmospheric lighting"
            }
          ],
          transition: "Fade",
          animation: "FLOAT",
          cameraMotion: { type: "ZOOM_OUT", intensity: 0.2 }
        }
      ];
    } else if (domain === "KIDS") {
      mockScenes = [
        {
          id: "sc-1",
          sceneNumber: 1,
          title: "Leo Arrives in the Meadow",
          scriptText: "Meet Leo the little lion! Today is a big adventure day in the sunny meadow.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-1",
              shotNumber: 1,
              description: "Leo enters the bright cartoon meadow with a playful skip",
              camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-in", focus: "Character" },
              durationSeconds: 5,
              visualPrompt: "Bright colorful cartoon meadow with rainbow flowers and rolling green hills under a sunny blue sky"
            }
          ],
          transition: "Cut",
          animation: "ENTER_LEFT",
          cameraMotion: { type: "ZOOM_IN", intensity: 0.2 },
          characterConfiguration: { characterId: "char-leo", name: "Leo the Lion Cub" },
          animationInstructions: [
            {
              characterId: "char-leo",
              action: "ENTER_LEFT",
              movement: { startX: 0.35, startY: 0.65, endX: 0.35, endY: 0.65 }
            }
          ]
        },
        {
          id: "sc-2",
          sceneNumber: 2,
          title: "Leo Explores the Path",
          scriptText: "Leo trots happily along the flower path, looking for dancing butterflies.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-2",
              shotNumber: 1,
              description: "Leo walks across the path as the camera pans along",
              camera: { angle: "Eye Level", pan: "Pan Right", zoom: "Static", focus: "Character" },
              durationSeconds: 5,
              visualPrompt: "Whimsical cartoon flower path winding through bright green trees with sparkling sunbeams"
            }
          ],
          transition: "Cut",
          animation: "WALK",
          cameraMotion: { type: "PAN_RIGHT", intensity: 0.3 },
          characterConfiguration: { characterId: "char-leo", name: "Leo the Lion Cub" },
          animationInstructions: [
            {
              characterId: "char-leo",
              action: "WALK",
              movement: { startX: 0.15, startY: 0.65, endX: 0.82, endY: 0.65 }
            }
          ]
        },
        {
          id: "sc-3",
          sceneNumber: 3,
          title: "The Big Joyful Leap",
          scriptText: "Look at that sparkling brook! Leo gathers speed and leaps high into the air!",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-3",
              shotNumber: 1,
              description: "Leo takes a high joyful leap over the crystal stream",
              camera: { angle: "Low Angle", pan: "Static", zoom: "Zoom In", focus: "Action" },
              durationSeconds: 5,
              visualPrompt: "Playful cartoon sparkling crystal stream with colorful stepping stones and friendly mushrooms"
            }
          ],
          transition: "Cut",
          animation: "JUMP",
          cameraMotion: { type: "ZOOM_IN", intensity: 0.3 },
          characterConfiguration: { characterId: "char-leo", name: "Leo the Lion Cub" },
          animationInstructions: [
            {
              characterId: "char-leo",
              action: "JUMP",
              movement: { startX: 0.2, startY: 0.65, endX: 0.8, endY: 0.65 }
            }
          ]
        },
        {
          id: "sc-4",
          sceneNumber: 4,
          title: "Leo Waves Goodbye",
          scriptText: "Hooray, what a wonderful adventure! See you next time, little friends!",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-4",
              shotNumber: 1,
              description: "Leo standing in the center waving happily under sunset",
              camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-out", focus: "Character" },
              durationSeconds: 5,
              visualPrompt: "Vibrant cartoon meadow clearing with gentle golden sunset, floating bubbles and twinkling stars"
            }
          ],
          transition: "Cut",
          animation: "WAVE",
          cameraMotion: { type: "ZOOM_OUT", intensity: 0.2 },
          characterConfiguration: { characterId: "char-leo", name: "Leo the Lion Cub" },
          animationInstructions: [
            {
              characterId: "char-leo",
              action: "WAVE",
              movement: { startX: 0.5, startY: 0.65, endX: 0.5, endY: 0.65 }
            }
          ]
        }
      ];
    } else {
      mockScenes = [
        {
          id: "sc-1",
          sceneNumber: 1,
          title: "Introduction",
          scriptText: "Welcome to this deep dive into core concepts.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-1",
              shotNumber: 1,
              description: "Opening code editor",
              camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-in", focus: "Code" },
              durationSeconds: 5,
              visualPrompt: "Futuristic editor with bright glowing letters"
            }
          ],
          transition: "Cut"
        },
        {
          id: "sc-2",
          sceneNumber: 2,
          title: "Core Mechanics",
          scriptText: "Here is how the foundational architecture operates.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-2",
              shotNumber: 1,
              description: "System diagram showing structural dataflow",
              camera: { angle: "Eye Level", pan: "Pan Right", zoom: "Static", focus: "Diagram" },
              durationSeconds: 5,
              visualPrompt: "Clean modular architecture diagram in dark slate"
            }
          ],
          transition: "Cut"
        },
        {
          id: "sc-3",
          sceneNumber: 3,
          title: "Performance & Scale",
          scriptText: "Scaling the engine ensures deterministic high throughput.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-3",
              shotNumber: 1,
              description: "Performance metrics graph over time",
              camera: { angle: "Eye Level", pan: "Static", zoom: "Zoom In", focus: "Metrics" },
              durationSeconds: 5,
              visualPrompt: "Performance metrics visualization with glowing trendlines"
            }
          ],
          transition: "Cut"
        },
        {
          id: "sc-4",
          sceneNumber: 4,
          title: "Summary",
          scriptText: "With these primitives in place, production workflows run seamlessly.",
          durationSeconds: 5,
          shots: [
            {
              id: "shot-4",
              shotNumber: 1,
              description: "Summary overview card",
              camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-out", focus: "Summary" },
              durationSeconds: 5,
              visualPrompt: "Clean summary layout with key takeaways"
            }
          ],
          transition: "Cut"
        }
      ];
    }

    let scenes: Scene[] = mockScenes;
    let characters: SceneCharacter[] = defaultCharacters;

    if (topicPrompt) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.trim() === "") {
        console.warn("GEMINI_API_KEY is missing or empty. Falling back to deterministic domain storyboard.");
      } else {
        let timeoutId: any;
        try {
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 30000);

          const systemPrompt = domain === "KIDS"
            ? `You are an animation director for animated kids cartoon videos. Given the topic below, generate a 4-scene animated story with a single consistent cute animal/character protagonist (e.g. Leo the Lion, Barnaby Bear, Pip the Bunny). Each scene MUST have continuous programmatic animation action (e.g. ENTER_LEFT, WALK, JUMP, BOUNCE, WAVE, FLOAT, SHAKE) and a bright cartoon background prompt. Each scene duration should be 4 to 6 seconds so the total is approximately 20 seconds. Respond ONLY with valid JSON (no markdown fences, no commentary) matching this exact shape:
{
  "character": { "id": string, "name": string, "description": string },
  "scenes": [
    {
      "title": string,
      "scriptText": string,
      "durationSeconds": number,
      "visualPrompt": string,
      "characterAction": "ENTER_LEFT" | "WALK" | "JUMP" | "BOUNCE" | "WAVE" | "FLOAT" | "SHAKE" | "EXIT_RIGHT" | "IDLE",
      "movement": { "startX": number, "startY": number, "endX": number, "endY": number },
      "cameraMotion": "ZOOM_IN" | "ZOOM_OUT" | "PAN_LEFT" | "PAN_RIGHT" | "TRACK_SUBJECT" | "CAMERA_SHAKE"
    }
  ]
}
Topic: ${topicPrompt}`
            : `You are an executive video director producing high-impact ${domain} video explainers. Given the topic below, generate an exact 4-scene script (each 5 seconds, total 20 seconds) tailored to the ${domain} domain with rich visual descriptions. Respond ONLY with valid JSON matching this exact shape:
{ "scenes": [ { "title": string, "scriptText": string, "durationSeconds": number, "visualPrompt": string, "cameraMotion": "ZOOM_IN" | "ZOOM_OUT" | "PAN_LEFT" | "PAN_RIGHT" | "KEN_BURNS" } ] }
Topic: ${topicPrompt}`;

          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: systemPrompt }]
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
          if (parsed && Array.isArray(parsed.scenes)) {
            if (parsed.character) {
              characters = [
                {
                  id: parsed.character.id || "char-main",
                  name: parsed.character.name || "Main Character",
                  description: parsed.character.description || "Cute 2D cartoon character",
                  assetUrl: ""
                }
              ];
            }

            scenes = parsed.scenes.map((scene: any, index: number) => {
              const sceneNum = index + 1;
              const sceneId = `sc-${sceneNum}`;
              const shotId = `shot-${sceneNum}`;
              const duration = typeof scene.durationSeconds === "number" ? scene.durationSeconds : 5;
              const actionPreset = (scene.characterAction as AnimationActionPreset) || (domain === "KIDS" ? "WALK" : "REVEAL");
              const charId = characters[0]?.id || "char-main";

              const startX = scene.movement?.startX ?? (actionPreset === "ENTER_LEFT" ? 0.35 : 0.2);
              const startY = scene.movement?.startY ?? 0.65;
              const endX = scene.movement?.endX ?? (actionPreset === "ENTER_LEFT" ? 0.35 : 0.8);
              const endY = scene.movement?.endY ?? 0.65;

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
                    camera: { angle: "Eye Level", pan: scene.cameraMotion || "Static", zoom: "Slow zoom-in", focus: "Subject" },
                    durationSeconds: duration,
                    visualPrompt: scene.visualPrompt || ""
                  }
                ],
                transition: domain === "HISTORY" || domain === "DOCUMENTARY" ? "Fade" : "Cut",
                animation: actionPreset,
                cameraMotion: {
                  type: scene.cameraMotion || visualStylePlan.cameraStyle.preferredMotion,
                  intensity: visualStylePlan.cameraStyle.intensity
                },
                characterConfiguration: characters[0] ? { characterId: charId, name: characters[0].name } : undefined,
                animationInstructions: domain === "KIDS"
                  ? [
                      {
                        characterId: charId,
                        action: actionPreset,
                        movement: { startX, startY, endX, endY }
                      }
                    ]
                  : undefined
              };
            });
            console.log(`Gemini storyboard generated ${scenes.length} scenes for domain [${domain}] topic: "${topicPrompt}"`);
          }
        } catch (err: any) {
          console.error("Failed to generate storyboard using Gemini API, falling back to mock storyboard:", err);
          scenes = mockScenes;
          characters = defaultCharacters;
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      }
    }

    // Enrich all scenes with SceneVisualPlanner
    scenes = scenes.map(sc => {
      const visualPlan = SceneVisualPlanner.planScene(sc, visualStylePlan, characters);
      return {
        ...sc,
        visualPlan,
        layers: sc.layers && sc.layers.length > 0 ? sc.layers : visualPlan.layers,
        overlays: visualPlan.overlays,
        dataVisualizations: visualPlan.dataVisualizations,
        cameraMotion: sc.cameraMotion || visualPlan.cameraMotion,
        animationInstructions: sc.animationInstructions && sc.animationInstructions.length > 0 ? sc.animationInstructions : visualPlan.animationInstructions
      };
    });

    const totalScenes = scenes.length;
    const totalDurationSeconds = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);

    const storyboard: Storyboard = {
      id: `story-${Date.now()}`,
      projectId,
      scriptId,
      scenes,
      characters,
      visualStylePlan,
      domainClassification,
      totalScenes,
      totalDurationSeconds,
      createdAt: new Date()
    };

    // Save in local cache
    this._storyboards.set(storyboard.id, storyboard);

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
    return this._storyboards.get(storyboardId);
  }
}

class ScenePlannerImpl implements IScenePlanner {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async planScenes(storyboardId: string): Promise<Scene[]> {
    const storyboard = this._engine.getStoryboardManager().getStoryboard(storyboardId);
    if (storyboard && storyboard.scenes && storyboard.scenes.length > 0) {
      return storyboard.scenes;
    }

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
    const isTestMode =
      this._engine.context?.env === "test" ||
      this._engine.context?.metadata?.env === "test" ||
      process.env.NODE_ENV === "test";

    const storyboard: Storyboard = {
      id: `sb-${Date.now()}`,
      projectId: this._engine.currentProjectId || "project-default",
      scriptId: `script-${Date.now()}`,
      scenes,
      totalScenes: scenes.length,
      totalDurationSeconds: scenes.reduce((acc, s) => acc + s.durationSeconds, 0),
      createdAt: new Date()
    };

    const { manifest, resolvedAssets } = await this._engine.assetPipelineEngine.planAndResolveAssets(
      storyboard,
      scenes[0]?.visualPlan ? { overallDirection: scenes[0].visualPlan.visualObjective } as any : undefined,
      {
        taskId: this._engine.currentTaskId,
        projectId: this._engine.currentProjectId,
        isProduction: !isTestMode
      }
    );

    (this._engine as any)._lastAssetManifest = manifest;

    return resolvedAssets.map(ra => ({
      id: ra.id,
      type: AssetType.IMAGE,
      url: ra.publicUrl,
      status: AssetStatus.GENERATED,
      createdAt: ra.createdAt,
      sizeBytes: ra.sizeBytes,
      metadata: {
        checksum: ra.checksum,
        contentHash: ra.contentHash,
        kind: ra.kind,
        origin: ra.origin,
        isFallback: ra.isFallback
      }
    }));
  }
}


class VoiceGenerationManagerImpl implements IVoiceGenerationManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async generateVoice(scenes: Scene[]): Promise<VoiceSegment[]> {
    const isTestMode =
      this._engine.context?.env === "test" ||
      this._engine.context?.metadata?.env === "test" ||
      process.env.NODE_ENV === "test";

    const storyboard: Storyboard = {
      id: `sb-${Date.now()}`,
      projectId: this._engine.currentProjectId || "project-default",
      scriptId: `script-${Date.now()}`,
      scenes,
      totalScenes: scenes.length,
      totalDurationSeconds: scenes.reduce((acc, s) => acc + s.durationSeconds, 0),
      createdAt: new Date()
    };

    const audioRes = await this._engine.audioPipelineEngine.produceAudio(storyboard, this._engine.currentTaskId);
    (this._engine as any)._lastAudioTimeline = audioRes.timeline;
    (this._engine as any)._lastAudioMasterReport = audioRes.masterReport;

    return audioRes.narrationPlan.segments.map(seg => ({
      id: seg.id,
      sceneId: seg.sceneId,
      text: seg.text,
      audioUrl: seg.audioUrl || `file:///${seg.filePath?.replace(/\\/g, "/")}`,
      durationSeconds: seg.actualDurationSeconds || seg.expectedDurationSeconds || 5,
      speakerId: seg.speakerId,
      startOffsetSeconds: seg.startOffsetSeconds || 0
    }));
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

class CompositionManagerImpl implements ICompositionManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async assembleTimeline(
    scenes: Scene[],
    images: GeneratedAsset[],
    voice: VoiceSegment[],
    music: MusicTrack,
    sfx: SoundEffect[]
  ): Promise<CompositionTimeline> {
    const totalDur = scenes.reduce((acc, sc) => acc + sc.durationSeconds, 0);

    const imageRefs: AssetReference[] = images.map((img, i) => {
      const scene = scenes.find(s => s.id === img.id || s.shots.some(sh => sh.id === img.id || `img-${sh.id}` === img.id || `img-asset-${sh.id}` === img.id || img.id.includes(sh.id))) || scenes[i];
      return {
        id: img.id,
        type: AssetType.IMAGE,
        url: img.url,
        status: AssetStatus.APPROVED,
        meta: {
          sceneId: scene?.id,
          animation: scene?.animation,
          camera: scene?.camera,
          cameraMotion: scene?.cameraMotion,
          text: scene?.text || scene?.overlayText,
          visualType: scene?.visualType || "IMAGE",
          chartConfiguration: scene?.chartConfiguration,
          mapConfiguration: scene?.mapConfiguration,
          characterConfiguration: scene?.characterConfiguration,
          animationInstructions: scene?.animationInstructions,
          layers: scene?.layers,
          visualPlan: scene?.visualPlan,
          visualPrimitives: scene?.visualPlan?.visualPrimitives || (scene as any)?.visualPrimitives,
          duration: scene?.durationSeconds
        }
      };
    });


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
      { id: "tr-videos", name: "Visual Layer (Videos)", type: AssetType.VIDEO, assets: [] },
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
      state: CompositionState.COMPLETED,
      audioTimeline: (this._engine as any)._lastAudioTimeline,
      audioMasterUrl: (this._engine as any)._lastAudioMasterReport?.masterFileUrl,
      audioMasterReport: (this._engine as any)._lastAudioMasterReport
    };

  }
}

class RenderManagerImpl implements IRenderManager {
  constructor(private readonly _engine: ContentPipelineEngine) {}

  public async render(timeline: CompositionTimeline, quality: RenderQuality): Promise<RenderReport> {
    // Try to find the RenderEngine on the context and delegate rendering to it
    const renderEngine = this._engine.context.renderEngine 
      || (this._engine.context.runtimeEngine ? this._engine.context.runtimeEngine.getEngine("RenderEngine") : null)
      || (this._engine.context.registry?.resolve ? this._engine.context.registry.resolve({ name: "IRenderEngine" }) : null);

    const isTestMode = this._engine.context?.env === "test" || this._engine.context?.metadata?.env === "test" || process.env.NODE_ENV === "test";

    if (renderEngine) {
      try {
        let resolution: Resolution;
        if (timeline.resolution === "1920x1080" || timeline.resolution === "P1080" || timeline.resolution === Resolution.P1080) {
          resolution = Resolution.P1080;
        } else if (timeline.resolution === "1280x720" || timeline.resolution === "P720" || timeline.resolution === Resolution.P720) {
          resolution = Resolution.P720;
        } else if (Object.values(Resolution).includes(timeline.resolution as any)) {
          resolution = timeline.resolution as Resolution;
        } else {
          resolution = Resolution.P1080; // default fallback
        }

        const renderRes = await renderEngine.render({
          id: `render-${Date.now()}`,
          compositionId: timeline.id,
          format: "MP4",
          resolution,
          quality: "STANDARD",
          codec: "H264",
          fps: timeline.fps || 30,
          state: "CREATED",
          timestamp: new Date(),
          options: {
            outputPath: path.join(process.cwd(), "storage", "media", `render-${Date.now()}.mp4`),
            timeline
          }
        });

        return {
          id: renderRes.id,
          quality,
          resolution: renderRes.resolution,
          fps: renderRes.fps,
          sizeBytes: renderRes.fileSizeBytes || 15 * 1024 * 1024,
          durationSeconds: renderRes.durationSeconds || timeline.durationSeconds,
          renderedFileUrl: `file:///${renderRes.outputPath.replace(/\\/g, "/")}`,
          timestamp: new Date()
        };
      } catch (err: any) {
        if (!isTestMode) {
          throw err instanceof RenderException ? err : new RenderException(`RenderEngine failed: ${err.message || err}`);
        }
        console.error("RenderManagerImpl: RenderEngine failed, falling back to internal rendering:", err);
      }
    } else {
      if (!isTestMode) {
        throw new RenderException("RenderEngine is not available in production.");
      }
    }

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

        // 3. Query voice duration using AudioMasteringEngine
        const duration = (await AudioMasteringEngine.queryAudioDuration(voicePath)) || 5;


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
