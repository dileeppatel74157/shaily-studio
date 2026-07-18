import { CompositionState } from "./CompositionState";
import { TrackType }        from "./TrackType";
import { TransitionType }   from "./TransitionType";
import { EffectType }       from "./EffectType";
import { TimelineState }    from "./TimelineState";

// ─── Composition Request ──────────────────────────────────────────────────────

export interface CompositionRequest {
  id: string;
  generationResponseId: string;  // ID of the GenerationResponse to consume
  productionPlanId?: string;     // ID of the ProductionPlan for timing data
  scriptId?: string;             // ID of the Script for scene/narration order
  channelId?: string;            // ID of the Channel for branding identity
  state: CompositionState;
  timestamp: Date;
  options?: {
    correlationId?: string;
    allowCached?: boolean;
    targetResolution?: string;   // e.g. "1920x1080"
    targetFps?: number;          // e.g. 30
    defaultTransition?: TransitionType;
    enableSubtitles?: boolean;
    enableColorGrade?: boolean;
    brandingEnabled?: boolean;
  };
}

// ─── Composition Response ─────────────────────────────────────────────────────

export interface CompositionResponse {
  id: string;
  requestId: string;
  state: CompositionState;
  timeline: Timeline;
  metrics: CompositionMetrics;
  report: CompositionReport;
  timestamp: Date;
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export interface Timeline {
  id: string;
  state: TimelineState;
  durationSeconds: number;        // total timeline duration
  resolution: string;             // e.g. "1920x1080"
  fps: number;                    // frames per second
  tracks: TimelineTrack[];
  subtitleTrack: SubtitleTrack;
  audioTrack: AudioTrack;
  overlayTrack: OverlayTrack;
  createdAt: Date;
  exportedAt?: Date;
}

// ─── Timeline Track ───────────────────────────────────────────────────────────

export interface TimelineTrack {
  id: string;
  type: TrackType;
  label: string;
  clips: TimelineClip[];
  locked: boolean;
  muted: boolean;
  zIndex: number;                  // render layer order (higher = on top)
}

// ─── Timeline Clip ────────────────────────────────────────────────────────────

export interface TimelineClip {
  id: string;
  trackId: string;
  assetId: string;                 // references a GeneratedAsset.id
  assetPath: string;               // file path of the asset
  startTimeSeconds: number;        // position on timeline
  endTimeSeconds: number;          // end position on timeline
  durationSeconds: number;         // clip duration
  inPoint: number;                 // trim in-point within source asset (seconds)
  outPoint: number;                // trim out-point within source asset (seconds)
  transitions: ClipTransition[];
  effects: ClipEffect[];
  opacity: number;                 // 0.0–1.0
  metadata: Record<string, unknown>;
}

// ─── Clip Transition ──────────────────────────────────────────────────────────

export interface ClipTransition {
  id: string;
  type: TransitionType;
  durationSeconds: number;
  direction?: string;              // for SLIDE / WIPE: "left", "right", "up", "down"
  parameters: Record<string, unknown>;
}

// ─── Clip Effect ──────────────────────────────────────────────────────────────

export interface ClipEffect {
  id: string;
  type: EffectType;
  startTimeSeconds: number;        // effect start relative to clip start
  endTimeSeconds: number;          // effect end relative to clip start
  intensity: number;               // 0.0–1.0
  parameters: Record<string, unknown>;
}

// ─── Subtitle Track ───────────────────────────────────────────────────────────

export interface SubtitleTrack {
  id: string;
  entries: SubtitleEntry[];
}

export interface SubtitleEntry {
  id: string;
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  style?: Record<string, unknown>;  // font, color, position overrides
}

// ─── Audio Track ──────────────────────────────────────────────────────────────

export interface AudioTrack {
  id: string;
  voiceClips: AudioClip[];
  musicClips: AudioClip[];
  sfxClips: AudioClip[];
}

export interface AudioClip {
  id: string;
  assetId: string;
  assetPath: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  volume: number;           // 0.0–1.0
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
}

// ─── Overlay Track ────────────────────────────────────────────────────────────

export interface OverlayTrack {
  id: string;
  overlays: OverlayClip[];
}

export interface OverlayClip {
  id: string;
  assetId: string;
  assetPath: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  x: number;               // horizontal position (percent 0–100)
  y: number;               // vertical position (percent 0–100)
  width: number;           // width as percent of frame
  height: number;          // height as percent of frame
  opacity: number;         // 0.0–1.0
}

// ─── Composition Metrics ──────────────────────────────────────────────────────

export interface CompositionMetrics {
  totalClips: number;
  totalTracks: number;
  totalSubtitles: number;
  totalTransitions: number;
  totalEffects: number;
  durationSeconds: number;
  estimatedFileSizeMb: number;
  trackBreakdown: Record<string, number>;   // trackType → clip count
  warningCount: number;
}

// ─── Composition Report ───────────────────────────────────────────────────────

export interface CompositionReport {
  id: string;
  timestamp: Date;
  compositionId: string;
  totalAssets: number;
  assembledClips: number;
  syncedSubtitles: number;
  syncedAudioTracks: number;
  transitionsApplied: number;
  effectsApplied: number;
  optimizationsApplied: number;
  warnings: string[];
  errors: string[];
}

// ─── Composition Snapshot (Immutable) ─────────────────────────────────────────

export interface CompositionSnapshot {
  readonly compositionId: string;
  readonly state: CompositionState;
  readonly timeline: Readonly<Timeline>;
  readonly metrics: Readonly<CompositionMetrics>;
  readonly timestamp: Date;
}
