// ─── Enums ────────────────────────────────────────────────────────────────────
export { CompositionState } from "./CompositionState";
export { TrackType }        from "./TrackType";
export { TransitionType }   from "./TransitionType";
export { EffectType }       from "./EffectType";
export { TimelineState }    from "./TimelineState";

// ─── Models ───────────────────────────────────────────────────────────────────
export {
  CompositionRequest,
  CompositionResponse,
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
  CompositionSnapshot,
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export {
  ICompositionEngine,
  ITimelineBuilder,
  ITrackComposer,
  ITransitionPlanner,
  IEffectPlanner,
  ISynchronizationEngine,
  ICompositionMetricsBuilder,
} from "./interfaces";

// ─── Engine ───────────────────────────────────────────────────────────────────
export { VideoCompositionEngine } from "./VideoCompositionEngine";
export { VideoCompositionBuilder } from "./VideoCompositionBuilder";
export { VideoCompositionValidator } from "./VideoCompositionValidator";

// ─── Exception Types ──────────────────────────────────────────────────────────
export {
  VideoCompositionException,
  VideoCompositionValidationException,
  DuplicateCompositionException,
  InvalidCompositionLifecycleException,
  MissingAssetException,
} from "./types";
