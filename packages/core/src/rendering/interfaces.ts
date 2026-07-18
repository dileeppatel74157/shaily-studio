import {
  RenderingRequest,
  RenderingResponse,
  RenderJob,
  RenderFrame,
  EncodingSettings,
  ExportProfile,
  RenderProgress,
  RenderSnapshot,
  RenderReport,
  RenderStatistics,
  RenderMetrics,
} from "./models";
import { RenderingState } from "./RenderingState";
import { ExportFormat }   from "./ExportFormat";
import { CodecType }      from "./CodecType";
import { Resolution }     from "./Resolution";
import { QualityPreset }  from "./QualityPreset";

// ─── Core Engine ─────────────────────────────────────────────────────────────

export interface IRenderEngine {
  readonly state: RenderingState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  render(request: RenderingRequest): Promise<RenderingResponse>;
  pause(renderId: string): Promise<void>;
  resume(renderId: string): Promise<RenderingResponse>;
  cancel(renderId: string): Promise<void>;
  retry(renderId: string): Promise<RenderingResponse>;
  getProgress(renderId: string): RenderProgress;
  getReport(renderId: string): RenderReport;
  getSnapshot(renderId: string): RenderSnapshot;
  getHistory(): RenderingResponse[];
}

// ─── Frame Renderer ──────────────────────────────────────────────────────────

export interface IFrameRenderer {
  /**
   * Renders a batch of frames from the timeline.
   * Returns the rendered frames with metadata.
   */
  renderFrames(
    job: RenderJob,
    timeline: {
      durationSeconds: number;
      fps: number;
      tracks: Array<{ id: string; type: string; clips: Array<{ startTimeSeconds: number; endTimeSeconds: number; assetPath: string; transitions: unknown[]; effects: unknown[] }> }>;
      subtitleTrack: { entries: Array<{ startTimeSeconds: number; endTimeSeconds: number; text: string }> };
    },
    maxConcurrent: number
  ): Promise<RenderFrame[]>;
}

// ─── Encoder ─────────────────────────────────────────────────────────────────

export interface IEncoder {
  /**
   * Encodes rendered frames + audio into a video stream.
   * Returns the path to the encoded intermediate file.
   */
  encode(
    frames: RenderFrame[],
    settings: EncodingSettings,
    audioMixPath: string,
    outputPath: string
  ): Promise<{ outputPath: string; fileSizeBytes: number; durationSeconds: number }>;
}

// ─── Exporter ────────────────────────────────────────────────────────────────

export interface IExporter {
  /**
   * Muxes the encoded stream into the final container format.
   * Returns the absolute file path of the exported video.
   */
  export(
    encodedPath: string,
    profile: ExportProfile
  ): Promise<{ outputPath: string; fileSizeBytes: number }>;
}

// ─── Render Optimizer ────────────────────────────────────────────────────────

export interface IRenderOptimizer {
  /**
   * Chooses optimal encoding settings based on timeline complexity,
   * target quality, and available resources.
   */
  optimizeSettings(
    codec: CodecType,
    quality: QualityPreset,
    resolution: Resolution,
    fps: number,
    durationSeconds: number
  ): EncodingSettings;

  /**
   * Estimates GPU memory requirements in MB.
   */
  estimateGpuMemoryMb(resolution: Resolution, fps: number): number;

  /**
   * Estimates total encoding time in seconds.
   */
  estimateEncodingSeconds(
    totalFrames: number,
    codec: CodecType,
    resolution: Resolution,
    hwAccel: boolean
  ): number;
}

// ─── Quality Analyzer ────────────────────────────────────────────────────────

export interface IQualityAnalyzer {
  /**
   * Analyses a rendered frame for quality issues.
   * Returns a quality score 0.0–1.0.
   */
  analyzeFrame(frame: RenderFrame): number;

  /**
   * Returns overall quality score for the render job.
   */
  analyzeJob(frames: RenderFrame[]): number;

  /**
   * Returns warnings for quality issues found.
   */
  getWarnings(frames: RenderFrame[], threshold?: number): string[];
}
