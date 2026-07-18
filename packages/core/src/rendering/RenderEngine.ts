import {
  IRenderEngine,
  IFrameRenderer,
  IEncoder,
  IExporter,
  IRenderOptimizer,
  IQualityAnalyzer,
} from "./interfaces";
import { RenderingState }        from "./RenderingState";
import { ExportFormat }          from "./ExportFormat";
import { CodecType }             from "./CodecType";
import { Resolution, RESOLUTION_DIMENSIONS } from "./Resolution";
import { QualityPreset, QUALITY_CRF } from "./QualityPreset";
import {
  RenderingRequest,
  RenderingResponse,
  RenderJob,
  RenderFrame,
  EncodingSettings,
  ExportProfile,
  RenderProgress,
  RenderStatistics,
  RenderMetrics,
  RenderReport,
  RenderSnapshot,
} from "./models";
import { RenderValidator } from "./RenderValidator";
import {
  RenderingException,
  RenderingValidationException,
  DuplicateRenderException,
  InvalidRenderingStateException,
  MissingTimelineException,
  deepFreeze,
} from "./types";

// ─── Default Frame Renderer ───────────────────────────────────────────────────

class DefaultFrameRenderer implements IFrameRenderer {
  public async renderFrames(
    job: RenderJob,
    timeline: {
      durationSeconds: number;
      fps: number;
      tracks: Array<{ id: string; type: string; clips: Array<{ startTimeSeconds: number; endTimeSeconds: number; assetPath: string; transitions: unknown[]; effects: unknown[] }> }>;
      subtitleTrack: { entries: Array<{ startTimeSeconds: number; endTimeSeconds: number; text: string }> };
    },
    maxConcurrent: number
  ): Promise<RenderFrame[]> {
    const frames: RenderFrame[] = [];
    const frameInterval = 1 / timeline.fps;

    // Render in batches of maxConcurrent
    const frameIndexes = Array.from({ length: job.totalFrames }, (_, i) => i);
    const batches: number[][] = [];
    for (let i = 0; i < frameIndexes.length; i += maxConcurrent) {
      batches.push(frameIndexes.slice(i, i + maxConcurrent));
    }

    for (const batch of batches) {
      const batchFrames = await Promise.all(
        batch.map(async (idx): Promise<RenderFrame> => {
          const ts = parseFloat((idx * frameInterval).toFixed(6));

          // Determine which tracks/clips are active at this timestamp
          const activeTracks = timeline.tracks
            .filter((t) => t.clips.some((c) => c.startTimeSeconds <= ts && c.endTimeSeconds > ts))
            .map((t) => t.id);

          const activeTransitions: string[] = [];
          const activeEffects: string[]   = [];
          for (const track of timeline.tracks) {
            for (const clip of track.clips) {
              if (clip.startTimeSeconds <= ts && clip.endTimeSeconds > ts) {
                (clip.transitions as any[]).forEach((tr: any) => {
                  if (tr?.id) activeTransitions.push(tr.id);
                });
                (clip.effects as any[]).forEach((fx: any) => {
                  if (fx?.id) activeEffects.push(fx.id);
                });
              }
            }
          }

          const hasSubtitle = timeline.subtitleTrack.entries.some(
            (e) => e.startTimeSeconds <= ts && e.endTimeSeconds > ts
          );

          return {
            id:                `${job.id}-f${idx}`,
            jobId:             job.id,
            index:             idx,
            timestampSeconds:  ts,
            filePath:          `/render/frames/${job.id}/frame-${String(idx).padStart(6, "0")}.png`,
            state:             RenderingState.COMPLETED,
            activeTracks,
            activeTransitions,
            activeEffects,
            hasSubtitle,
            hasAudio:          activeTracks.length > 0,
          };
        })
      );
      frames.push(...batchFrames);
    }

    return frames;
  }
}

// ─── Default Encoder ─────────────────────────────────────────────────────────

class DefaultEncoder implements IEncoder {
  public async encode(
    frames: RenderFrame[],
    settings: EncodingSettings,
    _audioMixPath: string,
    outputPath: string
  ): Promise<{ outputPath: string; fileSizeBytes: number; durationSeconds: number }> {
    // Simulate encoding: calculate estimated file size from frames × bitrate
    const totalFrames    = frames.length;
    const fps            = totalFrames > 0 ? (frames[frames.length - 1].timestampSeconds > 0
      ? totalFrames / frames[frames.length - 1].timestampSeconds
      : 30) : 30;
    const durationSeconds = parseFloat((totalFrames / fps).toFixed(3));

    // Approximate: bitrate (kbps) × duration / 8 = kilobytes → bytes
    const videoBits  = settings.videoBitrateKbps * durationSeconds * 1000 / 8;
    const audioBits  = settings.audioBitrateKbps * durationSeconds * 1000 / 8;
    const fileSizeBytes = Math.floor(videoBits + audioBits);

    const encodedPath = outputPath.replace(/\.[^.]+$/, ".encoded.tmp");
    return { outputPath: encodedPath, fileSizeBytes, durationSeconds };
  }
}

// ─── Default Exporter ────────────────────────────────────────────────────────

class DefaultExporter implements IExporter {
  private static readonly EXT: Record<ExportFormat, string> = {
    [ExportFormat.MP4]:            ".mp4",
    [ExportFormat.MOV]:            ".mov",
    [ExportFormat.MKV]:            ".mkv",
    [ExportFormat.WEBM]:           ".webm",
    [ExportFormat.GIF]:            ".gif",
    [ExportFormat.IMAGE_SEQUENCE]: ".zip",
  };

  public async export(
    _encodedPath: string,
    profile: ExportProfile
  ): Promise<{ outputPath: string; fileSizeBytes: number }> {
    const ext       = DefaultExporter.EXT[profile.format] || ".mp4";
    // Strip any existing extension and append the correct one
    const basePath  = profile.outputPath.replace(/\.[^./\\]+$/, "");
    const finalPath = basePath + ext;

    // Simulate container muxing: slight overhead
    const dim          = RESOLUTION_DIMENSIONS[profile.resolution];
    const pixelCount   = (dim.width * dim.height * profile.fps) || (1920 * 1080 * 30);
    const fileSizeBytes = Math.floor(pixelCount * 0.02); // rough compression estimate

    return { outputPath: finalPath, fileSizeBytes };
  }
}

// ─── Default Render Optimizer ─────────────────────────────────────────────────

class DefaultRenderOptimizer implements IRenderOptimizer {
  private static readonly SPEED_PRESET: Record<QualityPreset, string> = {
    [QualityPreset.DRAFT]:    "ultrafast",
    [QualityPreset.FAST]:     "superfast",
    [QualityPreset.STANDARD]: "medium",
    [QualityPreset.HIGH]:     "slow",
    [QualityPreset.LOSSLESS]: "veryslow",
  };

  private static readonly BITRATE: Record<Resolution, number> = {
    [Resolution.P720]:   2_500,
    [Resolution.P1080]:  8_000,
    [Resolution.P1440]: 16_000,
    [Resolution.K4]:    35_000,
    [Resolution.K8]:    80_000,
    [Resolution.CUSTOM]: 8_000,
  };

  public optimizeSettings(
    codec: CodecType,
    quality: QualityPreset,
    resolution: Resolution,
    fps: number,
    _durationSeconds: number
  ): EncodingSettings {
    const crf          = QUALITY_CRF[quality];
    const videoBitrateKbps = DefaultRenderOptimizer.BITRATE[resolution] || 8_000;
    const speedPreset  = DefaultRenderOptimizer.SPEED_PRESET[quality];

    // H265/AV1 are 2× more efficient than H264 — reduce bitrate
    const bitrateMultiplier =
      codec === CodecType.H265 || codec === CodecType.AV1 ? 0.5 : 1.0;

    return {
      codec,
      crf,
      videoBitrateKbps: Math.floor(videoBitrateKbps * bitrateMultiplier),
      audioBitrateKbps: 192,
      threads:           Math.min(8, Math.ceil(fps / 5)),
      hwAccel:           false,
      speedPreset,
      extraParams:       {},
    };
  }

  public estimateGpuMemoryMb(resolution: Resolution, fps: number): number {
    const dim = RESOLUTION_DIMENSIONS[resolution];
    return Math.ceil((dim.width * dim.height * 4 * fps) / (1024 * 1024));
  }

  public estimateEncodingSeconds(
    totalFrames: number,
    codec: CodecType,
    resolution: Resolution,
    hwAccel: boolean
  ): number {
    const baseRate = hwAccel ? 200 : 60; // frames per second of encoding
    const codecFactor =
      codec === CodecType.AV1 ? 5 :
      codec === CodecType.H265 ? 2 : 1;
    const resFactor =
      resolution === Resolution.K4  ? 4 :
      resolution === Resolution.K8  ? 16 :
      resolution === Resolution.P1440 ? 2 : 1;
    return parseFloat((totalFrames / (baseRate / (codecFactor * resFactor))).toFixed(2));
  }
}

// ─── Default Quality Analyzer ─────────────────────────────────────────────────

class DefaultQualityAnalyzer implements IQualityAnalyzer {
  public analyzeFrame(frame: RenderFrame): number {
    // Heuristic: frames with more active tracks are higher quality composites
    const trackScore      = Math.min(frame.activeTracks.length / 3, 1.0) * 0.5;
    const transitionScore = frame.activeTransitions.length > 0 ? 0.2 : 0;
    const effectScore     = frame.activeEffects.length > 0 ? 0.3 : 0;
    return parseFloat((trackScore + transitionScore + effectScore).toFixed(3));
  }

  public analyzeJob(frames: RenderFrame[]): number {
    if (frames.length === 0) return 0;
    const total = frames.reduce((sum, f) => sum + this.analyzeFrame(f), 0);
    return parseFloat((total / frames.length).toFixed(3));
  }

  public getWarnings(frames: RenderFrame[], threshold = 0.1): string[] {
    const warnings: string[] = [];
    const low = frames.filter((f) => this.analyzeFrame(f) < threshold);
    if (low.length > 0) {
      warnings.push(
        `${low.length} frame(s) scored below quality threshold (${threshold}). ` +
        `Check clips and effects.`
      );
    }
    const noTrack = frames.filter((f) => f.activeTracks.length === 0);
    if (noTrack.length > 0) {
      warnings.push(`${noTrack.length} frame(s) have no active visual tracks (blank frames).`);
    }
    return warnings;
  }
}

// ─── Render Engine ────────────────────────────────────────────────────────────

export class RenderEngine implements IRenderEngine {
  private _state = RenderingState.CREATED;
  private readonly _requests     = new Map<string, RenderingRequest>();
  private readonly _responses    = new Map<string, RenderingResponse>();
  private readonly _snapshots    = new Map<string, RenderSnapshot>();
  private readonly _reports      = new Map<string, RenderReport>();
  private readonly _progressMap  = new Map<string, RenderProgress>();
  private readonly _pausedJobs   = new Set<string>();
  private readonly _cancelledIds = new Set<string>();
  private readonly _history: RenderingResponse[] = [];

  private readonly _frameRenderer:  IFrameRenderer;
  private readonly _encoder:        IEncoder;
  private readonly _exporter:       IExporter;
  private readonly _optimizer:      IRenderOptimizer;
  private readonly _qualityAnalyzer: IQualityAnalyzer;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    frameRenderer?:  IFrameRenderer,
    encoder?:        IEncoder,
    exporter?:       IExporter,
    optimizer?:      IRenderOptimizer,
    qualityAnalyzer?: IQualityAnalyzer
  ) {
    this._frameRenderer   = frameRenderer   || new DefaultFrameRenderer();
    this._encoder         = encoder         || new DefaultEncoder();
    this._exporter        = exporter        || new DefaultExporter();
    this._optimizer       = optimizer       || new DefaultRenderOptimizer();
    this._qualityAnalyzer = qualityAnalyzer || new DefaultQualityAnalyzer();
  }

  public get state(): RenderingState {
    return this._state;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    RenderValidator.validateStateTransition("engine", this._state, RenderingState.INITIALIZED);
    this._state = RenderingState.INITIALIZED;
    if (this.context?.logger) this.context.logger.info("RenderEngine initialized.");
  }

  public async start(): Promise<void> {
    if (
      this._state !== RenderingState.INITIALIZED &&
      this._state !== RenderingState.COMPLETED
    ) {
      throw new InvalidRenderingStateException("engine", "start", this._state);
    }
    if (this.context?.logger) this.context.logger.info("RenderEngine started.");
  }

  public async stop(): Promise<void> {
    if (this._state === RenderingState.CREATED) {
      throw new InvalidRenderingStateException("engine", "stop", this._state);
    }
    this._state = RenderingState.COMPLETED;
    if (this.context?.logger) this.context.logger.info("RenderEngine stopped.");
  }

  // ─── Pause / Resume / Cancel ──────────────────────────────────────────────

  public async pause(renderId: string): Promise<void> {
    if (!this._requests.has(renderId)) {
      throw new RenderingException(`No render job found with ID "${renderId}" to pause.`);
    }
    this._pausedJobs.add(renderId);
    await this._publishEvent("RenderPaused", renderId, { renderId });
  }

  public async resume(renderId: string): Promise<RenderingResponse> {
    const originalRequest = this._requests.get(renderId);
    if (!originalRequest) {
      throw new RenderingException(`No render job found with ID "${renderId}" to resume.`);
    }
    this._pausedJobs.delete(renderId);
    const resumedRequest: RenderingRequest = {
      ...originalRequest,
      id: `${renderId}-resumed`,
      state: RenderingState.INITIALIZED,
    };
    return this.render(resumedRequest);
  }

  public async cancel(renderId: string): Promise<void> {
    this._cancelledIds.add(renderId);
    const response = this._responses.get(renderId);
    if (response) (response as any).state = RenderingState.CANCELLED;
    await this._publishEvent("RenderCancelled", renderId, { renderId });
  }

  public async retry(renderId: string): Promise<RenderingResponse> {
    const originalRequest = this._requests.get(renderId);
    if (!originalRequest) {
      throw new RenderingException(`No render job found with ID "${renderId}" to retry.`);
    }
    this._cancelledIds.delete(renderId);
    const retryRequest: RenderingRequest = {
      ...originalRequest,
      id: `${renderId}-retry`,
      state: RenderingState.INITIALIZED,
    };
    return this.render(retryRequest);
  }

  // ─── Progress / Report / Snapshot ────────────────────────────────────────

  public getProgress(renderId: string): RenderProgress {
    return (
      this._progressMap.get(renderId) || {
        totalFrames:               0,
        renderedFrames:            0,
        encodedFrames:             0,
        percentage:                0,
        estimatedRemainingSeconds: 0,
        currentPhase:              RenderingState.CREATED,
        fps:                       0,
      }
    );
  }

  public getReport(renderId: string): RenderReport {
    const report = this._reports.get(renderId);
    if (!report) throw new RenderingException(`No report found for render "${renderId}".`);
    return report;
  }

  public getSnapshot(renderId: string): RenderSnapshot {
    const snap = this._snapshots.get(renderId);
    if (!snap) throw new RenderingException(`No snapshot found for render "${renderId}".`);
    return snap;
  }

  public getHistory(): RenderingResponse[] {
    return [...this._history];
  }

  // ─── Core Render ──────────────────────────────────────────────────────────

  public async render(request: RenderingRequest): Promise<RenderingResponse> {
    // Validate engine state
    if (
      this._state !== RenderingState.INITIALIZED &&
      this._state !== RenderingState.COMPLETED
    ) {
      throw new InvalidRenderingStateException(request.id, "render", this._state);
    }

    // Validate request
    RenderValidator.validateRequest(request);

    // Duplicate check
    if (this._requests.has(request.id)) {
      throw new DuplicateRenderException(request.id);
    }
    this._requests.set(request.id, request);

    // Memory cache check
    if (this.context?.memoryStore && request.options?.allowCached) {
      const cached = await this.context.memoryStore.get("render-memory", `render:${request.id}`);
      if (cached) return cached.value as RenderingResponse;
    }

    // Publish RenderingStarted
    await this._publishEvent("RenderingStarted", request.id, {
      requestId:   request.id,
      format:      request.format,
      resolution:  request.resolution,
      codec:       request.codec,
    });

    this._state = RenderingState.PREPARING;

    const warnings: string[] = [];
    const errors:   string[] = [];
    const startTime = Date.now();

    // ── Step 1: Retrieve Timeline ────────────────────────────────────────────

    let timeline: any = null;

    if (this.context?.compositionEngine) {
      try {
        const history: any[] = this.context.compositionEngine.getHistory();
        const compResp = history.find((r: any) => r.requestId === request.compositionId)
          || history[history.length - 1];
        if (compResp?.timeline) {
          timeline = compResp.timeline;
        }
      } catch (_) {
        warnings.push("Could not retrieve composition timeline — using stub timeline.");
      }
    }

    // Stub timeline for standalone / testing
    if (!timeline) {
      const fps = request.fps;
      const durationSeconds = 30;
      timeline = {
        durationSeconds,
        fps,
        tracks: [
          {
            id: "track-VIDEO",
            type: "VIDEO",
            clips: [
              {
                startTimeSeconds: 0,
                endTimeSeconds: durationSeconds,
                assetPath: "/assets/stub-vid.mp4",
                transitions: [{ id: "trans-1", type: "FADE", durationSeconds: 0.5 }],
                effects:     [{ id: "fx-1",    type: "ZOOM", intensity: 0.15 }],
              },
            ],
          },
          {
            id: "track-IMAGE",
            type: "IMAGE",
            clips: [
              {
                startTimeSeconds: 0,
                endTimeSeconds: 10,
                assetPath: "/assets/stub-img.png",
                transitions: [{ id: "trans-2", type: "CUT", durationSeconds: 0 }],
                effects:     [{ id: "fx-2",    type: "COLOR_GRADE", intensity: 0.3 }],
              },
            ],
          },
        ],
        subtitleTrack: {
          entries: [
            { startTimeSeconds: 0,  endTimeSeconds: 10, text: "Scene 1" },
            { startTimeSeconds: 10, endTimeSeconds: 20, text: "Scene 2" },
            { startTimeSeconds: 20, endTimeSeconds: 30, text: "Scene 3" },
          ],
        },
        audioTrack: {
          voiceClips: [{ id: "voice-1", startTimeSeconds: 0, endTimeSeconds: 30, volume: 1.0, assetPath: "/assets/voice.mp3" }],
          musicClips: [{ id: "music-1", startTimeSeconds: 0, endTimeSeconds: 30, volume: 0.2, assetPath: "/assets/music.wav" }],
          sfxClips:   [],
        },
      };
    }

    const timelineDuration: number = timeline.durationSeconds;
    const fps: number              = request.fps;

    // ── Step 2: Build Render Job ─────────────────────────────────────────────

    this._state = RenderingState.RENDERING;

    const totalFrames = Math.ceil(timelineDuration * fps);
    const frameIds    = Array.from({ length: totalFrames }, (_, i) => `${request.id}-f${i}`);

    const job: RenderJob = {
      id:              `job-${request.id}`,
      requestId:       request.id,
      state:           RenderingState.RENDERING,
      totalFrames,
      completedFrames: 0,
      failedFrames:    0,
      frameIds,
      startedAt:       new Date(),
    };

    RenderValidator.validateRenderJob(job);

    // ── Step 3: Optimise Encoding Settings ───────────────────────────────────

    const encodingSettings = this._optimizer.optimizeSettings(
      request.codec,
      request.quality,
      request.resolution,
      request.fps,
      timelineDuration
    );

    // Override with request-level overrides
    if (request.options?.videoBitrateKbps) {
      (encodingSettings as any).videoBitrateKbps = request.options.videoBitrateKbps;
    }
    if (request.options?.audioBitrateKbps) {
      (encodingSettings as any).audioBitrateKbps = request.options.audioBitrateKbps;
    }
    if (request.options?.hardwareAcceleration !== undefined) {
      (encodingSettings as any).hwAccel = request.options.hardwareAcceleration;
    }

    RenderValidator.validateEncodingSettings(encodingSettings);

    // ── Step 4: GPU/CPU Estimation ───────────────────────────────────────────

    const gpuMemMb        = this._optimizer.estimateGpuMemoryMb(request.resolution, request.fps);
    const encodingSecs    = this._optimizer.estimateEncodingSeconds(
      totalFrames,
      request.codec,
      request.resolution,
      encodingSettings.hwAccel
    );

    // ── Step 5: Render Frames ─────────────────────────────────────────────────

    const maxConcurrent = request.options?.maxConcurrentFrames || 8;

    // Track progress
    const progress: RenderProgress = {
      totalFrames,
      renderedFrames:            0,
      encodedFrames:             0,
      percentage:                0,
      estimatedRemainingSeconds: encodingSecs,
      currentPhase:              RenderingState.RENDERING,
      fps:                       0,
    };
    this._progressMap.set(request.id, { ...progress });

    const renderStart = Date.now();
    const frames      = await this._frameRenderer.renderFrames(job, timeline, maxConcurrent);

    job.completedFrames = frames.filter((f) => f.state === RenderingState.COMPLETED).length;
    job.failedFrames    = frames.filter((f) => f.state === RenderingState.FAILED).length;
    job.state           = RenderingState.ENCODING;

    const renderElapsedSecs = (Date.now() - renderStart) / 1000;
    const renderFps         = renderElapsedSecs > 0 ? totalFrames / renderElapsedSecs : totalFrames;

    progress.renderedFrames = job.completedFrames;
    progress.percentage     = Math.round((job.completedFrames / totalFrames) * 50); // 0–50% for rendering
    progress.fps            = parseFloat(renderFps.toFixed(2));
    progress.currentPhase   = RenderingState.ENCODING;
    this._progressMap.set(request.id, { ...progress });

    await this._publishEvent("FrameRendered", request.id, {
      totalFrames,
      completedFrames: job.completedFrames,
      failedFrames:    job.failedFrames,
    });

    if (job.failedFrames > 0) {
      warnings.push(`${job.failedFrames} frame(s) failed to render and were skipped.`);
    }

    // ── Step 6: Quality Analysis ──────────────────────────────────────────────

    const qualityWarnings = this._qualityAnalyzer.getWarnings(frames);
    warnings.push(...qualityWarnings);

    // ── Step 7: Audio Mix ─────────────────────────────────────────────────────

    const audioMixPath = `/render/audio/${request.id}-mix.aac`;
    let audioMixDuration = timelineDuration;

    const voiceClips = timeline.audioTrack?.voiceClips || [];
    const musicClips = timeline.audioTrack?.musicClips || [];
    if (voiceClips.length === 0 && musicClips.length === 0) {
      warnings.push("No audio clips found — rendering will have no audio.");
    }

    // Validate audio/video sync
    try {
      const audioDuration = voiceClips.reduce(
        (max: number, c: any) => Math.max(max, c.endTimeSeconds), 0
      ) || timelineDuration;
      RenderValidator.validateAudioVideoSync(audioDuration, timelineDuration, 1.0);
    } catch (e: any) {
      warnings.push(e.message);
    }

    // ── Step 8: Encoding ──────────────────────────────────────────────────────

    this._state = RenderingState.ENCODING;

    await this._publishEvent("EncodingStarted", request.id, {
      codec:   request.codec,
      quality: request.quality,
      frames:  totalFrames,
    });

    const tempOutputPath = `/render/output/${request.id}.tmp`;
    const encoded        = await this._encoder.encode(
      frames,
      encodingSettings,
      audioMixPath,
      tempOutputPath
    );

    progress.encodedFrames = totalFrames;
    progress.percentage    = 75;
    progress.currentPhase  = RenderingState.EXPORTING;
    this._progressMap.set(request.id, { ...progress });

    await this._publishEvent("EncodingCompleted", request.id, {
      outputPath:   encoded.outputPath,
      fileSizeBytes: encoded.fileSizeBytes,
    });

    // ── Step 9: Export ────────────────────────────────────────────────────────

    this._state = RenderingState.EXPORTING;

    const dim = RESOLUTION_DIMENSIONS[request.resolution];
    const profile: ExportProfile = {
      id:          `profile-${request.id}`,
      format:      request.format,
      resolution:  request.resolution,
      width:       request.options?.customWidth  || dim.width,
      height:      request.options?.customHeight || dim.height,
      fps:         request.fps,
      encoding:    encodingSettings,
      outputPath:  request.options?.outputPath || `/output/${request.id}`,
      burnSubtitles: request.options?.burnSubtitles ?? true,
      watermark:   request.options?.watermark,
    };

    RenderValidator.validateExportProfile(profile);

    await this._publishEvent("ExportStarted", request.id, {
      format: request.format,
      outputPath: profile.outputPath,
    });

    const exported = await this._exporter.export(encoded.outputPath, profile);

    progress.percentage  = 100;
    progress.currentPhase = RenderingState.COMPLETED;
    this._progressMap.set(request.id, { ...progress });

    await this._publishEvent("ExportCompleted", request.id, {
      outputPath:    exported.outputPath,
      fileSizeBytes: exported.fileSizeBytes,
    });

    // ── Step 10: Build Report & Statistics ───────────────────────────────────

    const totalWallClock = (Date.now() - startTime) / 1000;

    const statistics: RenderStatistics = {
      totalFrames,
      renderedFrames:           job.completedFrames,
      failedFrames:             job.failedFrames,
      retriedFrames:            0,
      totalTransitionsRendered: frames.reduce((n, f) => n + f.activeTransitions.length, 0),
      totalEffectsApplied:      frames.reduce((n, f) => n + f.activeEffects.length, 0),
      subtitleFrames:           frames.filter((f) => f.hasSubtitle).length,
      audioMixDurationSeconds:  parseFloat(audioMixDuration.toFixed(3)),
      encodingDurationSeconds:  parseFloat(encodingSecs.toFixed(3)),
      exportDurationSeconds:    parseFloat((totalWallClock * 0.1).toFixed(3)),
      totalWallClockSeconds:    parseFloat(totalWallClock.toFixed(3)),
    };

    const metrics: RenderMetrics = {
      resolution:        request.resolution,
      codec:             request.codec,
      quality:           request.quality,
      format:            request.format,
      fps:               request.fps,
      videoBitrateKbps:  encodingSettings.videoBitrateKbps,
      audioBitrateKbps:  encodingSettings.audioBitrateKbps,
      fileSizeBytes:     exported.fileSizeBytes,
      compressionRatio:  parseFloat((dim.width * dim.height * 4 * totalFrames / Math.max(exported.fileSizeBytes, 1)).toFixed(2)),
      estimatedGpuMinutes: parseFloat((gpuMemMb / 1024).toFixed(2)),
      estimatedCpuMinutes: parseFloat((encodingSecs / 60).toFixed(2)),
      peakMemoryMb:        gpuMemMb,
    };

    const report: RenderReport = {
      id:              `report-${request.id}`,
      timestamp:       new Date(),
      renderId:        request.id,
      totalFrames,
      succeededFrames: job.completedFrames,
      failedFrames:    job.failedFrames,
      retriedFrames:   0,
      outputPath:      exported.outputPath,
      fileSizeBytes:   exported.fileSizeBytes,
      durationSeconds: encoded.durationSeconds,
      codec:           request.codec,
      format:          request.format,
      quality:         request.quality,
      resolution:      request.resolution,
      warnings,
      errors,
    };

    // ── Step 11: Build Response ───────────────────────────────────────────────

    const response: RenderingResponse = {
      id:              `render-resp-${request.id}`,
      requestId:       request.id,
      state:           RenderingState.COMPLETED,
      outputPath:      exported.outputPath,
      format:          request.format,
      resolution:      request.resolution,
      codec:           request.codec,
      quality:         request.quality,
      fileSizeBytes:   exported.fileSizeBytes,
      durationSeconds: encoded.durationSeconds,
      fps:             request.fps,
      statistics,
      metrics,
      report,
      timestamp:       new Date(),
    };

    RenderValidator.validateResponse(response);

    // ── Step 12: Immutable Snapshot ───────────────────────────────────────────

    const snapshot: RenderSnapshot = deepFreeze({
      renderId:        request.id,
      state:           RenderingState.COMPLETED,
      outputPath:      exported.outputPath,
      format:          request.format,
      resolution:      request.resolution,
      codec:           request.codec,
      fileSizeBytes:   exported.fileSizeBytes,
      durationSeconds: encoded.durationSeconds,
      metrics,
      timestamp:       response.timestamp,
    });
    this._snapshots.set(request.id, snapshot);

    // ── Step 13: Memory Storage ───────────────────────────────────────────────

    if (this.context?.memoryStore) {
      await this.context.memoryStore.set(
        "render-memory",
        `render:${request.id}`,
        response,
        { renderId: request.id, outputPath: exported.outputPath }
      );
    }

    // ── Step 14: Decision Integration ─────────────────────────────────────────

    if (this.context?.registry) {
      try {
        const token = { name: "IDecisionEngine" } as any;
        if (this.context.registry.has(token)) {
          const decisionEngine = this.context.registry.resolve(token) as any;
          if (decisionEngine?.record) {
            await decisionEngine.record({
              renderId:          request.id,
              codec:             request.codec,
              quality:           request.quality,
              resolution:        request.resolution,
              format:            request.format,
              encodingSpeedFps:  progress.fps,
              fileSizeBytes:     exported.fileSizeBytes,
              failedFrames:      job.failedFrames,
              totalWallClock:    totalWallClock,
              outcome:           "SUCCESS",
            });
          }
        }
      } catch (_) { /* non-fatal */ }
    }

    // Store
    this._responses.set(request.id, response);
    this._reports.set(request.id, report);
    this._history.push(response);

    job.completedAt = new Date();
    job.state       = RenderingState.COMPLETED;

    this._state = RenderingState.COMPLETED;

    await this._publishEvent("ExportCompleted", request.id, {
      outputPath:    exported.outputPath,
      fileSizeBytes: exported.fileSizeBytes,
      format:        request.format,
      durationSecs:  encoded.durationSeconds,
    });

    return response;
  }

  // ─── Internal Event Publisher ─────────────────────────────────────────────

  private async _publishEvent(
    name: string,
    correlationId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (this.context?.eventBus) {
      try {
        await this.context.eventBus.publish({
          id:            `evt-${name.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`,
          name,
          timestamp:     new Date(),
          correlationId,
          source:        "RenderEngine",
          payload,
          metadata:      {},
        });
      } catch (_) { /* non-fatal */ }
    }
  }
}
