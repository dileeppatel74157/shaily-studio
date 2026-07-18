import {
  ICompositionEngine,
  ITimelineBuilder,
  ITrackComposer,
  ITransitionPlanner,
  IEffectPlanner,
  ISynchronizationEngine,
  ICompositionMetricsBuilder,
} from "./interfaces";
import { CompositionState }  from "./CompositionState";
import { TrackType }         from "./TrackType";
import { TransitionType }    from "./TransitionType";
import { EffectType }        from "./EffectType";
import { TimelineState }     from "./TimelineState";
import {
  CompositionRequest,
  CompositionResponse,
  CompositionSnapshot,
  Timeline,
  TimelineTrack,
  TimelineClip,
  ClipTransition,
  ClipEffect,
  SubtitleTrack,
  SubtitleEntry,
  AudioTrack,
  AudioClip,
  OverlayTrack,
  OverlayClip,
  CompositionMetrics,
  CompositionReport,
} from "./models";
import { VideoCompositionValidator }   from "./VideoCompositionValidator";
import {
  VideoCompositionException,
  VideoCompositionValidationException,
  DuplicateCompositionException,
  InvalidCompositionLifecycleException,
  deepFreeze,
} from "./types";

// ─── Default Timeline Builder ─────────────────────────────────────────────────

class DefaultTimelineBuilder implements ITimelineBuilder {
  public build(
    compositionId: string,
    resolution: string,
    fps: number,
    tracks: TimelineTrack[],
    subtitleTrack: SubtitleTrack,
    audioTrack: AudioTrack,
    overlayTrack: OverlayTrack
  ): Timeline {
    const maxEnd = tracks
      .flatMap((t) => t.clips)
      .reduce((max, c) => Math.max(max, c.endTimeSeconds), 0);

    const voiceEnd = audioTrack.voiceClips.reduce((m, c) => Math.max(m, c.endTimeSeconds), 0);
    const musicEnd = audioTrack.musicClips.reduce((m, c) => Math.max(m, c.endTimeSeconds), 0);
    const totalDuration = Math.max(maxEnd, voiceEnd, musicEnd, 1);

    return {
      id: `timeline-${compositionId}`,
      state: TimelineState.DRAFT,
      durationSeconds: parseFloat(totalDuration.toFixed(3)),
      resolution,
      fps,
      tracks,
      subtitleTrack,
      audioTrack,
      overlayTrack,
      createdAt: new Date(),
    };
  }
}

// ─── Default Track Composer ───────────────────────────────────────────────────

class DefaultTrackComposer implements ITrackComposer {
  public composeTracks(
    assets: Array<{ id: string; assetType: string; filePath: string; duration?: number }>,
    productionTimeline?: Record<string, { start: number; end: number }>
  ): TimelineTrack[] {
    const trackMap = new Map<TrackType, TimelineClip[]>();
    const trackTypeOrder: Record<string, TrackType> = {
      VIDEO:      TrackType.VIDEO,
      IMAGE:      TrackType.IMAGE,
      BACKGROUND: TrackType.IMAGE,
      THUMBNAIL:  TrackType.IMAGE,
    };

    let cursor = 0;

    for (const asset of assets) {
      const mapped = trackTypeOrder[asset.assetType];
      if (!mapped) continue; // audio/subtitle handled separately

      const timing = productionTimeline?.[asset.id];
      const start  = timing ? timing.start : cursor;
      const end    = timing ? timing.end   : start + (asset.duration || 5);
      const dur    = parseFloat((end - start).toFixed(3));

      const clip: TimelineClip = {
        id:                 `clip-${asset.id}`,
        trackId:            `track-${mapped}`,
        assetId:            asset.id,
        assetPath:          asset.filePath,
        startTimeSeconds:   start,
        endTimeSeconds:     end,
        durationSeconds:    dur,
        inPoint:            0,
        outPoint:           dur,
        transitions:        [],
        effects:            [],
        opacity:            1.0,
        metadata:           {},
      };

      if (!trackMap.has(mapped)) trackMap.set(mapped, []);
      trackMap.get(mapped)!.push(clip);
      cursor = end;
    }

    const tracks: TimelineTrack[] = [];
    let zIndex = 0;

    const typeOrder = [TrackType.VIDEO, TrackType.IMAGE];
    for (const type of typeOrder) {
      if (trackMap.has(type)) {
        tracks.push({
          id:     `track-${type}`,
          type,
          label:  type.charAt(0) + type.slice(1).toLowerCase(),
          clips:  trackMap.get(type)!,
          locked: false,
          muted:  false,
          zIndex: zIndex++,
        });
      }
    }
    return tracks;
  }
}

// ─── Default Transition Planner ───────────────────────────────────────────────

class DefaultTransitionPlanner implements ITransitionPlanner {
  public planTransitions(clips: TimelineClip[], defaultTransition: TransitionType): ClipTransition[] {
    const allTransitions: ClipTransition[] = [];
    for (const clip of clips) {
      const transition: ClipTransition = {
        id:              `trans-${clip.id}`,
        type:            defaultTransition,
        durationSeconds: defaultTransition === TransitionType.CUT ? 0 : 0.5,
        parameters:      {},
      };
      clip.transitions.push(transition);
      allTransitions.push(transition);
    }
    return allTransitions;
  }
}

// ─── Default Effect Planner ───────────────────────────────────────────────────

class DefaultEffectPlanner implements IEffectPlanner {
  public planEffects(
    clips: TimelineClip[],
    _preferences?: Record<string, unknown>
  ): ClipEffect[] {
    const allEffects: ClipEffect[] = [];
    for (const clip of clips) {
      // Apply a subtle zoom (Ken Burns) to every visual clip
      const zoomEffect: ClipEffect = {
        id:               `fx-zoom-${clip.id}`,
        type:             EffectType.ZOOM,
        startTimeSeconds: 0,
        endTimeSeconds:   clip.durationSeconds,
        intensity:        0.15,
        parameters:       { direction: "in", from: 1.0, to: 1.15 },
      };
      clip.effects.push(zoomEffect);
      allEffects.push(zoomEffect);

      // Apply color grading to every visual clip
      const gradeEffect: ClipEffect = {
        id:               `fx-grade-${clip.id}`,
        type:             EffectType.COLOR_GRADE,
        startTimeSeconds: 0,
        endTimeSeconds:   clip.durationSeconds,
        intensity:        0.3,
        parameters:       { lut: "cinematic_warm", saturation: 1.1, contrast: 1.05 },
      };
      clip.effects.push(gradeEffect);
      allEffects.push(gradeEffect);
    }
    return allEffects;
  }
}

// ─── Default Synchronization Engine ──────────────────────────────────────────

class DefaultSynchronizationEngine implements ISynchronizationEngine {
  public syncAudio(
    voiceAssets: Array<{ id: string; filePath: string; duration?: number }>,
    musicAssets: Array<{ id: string; filePath: string; duration?: number }>,
    sfxAssets:   Array<{ id: string; filePath: string; duration?: number }>,
    totalDuration: number
  ): AudioTrack {
    let cursor = 0;
    const voiceClips: AudioClip[] = voiceAssets.map((a) => {
      const dur = a.duration || 10;
      const clip: AudioClip = {
        id:               `audioclip-voice-${a.id}`,
        assetId:          a.id,
        assetPath:        a.filePath,
        startTimeSeconds: cursor,
        endTimeSeconds:   cursor + dur,
        volume:           1.0,
        fadeInSeconds:    0.2,
        fadeOutSeconds:   0.2,
      };
      cursor += dur;
      return clip;
    });

    const musicClips: AudioClip[] = musicAssets.map((a, idx) => {
      const dur = Math.min(a.duration || totalDuration, totalDuration);
      return {
        id:               `audioclip-music-${a.id}`,
        assetId:          a.id,
        assetPath:        a.filePath,
        startTimeSeconds: idx === 0 ? 0 : totalDuration - dur,
        endTimeSeconds:   Math.min(dur, totalDuration),
        volume:           0.2,
        fadeInSeconds:    1.0,
        fadeOutSeconds:   1.5,
      };
    });

    let sfxCursor = 0;
    const sfxClips: AudioClip[] = sfxAssets.map((a) => {
      const dur = a.duration || 2;
      const clip: AudioClip = {
        id:               `audioclip-sfx-${a.id}`,
        assetId:          a.id,
        assetPath:        a.filePath,
        startTimeSeconds: sfxCursor,
        endTimeSeconds:   sfxCursor + dur,
        volume:           0.6,
      };
      sfxCursor += dur + 1;
      return clip;
    });

    return {
      id:          `audio-track-${Date.now()}`,
      voiceClips,
      musicClips,
      sfxClips,
    };
  }

  public syncSubtitles(
    subtitleAssets: Array<{ id: string; filePath: string }>,
    voiceAssets:    Array<{ id: string; filePath: string; duration?: number }>
  ): SubtitleTrack {
    const entries: SubtitleEntry[] = [];
    let cursor = 0;

    for (let i = 0; i < subtitleAssets.length; i++) {
      const voice  = voiceAssets[i];
      const dur    = voice?.duration || 5;
      const entry: SubtitleEntry = {
        id:               `sub-entry-${subtitleAssets[i].id}`,
        text:             `[Subtitle for scene ${i + 1}]`,
        startTimeSeconds: cursor,
        endTimeSeconds:   cursor + dur,
      };
      entries.push(entry);
      cursor += dur;
    }

    return { id: `subtitle-track-${Date.now()}`, entries };
  }
}

// ─── Default Composition Metrics Builder ─────────────────────────────────────

class DefaultCompositionMetricsBuilder implements ICompositionMetricsBuilder {
  public build(timeline: Timeline, report: CompositionReport): CompositionMetrics {
    const allClips = timeline.tracks.flatMap((t) => t.clips);
    const trackBreakdown: Record<string, number> = {};
    for (const track of timeline.tracks) {
      trackBreakdown[track.type] = track.clips.length;
    }

    return {
      totalClips:        allClips.length,
      totalTracks:       timeline.tracks.length,
      totalSubtitles:    timeline.subtitleTrack.entries.length,
      totalTransitions:  allClips.reduce((n, c) => n + c.transitions.length, 0),
      totalEffects:      allClips.reduce((n, c) => n + c.effects.length, 0),
      durationSeconds:   timeline.durationSeconds,
      estimatedFileSizeMb: parseFloat((timeline.durationSeconds * 5).toFixed(2)),
      trackBreakdown,
      warningCount:      report.warnings.length,
    };
  }
}

// ─── Video Composition Engine ─────────────────────────────────────────────────

export class VideoCompositionEngine implements ICompositionEngine {
  private _state = CompositionState.CREATED;
  private readonly _requests   = new Map<string, CompositionRequest>();
  private readonly _responses  = new Map<string, CompositionResponse>();
  private readonly _snapshots  = new Map<string, CompositionSnapshot>();
  private readonly _reports    = new Map<string, CompositionReport>();
  private readonly _history:   CompositionResponse[] = [];

  private readonly _timelineBuilder:   ITimelineBuilder;
  private readonly _trackComposer:     ITrackComposer;
  private readonly _transitionPlanner: ITransitionPlanner;
  private readonly _effectPlanner:     IEffectPlanner;
  private readonly _syncEngine:        ISynchronizationEngine;
  private readonly _metricsBuilder:    ICompositionMetricsBuilder;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    timelineBuilder?:   ITimelineBuilder,
    trackComposer?:     ITrackComposer,
    transitionPlanner?: ITransitionPlanner,
    effectPlanner?:     IEffectPlanner,
    syncEngine?:        ISynchronizationEngine,
    metricsBuilder?:    ICompositionMetricsBuilder
  ) {
    this._timelineBuilder   = timelineBuilder   || new DefaultTimelineBuilder();
    this._trackComposer     = trackComposer     || new DefaultTrackComposer();
    this._transitionPlanner = transitionPlanner || new DefaultTransitionPlanner();
    this._effectPlanner     = effectPlanner     || new DefaultEffectPlanner();
    this._syncEngine        = syncEngine        || new DefaultSynchronizationEngine();
    this._metricsBuilder    = metricsBuilder    || new DefaultCompositionMetricsBuilder();
  }

  public get state(): CompositionState {
    return this._state;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    VideoCompositionValidator.validateStateTransition(
      "engine", this._state, CompositionState.INITIALIZED
    );
    this._state = CompositionState.INITIALIZED;
    if (this.context?.logger) {
      this.context.logger.info("VideoCompositionEngine initialized.");
    }
  }

  public async start(): Promise<void> {
    if (
      this._state !== CompositionState.INITIALIZED &&
      this._state !== CompositionState.READY
    ) {
      throw new InvalidCompositionLifecycleException("engine", "start", this._state);
    }
    if (this.context?.logger) {
      this.context.logger.info("VideoCompositionEngine started.");
    }
  }

  public async stop(): Promise<void> {
    if (this._state === CompositionState.CREATED) {
      throw new InvalidCompositionLifecycleException("engine", "stop", this._state);
    }
    this._state = CompositionState.COMPLETED;
    if (this.context?.logger) {
      this.context.logger.info("VideoCompositionEngine stopped.");
    }
  }

  public getSnapshot(compositionId: string): CompositionSnapshot {
    const snap = this._snapshots.get(compositionId);
    if (!snap) {
      throw new VideoCompositionException(`No snapshot found for composition "${compositionId}".`);
    }
    return snap;
  }

  public getReport(compositionId: string): CompositionReport {
    const report = this._reports.get(compositionId);
    if (!report) {
      throw new VideoCompositionException(`No report found for composition "${compositionId}".`);
    }
    return report;
  }

  public getHistory(): CompositionResponse[] {
    return [...this._history];
  }

  // ─── Core Compose ──────────────────────────────────────────────────────────

  public async compose(request: CompositionRequest): Promise<CompositionResponse> {
    // Validate engine state
    if (
      this._state !== CompositionState.INITIALIZED &&
      this._state !== CompositionState.READY
    ) {
      throw new InvalidCompositionLifecycleException(request.id, "compose", this._state);
    }

    // Validate request
    VideoCompositionValidator.validateRequest(request);

    // Duplicate check
    if (this._requests.has(request.id)) {
      throw new DuplicateCompositionException(request.id);
    }
    this._requests.set(request.id, request);

    // Memory cache check
    if (this.context?.memoryStore && request.options?.allowCached) {
      const cached = await this.context.memoryStore.get(
        "composition-memory",
        `comp:${request.id}`
      );
      if (cached) return cached.value as CompositionResponse;
    }

    // Publish CompositionStarted
    await this._publishEvent("CompositionStarted", request.id, { requestId: request.id });

    // Transition: COMPOSING
    this._state = CompositionState.COMPOSING;

    const warnings: string[] = [];
    const errors: string[]   = [];

    // ── Step 1: Consume Generated Assets ──────────────────────────────────────

    // Pull assets from GenerationEngine if available, otherwise use stubs
    let generatedAssets: Array<{
      id: string;
      assetType: string;
      filePath: string;
      duration?: number;
    }> = [];

    if (this.context?.generationEngine) {
      try {
        const history: any[] = this.context.generationEngine.getHistory();
        const genResponse = history.find((r: any) => r.requestId === request.generationResponseId)
          || history[history.length - 1];
        if (genResponse?.assets) {
          generatedAssets = genResponse.assets.map((a: any) => ({
            id:        a.id,
            assetType: a.assetType,
            filePath:  a.filePath,
            duration:  a.duration,
          }));
        }
      } catch (_) {
        warnings.push("Could not retrieve generation history — using stub assets.");
      }
    }

    if (generatedAssets.length === 0) {
      // Stub assets for testing / standalone mode
      generatedAssets = [
        { id: "asset-vid-1",  assetType: "VIDEO",    filePath: "/assets/vid-1.mp4",    duration: 10 },
        { id: "asset-img-1",  assetType: "IMAGE",    filePath: "/assets/img-1.png",    duration: 5  },
        { id: "asset-img-2",  assetType: "IMAGE",    filePath: "/assets/img-2.png",    duration: 5  },
        { id: "asset-bg-1",   assetType: "BACKGROUND",filePath:"/assets/bg-1.png",    duration: 30 },
        { id: "asset-voice-1",assetType: "VOICE",    filePath: "/assets/voice-1.mp3",  duration: 10 },
        { id: "asset-voice-2",assetType: "VOICE",    filePath: "/assets/voice-2.mp3",  duration: 10 },
        { id: "asset-music-1",assetType: "MUSIC",    filePath: "/assets/music-1.wav",  duration: 30 },
        { id: "asset-sfx-1",  assetType: "SFX",      filePath: "/assets/sfx-1.wav",    duration: 2  },
        { id: "asset-sub-1",  assetType: "SUBTITLE", filePath: "/assets/sub-1.srt"               },
        { id: "asset-sub-2",  assetType: "SUBTITLE", filePath: "/assets/sub-2.srt"               },
      ];
    }

    // ── Step 2: Retrieve Production Timing ────────────────────────────────────

    let productionTimeline: Record<string, { start: number; end: number }> | undefined;
    if (this.context?.productionEngine && request.productionPlanId) {
      try {
        const planHistory: any[] = this.context.productionEngine.getHistory?.() || [];
        const planResponse = planHistory.find(
          (r: any) => r.productionId === request.productionPlanId
        );
        if (planResponse?.timeline?.assets) {
          productionTimeline = planResponse.timeline.assets;
        }
      } catch (_) {
        warnings.push("Could not retrieve production plan timeline — using auto-timing.");
      }
    }

    // ── Step 3: Compose Visual Tracks ─────────────────────────────────────────

    const visualAssets = generatedAssets.filter(
      (a) => ["VIDEO", "IMAGE", "BACKGROUND", "THUMBNAIL"].includes(a.assetType)
    );
    const voiceAssets  = generatedAssets.filter((a) => a.assetType === "VOICE");
    const musicAssets  = generatedAssets.filter((a) => a.assetType === "MUSIC");
    const sfxAssets    = generatedAssets.filter((a) => a.assetType === "SFX");
    const subtitleAssets = generatedAssets.filter((a) => a.assetType === "SUBTITLE");

    const tracks = this._trackComposer.composeTracks(visualAssets, productionTimeline);

    await this._publishEvent("TrackGenerated", request.id, {
      trackCount: tracks.length,
    });

    // ── Step 4: Plan Transitions ──────────────────────────────────────────────

    const defaultTransition = request.options?.defaultTransition ?? TransitionType.FADE;
    const allClips = tracks.flatMap((t) => t.clips);
    const transitions = this._transitionPlanner.planTransitions(allClips, defaultTransition);

    // ── Step 5: Plan Effects ──────────────────────────────────────────────────

    const effects = this._effectPlanner.planEffects(allClips);

    // ── Step 6: Synchronise Audio ─────────────────────────────────────────────

    this._state = CompositionState.SYNCING;

    // Compute total visual duration to anchor music
    const visualDuration = allClips.reduce((m, c) => Math.max(m, c.endTimeSeconds), 0) || 30;

    const audioTrack = this._syncEngine.syncAudio(
      voiceAssets,
      musicAssets,
      sfxAssets,
      visualDuration
    );

    await this._publishEvent("SyncCompleted", request.id, { type: "audio" });

    // Validate audio synchronisation
    try {
      VideoCompositionValidator.validateAudioSync(
        audioTrack.voiceClips.length,
        audioTrack.musicClips.length
      );
    } catch (e: any) {
      warnings.push(e.message);
    }

    // ── Step 7: Synchronise Subtitles ─────────────────────────────────────────

    const subtitleTrack = this._syncEngine.syncSubtitles(subtitleAssets, voiceAssets);

    await this._publishEvent("SyncCompleted", request.id, { type: "subtitles" });

    // ── Step 8: Build Overlay Track ───────────────────────────────────────────

    const overlayAssets = generatedAssets.filter(
      (a) => a.assetType === "THUMBNAIL" || a.assetType === "IMAGE"
    );
    const overlays: OverlayClip[] = overlayAssets.slice(0, 1).map((a) => ({
      id:               `overlay-${a.id}`,
      assetId:          a.id,
      assetPath:        a.filePath,
      startTimeSeconds: 0,
      endTimeSeconds:   3,
      x:                70,
      y:                80,
      width:            25,
      height:           10,
      opacity:          0.85,
    }));
    const overlayTrack: OverlayTrack = { id: `overlay-track-${request.id}`, overlays };

    // ── Step 9: Build Timeline ────────────────────────────────────────────────

    const resolution = request.options?.targetResolution || "1920x1080";
    const fps        = request.options?.targetFps        || 30;

    const timeline = this._timelineBuilder.build(
      request.id,
      resolution,
      fps,
      tracks,
      subtitleTrack,
      audioTrack,
      overlayTrack
    );

    await this._publishEvent("TimelineCreated", request.id, {
      durationSeconds: timeline.durationSeconds,
    });

    // ── Step 10: Timeline Optimisation ───────────────────────────────────────

    let optimizationsApplied = 0;
    optimizationsApplied += this._removeGaps(timeline);
    optimizationsApplied += this._alignTransitions(timeline);

    await this._publishEvent("TimelineOptimized", request.id, {
      optimizations: optimizationsApplied,
    });

    // ── Step 11: Validate Timeline ────────────────────────────────────────────

    try {
      VideoCompositionValidator.validateTimeline(timeline);
    } catch (e: any) {
      errors.push(e.message);
    }

    // ── Step 12: Build Report ─────────────────────────────────────────────────

    const report: CompositionReport = {
      id:                  `report-${request.id}`,
      timestamp:           new Date(),
      compositionId:       request.id,
      totalAssets:         generatedAssets.length,
      assembledClips:      allClips.length,
      syncedSubtitles:     subtitleTrack.entries.length,
      syncedAudioTracks:   audioTrack.voiceClips.length + audioTrack.musicClips.length,
      transitionsApplied:  transitions.length,
      effectsApplied:      effects.length,
      optimizationsApplied,
      warnings,
      errors,
    };

    // ── Step 13: Build Metrics ────────────────────────────────────────────────

    const metrics = this._metricsBuilder.build(timeline, report);

    // ── Step 14: Validate Response ────────────────────────────────────────────

    this._state = CompositionState.READY;

    // Mark timeline as READY
    (timeline as any).state = TimelineState.READY;

    const response: CompositionResponse = {
      id:        `comp-response-${request.id}`,
      requestId: request.id,
      state:     CompositionState.COMPLETED,
      timeline,
      metrics,
      report,
      timestamp: new Date(),
    };

    VideoCompositionValidator.validateResponse(response);

    // ── Step 15: Immutable Snapshot ───────────────────────────────────────────

    const snapshot: CompositionSnapshot = deepFreeze({
      compositionId: request.id,
      state:         CompositionState.COMPLETED,
      timeline,
      metrics,
      timestamp:     response.timestamp,
    });

    this._snapshots.set(request.id, snapshot);

    // ── Step 16: Memory Storage ───────────────────────────────────────────────

    if (this.context?.memoryStore) {
      await this.context.memoryStore.set(
        "composition-memory",
        `comp:${request.id}`,
        response,
        { compositionId: request.id, durationSeconds: timeline.durationSeconds }
      );
    }

    // ── Step 17: Decision Integration (future transitions/effects selection) ──

    if (this.context?.registry) {
      try {
        const token = { name: "IDecisionEngine" } as any;
        if (this.context.registry.has(token)) {
          // Record that the composition succeeded — let the decision engine learn
          const decisionEngine = this.context.registry.resolve(token) as any;
          if (decisionEngine?.record) {
            await decisionEngine.record({
              compositionId: request.id,
              transition:    defaultTransition,
              effects:       effects.map((e) => e.type),
              outcome:       "SUCCESS",
            });
          }
        }
      } catch (_) { /* non-fatal */ }
    }

    // Store
    this._responses.set(request.id, response);
    this._reports.set(request.id, report);
    this._history.push(response);

    await this._publishEvent("CompositionCompleted", request.id, {
      durationSeconds: timeline.durationSeconds,
      totalClips:      allClips.length,
    });

    this._state = CompositionState.READY; // restore for next request
    return response;
  }

  // ─── Timeline Optimisation: Remove Gaps ───────────────────────────────────

  private _removeGaps(timeline: Timeline): number {
    let optimizations = 0;
    for (const track of timeline.tracks) {
      const sorted = track.clips.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
      for (let i = 1; i < sorted.length; i++) {
        const prev    = sorted[i - 1];
        const current = sorted[i];
        const gap     = current.startTimeSeconds - prev.endTimeSeconds;
        if (gap > 0.05) {
          // Shift current clip to close the gap
          const delta           = current.startTimeSeconds - prev.endTimeSeconds;
          (current as any).startTimeSeconds -= delta;
          (current as any).endTimeSeconds   -= delta;
          optimizations++;
        }
      }
    }
    return optimizations;
  }

  // ─── Timeline Optimisation: Align Transitions ─────────────────────────────

  private _alignTransitions(timeline: Timeline): number {
    let optimizations = 0;
    for (const track of timeline.tracks) {
      for (const clip of track.clips) {
        for (const trans of clip.transitions) {
          // Ensure transition duration does not exceed clip duration
          if (trans.durationSeconds > clip.durationSeconds) {
            (trans as any).durationSeconds = clip.durationSeconds * 0.5;
            optimizations++;
          }
        }
      }
    }
    return optimizations;
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
          source:        "VideoCompositionEngine",
          payload,
          metadata:      {},
        });
      } catch (_) {
        // Non-fatal — event bus errors must not abort composition
      }
    }
  }
}
