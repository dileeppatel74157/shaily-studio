import {
  CompositionRequest,
  CompositionResponse,
  Timeline,
  TimelineTrack,
  TimelineClip,
} from "./models";
import { CompositionState }                  from "./CompositionState";
import { VideoCompositionValidationException, DuplicateCompositionException } from "./types";

export class VideoCompositionValidator {

  // ─── Request Validation ───────────────────────────────────────────────────

  public static validateRequest(request: CompositionRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new VideoCompositionValidationException(
        "CompositionRequest must have a non-empty ID."
      );
    }
    if (!request.generationResponseId || request.generationResponseId.trim().length === 0) {
      throw new VideoCompositionValidationException(
        `CompositionRequest "${request.id}" must reference a non-empty generationResponseId.`
      );
    }
  }

  // ─── Timeline Validation ──────────────────────────────────────────────────

  public static validateTimeline(timeline: Timeline): void {
    if (!timeline.id || timeline.id.trim().length === 0) {
      throw new VideoCompositionValidationException("Timeline must have a non-empty ID.");
    }
    if (timeline.durationSeconds <= 0) {
      throw new VideoCompositionValidationException(
        `Timeline "${timeline.id}" must have a positive duration. Got: ${timeline.durationSeconds}s.`
      );
    }
    if (timeline.fps <= 0) {
      throw new VideoCompositionValidationException(
        `Timeline "${timeline.id}" must have a positive FPS. Got: ${timeline.fps}.`
      );
    }
    if (!timeline.tracks || timeline.tracks.length === 0) {
      throw new VideoCompositionValidationException(
        `Timeline "${timeline.id}" must contain at least one track.`
      );
    }

    // Check for duplicate track IDs
    const trackIds = timeline.tracks.map((t) => t.id);
    const uniqueTrackIds = new Set(trackIds);
    if (uniqueTrackIds.size !== trackIds.length) {
      throw new DuplicateCompositionException(`Duplicate track IDs detected in timeline "${timeline.id}".`);
    }

    for (const track of timeline.tracks) {
      VideoCompositionValidator.validateTrack(track, timeline.durationSeconds);
    }
  }

  // ─── Track Validation ─────────────────────────────────────────────────────

  public static validateTrack(track: TimelineTrack, timelineDuration: number): void {
    if (!track.id || track.id.trim().length === 0) {
      throw new VideoCompositionValidationException("TimelineTrack must have a non-empty ID.");
    }

    // Check for duplicate clip IDs
    const clipIds = track.clips.map((c) => c.id);
    const uniqueClipIds = new Set(clipIds);
    if (uniqueClipIds.size !== clipIds.length) {
      throw new DuplicateCompositionException(
        `Duplicate clip IDs detected in track "${track.id}".`
      );
    }

    for (const clip of track.clips) {
      VideoCompositionValidator.validateClip(clip, timelineDuration);
    }

    // Overlap detection
    VideoCompositionValidator.validateNoOverlaps(track);
  }

  // ─── Clip Validation ──────────────────────────────────────────────────────

  public static validateClip(clip: TimelineClip, timelineDuration: number): void {
    if (!clip.id || clip.id.trim().length === 0) {
      throw new VideoCompositionValidationException("TimelineClip must have a non-empty ID.");
    }
    if (clip.startTimeSeconds < 0) {
      throw new VideoCompositionValidationException(
        `Clip "${clip.id}" has an invalid startTime: ${clip.startTimeSeconds}. Must be >= 0.`
      );
    }
    if (clip.endTimeSeconds <= clip.startTimeSeconds) {
      throw new VideoCompositionValidationException(
        `Clip "${clip.id}" endTime (${clip.endTimeSeconds}) must be greater than startTime (${clip.startTimeSeconds}).`
      );
    }
    if (clip.endTimeSeconds > timelineDuration + 0.001) {
      throw new VideoCompositionValidationException(
        `Clip "${clip.id}" extends beyond timeline duration (${timelineDuration}s): endTime=${clip.endTimeSeconds}s.`
      );
    }
    if (clip.opacity < 0 || clip.opacity > 1) {
      throw new VideoCompositionValidationException(
        `Clip "${clip.id}" opacity must be between 0.0 and 1.0. Got: ${clip.opacity}.`
      );
    }
  }

  // ─── Overlap Validation ───────────────────────────────────────────────────

  public static validateNoOverlaps(track: TimelineTrack): void {
    const sorted = [...track.clips].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next    = sorted[i + 1];
      if (current.endTimeSeconds > next.startTimeSeconds + 0.001) {
        throw new VideoCompositionValidationException(
          `Overlap detected in track "${track.id}": clip "${current.id}" ` +
          `(ends ${current.endTimeSeconds}s) overlaps clip "${next.id}" ` +
          `(starts ${next.startTimeSeconds}s).`
        );
      }
    }
  }

  // ─── Response Validation ──────────────────────────────────────────────────

  public static validateResponse(response: CompositionResponse): void {
    if (!response.id || response.id.trim().length === 0) {
      throw new VideoCompositionValidationException("CompositionResponse must have a non-empty ID.");
    }
    VideoCompositionValidator.validateTimeline(response.timeline);
  }

  // ─── State Transition Validation ──────────────────────────────────────────

  private static readonly VALID_TRANSITIONS: Record<CompositionState, CompositionState[]> = {
    [CompositionState.CREATED]:     [CompositionState.INITIALIZED],
    [CompositionState.INITIALIZED]: [CompositionState.COMPOSING, CompositionState.FAILED],
    [CompositionState.COMPOSING]:   [CompositionState.SYNCING,   CompositionState.FAILED],
    [CompositionState.SYNCING]:     [CompositionState.READY,     CompositionState.FAILED],
    [CompositionState.READY]:       [CompositionState.RENDERING, CompositionState.FAILED],
    [CompositionState.RENDERING]:   [CompositionState.COMPLETED, CompositionState.FAILED],
    [CompositionState.COMPLETED]:   [],
    [CompositionState.FAILED]:      [CompositionState.INITIALIZED],
  };

  public static validateStateTransition(
    compositionId: string,
    from: CompositionState,
    to: CompositionState
  ): void {
    const allowed = VideoCompositionValidator.VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new VideoCompositionValidationException(
        `Invalid state transition for composition "${compositionId}": "${from}" → "${to}". ` +
        `Allowed: [${allowed.join(", ")}].`
      );
    }
  }

  // ─── Audio Sync Validation ────────────────────────────────────────────────

  public static validateAudioSync(
    voiceClipCount: number,
    musicClipCount: number
  ): void {
    if (voiceClipCount === 0 && musicClipCount === 0) {
      throw new VideoCompositionValidationException(
        "Timeline must contain at least one voice or music audio clip."
      );
    }
  }

  // ─── Subtitle Sync Validation ─────────────────────────────────────────────

  public static validateSubtitleSync(
    subtitleEntryCount: number,
    voiceClipCount: number
  ): void {
    if (subtitleEntryCount > 0 && voiceClipCount === 0) {
      throw new VideoCompositionValidationException(
        "Subtitle entries exist but no voice clips are present for synchronisation."
      );
    }
  }
}
