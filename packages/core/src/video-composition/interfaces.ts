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
  AudioTrack,
  OverlayTrack,
  CompositionMetrics,
  CompositionReport,
} from "./models";
import { TrackType }      from "./TrackType";
import { TransitionType } from "./TransitionType";
import { EffectType }     from "./EffectType";

// ─── Core Engine Interface ────────────────────────────────────────────────────

export interface ICompositionEngine {
  readonly state: string;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  compose(request: CompositionRequest): Promise<CompositionResponse>;
  getSnapshot(compositionId: string): CompositionSnapshot;
  getReport(compositionId: string): CompositionReport;
  getHistory(): CompositionResponse[];
}

// ─── Timeline Builder Interface ───────────────────────────────────────────────

export interface ITimelineBuilder {
  build(
    compositionId: string,
    resolution: string,
    fps: number,
    tracks: TimelineTrack[],
    subtitleTrack: SubtitleTrack,
    audioTrack: AudioTrack,
    overlayTrack: OverlayTrack
  ): Timeline;
}

// ─── Track Composer Interface ─────────────────────────────────────────────────

export interface ITrackComposer {
  composeTracks(
    assets: Array<{ id: string; assetType: string; filePath: string; duration?: number }>,
    productionTimeline?: Record<string, { start: number; end: number }>
  ): TimelineTrack[];
}

// ─── Transition Planner Interface ─────────────────────────────────────────────

export interface ITransitionPlanner {
  planTransitions(
    clips: TimelineClip[],
    defaultTransition: TransitionType
  ): ClipTransition[];
}

// ─── Effect Planner Interface ─────────────────────────────────────────────────

export interface IEffectPlanner {
  planEffects(
    clips: TimelineClip[],
    preferences?: Record<string, unknown>
  ): ClipEffect[];
}

// ─── Synchronization Engine Interface ────────────────────────────────────────

export interface ISynchronizationEngine {
  syncAudio(
    voiceAssets: Array<{ id: string; filePath: string; duration?: number }>,
    musicAssets: Array<{ id: string; filePath: string; duration?: number }>,
    sfxAssets:   Array<{ id: string; filePath: string; duration?: number }>,
    totalDuration: number
  ): AudioTrack;

  syncSubtitles(
    subtitleAssets: Array<{ id: string; filePath: string }>,
    voiceAssets:    Array<{ id: string; filePath: string; duration?: number }>
  ): SubtitleTrack;
}

// ─── Composition Metrics Builder Interface ────────────────────────────────────

export interface ICompositionMetricsBuilder {
  build(
    timeline: Timeline,
    report: CompositionReport
  ): CompositionMetrics;
}
