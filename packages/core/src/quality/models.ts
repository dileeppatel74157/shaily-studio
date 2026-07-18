import { QualityState }    from "./QualityState";
import { QualityType }     from "./QualityType";
import { QualitySeverity } from "./QualitySeverity";
import { ReviewStatus }    from "./ReviewStatus";
import { IssueType }       from "./IssueType";

// ─── Quality Request ──────────────────────────────────────────────────────────

export interface QualityRequest {
  id: string;
  /** ID of the RenderingResponse to inspect */
  renderId: string;
  /** ID of the CompositionResponse for timeline inspection */
  compositionId?: string;
  /** ID of the Channel for brand consistency checks */
  channelId?: string;
  /** ID of the Script for content/pacing analysis */
  scriptId?: string;
  state: QualityState;
  timestamp: Date;
  options?: {
    correlationId?: string;
    allowCached?: boolean;
    approvalThreshold?: number;   // minimum overall score to auto-approve (0–100)
    autoFix?: boolean;            // whether to generate auto-fix suggestions
    strictBrand?: boolean;        // treat brand issues as CRITICAL
    enableContentAnalysis?: boolean;
    enableThumbnailScoring?: boolean;
  };
}

// ─── Quality Response ─────────────────────────────────────────────────────────

export interface QualityResponse {
  id: string;
  requestId: string;
  state: QualityState;
  reviewStatus: ReviewStatus;
  score: QualityScore;
  report: QualityReport;
  metrics: QualityMetrics;
  timestamp: Date;
}

// ─── Quality Score ────────────────────────────────────────────────────────────

export interface QualityScore {
  overall: number;              // 0–100
  visual: number;               // 0–100
  audio: number;                // 0–100
  subtitle: number;             // 0–100
  brand: number;                // 0–100
  thumbnail: number;            // 0–100
  content: number;              // 0–100 (hook, pacing, CTA)
  retention: number;            // 0–100 (estimated retention rate)
}

// ─── Quality Issue ────────────────────────────────────────────────────────────

export interface QualityIssue {
  id: string;
  type: IssueType;
  severity: QualitySeverity;
  dimension: QualityType;
  description: string;
  /** Timeline position where the issue occurs (seconds) */
  timestampSeconds?: number;
  /** Track or asset that contains the issue */
  targetId?: string;
  /** Whether an auto-fix suggestion is available */
  autoFixable: boolean;
  fix?: ReviewSuggestion;
}

// ─── Review Suggestion ────────────────────────────────────────────────────────

export interface ReviewSuggestion {
  id: string;
  issueId: string;
  description: string;
  /** Machine-readable action */
  action: string;
  /** Action parameters */
  parameters: Record<string, unknown>;
  /** Estimated score improvement if applied */
  estimatedScoreGain: number;
  /** Estimated time cost to apply (seconds) */
  estimatedTimeCostSeconds: number;
  /** Whether this fix requires re-rendering */
  requiresRerender: boolean;
  /** Whether this fix requires scene regeneration */
  requiresRegeneration: boolean;
}

// ─── Visual Analysis ──────────────────────────────────────────────────────────

export interface VisualAnalysis {
  totalFramesAnalyzed: number;
  blurryFrames: number;
  duplicateFrames: number;
  flickeringDetected: boolean;
  aspectRatioCorrect: boolean;
  blackFrames: number;
  badTransitions: number;
  colorMismatchScenes: number;
  averageSharpness: number;       // 0.0–1.0
  score: number;                  // 0–100
  issues: QualityIssue[];
}

// ─── Audio Analysis ───────────────────────────────────────────────────────────

export interface AudioAnalysis {
  clippingDetected: boolean;
  silenceSeconds: number;
  volumeImbalanceDetected: boolean;
  backgroundNoiseLevel: number;  // 0.0–1.0 (higher = noisier)
  narrationPresent: boolean;
  musicLouderThanVoice: boolean;
  averageVolume: number;          // 0.0–1.0
  peakVolume: number;             // 0.0–1.0
  score: number;                  // 0–100
  issues: QualityIssue[];
}

// ─── Subtitle Analysis ────────────────────────────────────────────────────────

export interface SubtitleAnalysis {
  totalEntries: number;
  overlappingEntries: number;
  timingMismatches: number;
  tooLongEntries: number;         // over 42 chars per line
  tooFastEntries: number;         // under 1.0s display time
  spellingIssues: number;
  score: number;                  // 0–100
  issues: QualityIssue[];
}

// ─── Brand Consistency ────────────────────────────────────────────────────────

export interface BrandConsistency {
  colorsMatch: boolean;
  fontMatch: boolean;
  logoPresent: boolean;
  thumbnailOnBrand: boolean;
  textPlacementCorrect: boolean;
  animationStyleMatch: boolean;
  voiceToneMatch: boolean;
  score: number;                  // 0–100
  issues: QualityIssue[];
}

// ─── Thumbnail Score ──────────────────────────────────────────────────────────

export interface ThumbnailScore {
  ctrPotential: number;          // 0–100
  readability: number;           // 0–100
  contrast: number;              // 0–100
  faceVisibility: number;        // 0–100
  emotion: number;               // 0–100
  composition: number;           // 0–100
  overall: number;               // 0–100
  issues: QualityIssue[];
}

// ─── Quality Metrics ──────────────────────────────────────────────────────────

export interface QualityMetrics {
  totalIssues: number;
  criticalIssues: number;
  errorIssues: number;
  warningIssues: number;
  infoIssues: number;
  autoFixableIssues: number;
  issuesFixed: number;
  analysisTimeSeconds: number;
  scoresByDimension: Record<string, number>;
  approvalThreshold: number;
  approved: boolean;
}

// ─── Quality Report ───────────────────────────────────────────────────────────

export interface QualityReport {
  id: string;
  timestamp: Date;
  qualityId: string;
  renderId: string;
  reviewStatus: ReviewStatus;
  score: QualityScore;
  visual: VisualAnalysis;
  audio: AudioAnalysis;
  subtitles: SubtitleAnalysis;
  brand: BrandConsistency;
  thumbnail: ThumbnailScore;
  allIssues: QualityIssue[];
  suggestions: ReviewSuggestion[];
  warnings: string[];
  errors: string[];
}

// ─── Quality Snapshot (Immutable) ────────────────────────────────────────────

export interface QualitySnapshot {
  readonly qualityId: string;
  readonly state: QualityState;
  readonly reviewStatus: ReviewStatus;
  readonly score: Readonly<QualityScore>;
  readonly approved: boolean;
  readonly totalIssues: number;
  readonly criticalIssues: number;
  readonly timestamp: Date;
}
