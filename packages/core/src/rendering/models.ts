import { RenderingState } from "./RenderingState";
import { ExportFormat }   from "./ExportFormat";
import { CodecType }      from "./CodecType";
import { Resolution }     from "./Resolution";
import { QualityPreset }  from "./QualityPreset";

// ─── Rendering Request ────────────────────────────────────────────────────────

export interface RenderingRequest {
  /** Unique render job ID */
  id: string;
  /** ID of the CompositionResponse that produced the timeline */
  compositionId: string;
  /** Desired output format */
  format: ExportFormat;
  /** Resolution preset */
  resolution: Resolution;
  /** Quality preset */
  quality: QualityPreset;
  /** Video codec */
  codec: CodecType;
  /** Frames per second */
  fps: number;
  state: RenderingState;
  timestamp: Date;
  options?: {
    correlationId?: string;
    allowCached?: boolean;
    customWidth?: number;
    customHeight?: number;
    audioBitrateKbps?: number;
    videoBitrateKbps?: number;
    burnSubtitles?: boolean;
    hardwareAcceleration?: boolean;
    outputPath?: string;
    watermark?: string;
    maxConcurrentFrames?: number;
  };
}

// ─── Rendering Response ───────────────────────────────────────────────────────

export interface RenderingResponse {
  id: string;
  requestId: string;
  state: RenderingState;
  outputPath: string;            // final file path of the rendered video
  format: ExportFormat;
  resolution: Resolution;
  codec: CodecType;
  quality: QualityPreset;
  fileSizeBytes: number;
  durationSeconds: number;
  fps: number;
  statistics: RenderStatistics;
  metrics: RenderMetrics;
  report: RenderReport;
  timestamp: Date;
}

// ─── Render Job ───────────────────────────────────────────────────────────────

export interface RenderJob {
  id: string;
  requestId: string;
  state: RenderingState;
  /** Total frames to render */
  totalFrames: number;
  /** Frames completed */
  completedFrames: number;
  /** Frames that failed */
  failedFrames: number;
  /** Frame IDs in this job */
  frameIds: string[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// ─── Render Frame ─────────────────────────────────────────────────────────────

export interface RenderFrame {
  /** Unique frame ID — format: frame-{jobId}-{index} */
  id: string;
  jobId: string;
  /** Zero-based frame index */
  index: number;
  /** Timestamp in seconds within the timeline */
  timestampSeconds: number;
  /** Path to the rendered frame image */
  filePath?: string;
  state: RenderingState;
  /** Track IDs contributing to this frame */
  activeTracks: string[];
  /** Transition IDs active at this frame */
  activeTransitions: string[];
  /** Effect IDs active at this frame */
  activeEffects: string[];
  hasSubtitle: boolean;
  hasAudio: boolean;
}

// ─── Encoding Settings ────────────────────────────────────────────────────────

export interface EncodingSettings {
  codec: CodecType;
  /** Constant Rate Factor (quality) */
  crf: number;
  /** Video bitrate in kbps (0 = auto from preset) */
  videoBitrateKbps: number;
  /** Audio bitrate in kbps */
  audioBitrateKbps: number;
  /** Number of encoding threads */
  threads: number;
  /** Hardware acceleration flag */
  hwAccel: boolean;
  /** Encoding speed preset (ultrafast … veryslow) */
  speedPreset: string;
  /** Extra codec-specific parameters */
  extraParams: Record<string, unknown>;
}

// ─── Export Profile ───────────────────────────────────────────────────────────

export interface ExportProfile {
  id: string;
  format: ExportFormat;
  resolution: Resolution;
  width: number;
  height: number;
  fps: number;
  encoding: EncodingSettings;
  outputPath: string;
  /** Whether subtitles are burned into the video stream */
  burnSubtitles: boolean;
  /** Optional watermark text or image path */
  watermark?: string;
}

// ─── Render Progress ──────────────────────────────────────────────────────────

export interface RenderProgress {
  totalFrames: number;
  renderedFrames: number;
  encodedFrames: number;
  percentage: number;           // 0–100
  estimatedRemainingSeconds: number;
  currentPhase: RenderingState;
  fps: number;                  // current render throughput (frames/sec)
}

// ─── Render Statistics ────────────────────────────────────────────────────────

export interface RenderStatistics {
  totalFrames: number;
  renderedFrames: number;
  failedFrames: number;
  retriedFrames: number;
  totalTransitionsRendered: number;
  totalEffectsApplied: number;
  subtitleFrames: number;
  audioMixDurationSeconds: number;
  encodingDurationSeconds: number;
  exportDurationSeconds: number;
  totalWallClockSeconds: number;
}

// ─── Render Metrics ───────────────────────────────────────────────────────────

export interface RenderMetrics {
  resolution: Resolution;
  codec: CodecType;
  quality: QualityPreset;
  format: ExportFormat;
  fps: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  fileSizeBytes: number;
  compressionRatio: number;     // raw size / output size
  estimatedGpuMinutes: number;
  estimatedCpuMinutes: number;
  peakMemoryMb: number;
}

// ─── Render Report ────────────────────────────────────────────────────────────

export interface RenderReport {
  id: string;
  timestamp: Date;
  renderId: string;
  totalFrames: number;
  succeededFrames: number;
  failedFrames: number;
  retriedFrames: number;
  outputPath: string;
  fileSizeBytes: number;
  durationSeconds: number;
  codec: CodecType;
  format: ExportFormat;
  quality: QualityPreset;
  resolution: Resolution;
  warnings: string[];
  errors: string[];
}

// ─── Render Snapshot (Immutable) ──────────────────────────────────────────────

export interface RenderSnapshot {
  readonly renderId: string;
  readonly state: RenderingState;
  readonly outputPath: string;
  readonly format: ExportFormat;
  readonly resolution: Resolution;
  readonly codec: CodecType;
  readonly fileSizeBytes: number;
  readonly durationSeconds: number;
  readonly metrics: Readonly<RenderMetrics>;
  readonly timestamp: Date;
}
