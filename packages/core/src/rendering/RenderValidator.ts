import {
  RenderingRequest,
  RenderingResponse,
  RenderJob,
  RenderFrame,
  EncodingSettings,
  ExportProfile,
} from "./models";
import { RenderingState } from "./RenderingState";
import { ExportFormat }   from "./ExportFormat";
import { CodecType }      from "./CodecType";
import { Resolution }     from "./Resolution";
import { QualityPreset }  from "./QualityPreset";
import {
  RenderingValidationException,
  DuplicateRenderException,
} from "./types";

export class RenderValidator {

  // ─── Request Validation ───────────────────────────────────────────────────

  public static validateRequest(request: RenderingRequest): void {
    if (!request.id || request.id.trim().length === 0) {
      throw new RenderingValidationException("RenderingRequest must have a non-empty ID.");
    }
    if (!request.compositionId || request.compositionId.trim().length === 0) {
      throw new RenderingValidationException(
        `RenderingRequest "${request.id}" must reference a non-empty compositionId.`
      );
    }
    if (!Object.values(ExportFormat).includes(request.format)) {
      throw new RenderingValidationException(
        `RenderingRequest "${request.id}" has invalid ExportFormat: "${request.format}".`
      );
    }
    if (!Object.values(Resolution).includes(request.resolution)) {
      throw new RenderingValidationException(
        `RenderingRequest "${request.id}" has invalid Resolution: "${request.resolution}".`
      );
    }
    if (!Object.values(CodecType).includes(request.codec)) {
      throw new RenderingValidationException(
        `RenderingRequest "${request.id}" has invalid CodecType: "${request.codec}".`
      );
    }
    if (!Object.values(QualityPreset).includes(request.quality)) {
      throw new RenderingValidationException(
        `RenderingRequest "${request.id}" has invalid QualityPreset: "${request.quality}".`
      );
    }
    if (request.fps <= 0 || request.fps > 240) {
      throw new RenderingValidationException(
        `RenderingRequest "${request.id}" has invalid FPS: ${request.fps}. Must be 1–240.`
      );
    }
    if (request.options?.audioBitrateKbps !== undefined && request.options.audioBitrateKbps <= 0) {
      throw new RenderingValidationException(
        `RenderingRequest "${request.id}" audioBitrateKbps must be positive.`
      );
    }
    if (request.options?.videoBitrateKbps !== undefined && request.options.videoBitrateKbps <= 0) {
      throw new RenderingValidationException(
        `RenderingRequest "${request.id}" videoBitrateKbps must be positive.`
      );
    }
  }

  // ─── Render Job Validation ────────────────────────────────────────────────

  public static validateRenderJob(job: RenderJob): void {
    if (!job.id || job.id.trim().length === 0) {
      throw new RenderingValidationException("RenderJob must have a non-empty ID.");
    }
    if (job.totalFrames <= 0) {
      throw new RenderingValidationException(
        `RenderJob "${job.id}" must have at least one frame. Got: ${job.totalFrames}.`
      );
    }
    if (job.frameIds.length !== job.totalFrames) {
      throw new RenderingValidationException(
        `RenderJob "${job.id}" frameIds count (${job.frameIds.length}) must match totalFrames (${job.totalFrames}).`
      );
    }

    // Duplicate frame ID check
    const uniqueIds = new Set(job.frameIds);
    if (uniqueIds.size !== job.frameIds.length) {
      throw new DuplicateRenderException(
        `Duplicate frame IDs detected in RenderJob "${job.id}".`
      );
    }
  }

  // ─── Frame Validation ─────────────────────────────────────────────────────

  public static validateFrame(frame: RenderFrame, totalFrames: number): void {
    if (!frame.id || frame.id.trim().length === 0) {
      throw new RenderingValidationException("RenderFrame must have a non-empty ID.");
    }
    if (frame.index < 0 || frame.index >= totalFrames) {
      throw new RenderingValidationException(
        `RenderFrame "${frame.id}" index ${frame.index} is out of range [0, ${totalFrames - 1}].`
      );
    }
    if (frame.timestampSeconds < 0) {
      throw new RenderingValidationException(
        `RenderFrame "${frame.id}" timestampSeconds must be >= 0. Got: ${frame.timestampSeconds}.`
      );
    }
  }

  // ─── Encoding Settings Validation ────────────────────────────────────────

  public static validateEncodingSettings(settings: EncodingSettings): void {
    if (settings.crf < 0 || settings.crf > 51) {
      throw new RenderingValidationException(
        `EncodingSettings CRF must be 0–51. Got: ${settings.crf}.`
      );
    }
    if (settings.threads < 1) {
      throw new RenderingValidationException(
        `EncodingSettings threads must be at least 1. Got: ${settings.threads}.`
      );
    }
    if (settings.audioBitrateKbps <= 0) {
      throw new RenderingValidationException(
        `EncodingSettings audioBitrateKbps must be positive. Got: ${settings.audioBitrateKbps}.`
      );
    }
  }

  // ─── Export Profile Validation ────────────────────────────────────────────

  public static validateExportProfile(profile: ExportProfile): void {
    if (!profile.id || profile.id.trim().length === 0) {
      throw new RenderingValidationException("ExportProfile must have a non-empty ID.");
    }
    if (!Object.values(ExportFormat).includes(profile.format)) {
      throw new RenderingValidationException(
        `ExportProfile "${profile.id}" has invalid format: "${profile.format}".`
      );
    }
    if (profile.width <= 0 || profile.height <= 0) {
      throw new RenderingValidationException(
        `ExportProfile "${profile.id}" dimensions must be positive. Got: ${profile.width}×${profile.height}.`
      );
    }
    if (profile.fps <= 0) {
      throw new RenderingValidationException(
        `ExportProfile "${profile.id}" fps must be positive. Got: ${profile.fps}.`
      );
    }
    if (!profile.outputPath || profile.outputPath.trim().length === 0) {
      throw new RenderingValidationException(
        `ExportProfile "${profile.id}" must have a non-empty outputPath.`
      );
    }
  }

  // ─── Response Validation ──────────────────────────────────────────────────

  public static validateResponse(response: RenderingResponse): void {
    if (!response.id || response.id.trim().length === 0) {
      throw new RenderingValidationException("RenderingResponse must have a non-empty ID.");
    }
    if (!response.outputPath || response.outputPath.trim().length === 0) {
      throw new RenderingValidationException(
        `RenderingResponse "${response.id}" must have a non-empty outputPath.`
      );
    }
    if (response.fileSizeBytes <= 0) {
      throw new RenderingValidationException(
        `RenderingResponse "${response.id}" fileSizeBytes must be positive. Got: ${response.fileSizeBytes}.`
      );
    }
    if (response.durationSeconds <= 0) {
      throw new RenderingValidationException(
        `RenderingResponse "${response.id}" durationSeconds must be positive. Got: ${response.durationSeconds}.`
      );
    }
  }

  // ─── State Transition Validation ──────────────────────────────────────────

  private static readonly VALID_TRANSITIONS: Record<RenderingState, RenderingState[]> = {
    [RenderingState.CREATED]:     [RenderingState.INITIALIZED],
    [RenderingState.INITIALIZED]: [RenderingState.PREPARING,  RenderingState.FAILED],
    [RenderingState.PREPARING]:   [RenderingState.RENDERING,  RenderingState.FAILED,    RenderingState.CANCELLED],
    [RenderingState.RENDERING]:   [RenderingState.ENCODING,   RenderingState.FAILED,    RenderingState.CANCELLED],
    [RenderingState.ENCODING]:    [RenderingState.EXPORTING,  RenderingState.FAILED,    RenderingState.CANCELLED],
    [RenderingState.EXPORTING]:   [RenderingState.COMPLETED,  RenderingState.FAILED],
    [RenderingState.COMPLETED]:   [],
    [RenderingState.FAILED]:      [RenderingState.INITIALIZED],
    [RenderingState.CANCELLED]:   [RenderingState.INITIALIZED],
  };

  public static validateStateTransition(
    renderId: string,
    from: RenderingState,
    to: RenderingState
  ): void {
    const allowed = RenderValidator.VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new RenderingValidationException(
        `Invalid state transition for render "${renderId}": "${from}" → "${to}". ` +
        `Allowed: [${allowed.join(", ")}].`
      );
    }
  }

  // ─── Audio/Video Sync Validation ──────────────────────────────────────────

  public static validateAudioVideoSync(
    audioDurationSeconds: number,
    videoDurationSeconds: number,
    toleranceSeconds = 0.5
  ): void {
    const diff = Math.abs(audioDurationSeconds - videoDurationSeconds);
    if (diff > toleranceSeconds) {
      throw new RenderingValidationException(
        `Audio/video sync error: audio duration (${audioDurationSeconds}s) and video duration ` +
        `(${videoDurationSeconds}s) differ by ${diff.toFixed(3)}s (tolerance: ${toleranceSeconds}s).`
      );
    }
  }

  // ─── Timeline Duration Mismatch ───────────────────────────────────────────

  public static validateTimelineDuration(
    renderId: string,
    timelineDuration: number,
    requestedDuration: number,
    toleranceSeconds = 1.0
  ): void {
    if (requestedDuration > 0) {
      const diff = Math.abs(timelineDuration - requestedDuration);
      if (diff > toleranceSeconds) {
        throw new RenderingValidationException(
          `Timeline duration mismatch for render "${renderId}": ` +
          `timeline=${timelineDuration}s, requested=${requestedDuration}s (diff=${diff.toFixed(3)}s).`
        );
      }
    }
  }
}
