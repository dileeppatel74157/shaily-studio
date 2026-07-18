import {
  QualityRequest,
  QualityResponse,
  QualitySnapshot,
  QualityReport,
  QualityIssue,
  ReviewSuggestion,
  VisualAnalysis,
  AudioAnalysis,
  SubtitleAnalysis,
  BrandConsistency,
  ThumbnailScore,
  QualityScore,
} from "./models";

// ─── Core Engine ──────────────────────────────────────────────────────────────

export interface IQualityEngine {
  readonly state: string;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  review(request: QualityRequest): Promise<QualityResponse>;
  approve(qualityId: string): Promise<void>;
  reject(qualityId: string, reason: string): Promise<void>;
  getReport(qualityId: string): QualityReport;
  getSnapshot(qualityId: string): QualitySnapshot;
  getHistory(): QualityResponse[];
}

// ─── Visual Analyzer ──────────────────────────────────────────────────────────

export interface IVisualAnalyzer {
  analyze(renderData: {
    totalFrames: number;
    fps: number;
    resolution: string;
    tracks: Array<{ type: string; clips: Array<{ transitions: unknown[]; effects: unknown[] }> }>;
  }): VisualAnalysis;
}

// ─── Audio Analyzer ───────────────────────────────────────────────────────────

export interface IAudioAnalyzer {
  analyze(audioData: {
    voiceClips: Array<{ volume: number; durationSeconds?: number }>;
    musicClips: Array<{ volume: number; durationSeconds?: number }>;
    sfxClips:   Array<{ volume: number }>;
    totalDuration: number;
  }): AudioAnalysis;
}

// ─── Subtitle Analyzer ────────────────────────────────────────────────────────

export interface ISubtitleAnalyzer {
  analyze(subtitleData: {
    entries: Array<{
      text: string;
      startTimeSeconds: number;
      endTimeSeconds: number;
    }>;
  }): SubtitleAnalysis;
}

// ─── Brand Analyzer ───────────────────────────────────────────────────────────

export interface IBrandAnalyzer {
  analyze(
    renderData: Record<string, unknown>,
    channelBlueprint?: Record<string, unknown>
  ): BrandConsistency;
}

// ─── Quality Scorer ───────────────────────────────────────────────────────────

export interface IQualityScorer {
  score(
    visual: VisualAnalysis,
    audio: AudioAnalysis,
    subtitles: SubtitleAnalysis,
    brand: BrandConsistency,
    thumbnail: ThumbnailScore,
    issues: QualityIssue[]
  ): QualityScore;
}

// ─── Auto-Fix Engine ──────────────────────────────────────────────────────────

export interface IAutoFixEngine {
  generateFixes(issues: QualityIssue[]): ReviewSuggestion[];
  applyFixes(suggestions: ReviewSuggestion[]): Promise<number>;
}
