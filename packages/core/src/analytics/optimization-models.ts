import { AnalyticsPlatform }  from "./AnalyticsPlatform";
import { MetricType }         from "./MetricType";
import { RecommendationType } from "./RecommendationType";
import { SnapshotInterval }   from "./SnapshotInterval";
import { ABTestStatus }       from "./ABTestStatus";
import { RankingType }        from "./RankingType";
import { PredictionType }     from "./PredictionType";
import { TrendDirection }     from "./TrendDirection";
import { NormalizedMetrics, PerformanceScore, AnalyticsRecommendation } from "./models";

// ─── A/B Test ─────────────────────────────────────────────────────────────────

export interface ABTest {
  id: string;
  name: string;
  /** What is being tested */
  variable: "THUMBNAIL" | "TITLE" | "DESCRIPTION" | "HOOK" | "CTA" | "PUBLISHING_TIME";
  platform: AnalyticsPlatform;
  status: ABTestStatus;
  variants: ABTestVariant[];
  startedAt: Date;
  endedAt?: Date;
  durationDays: number;
  /** Minimum views before declaring a winner */
  minViewsThreshold: number;
  winnerId?: string;
  confidence: number;   // 0–1
  createdAt: Date;
  metadata: Record<string, unknown>;
}

// ─── A/B Test Variant ─────────────────────────────────────────────────────────

export interface ABTestVariant {
  id: string;
  testId: string;
  label: string;             // "A", "B", "Control", "Challenger"
  description: string;
  platformVideoId?: string;  // If testing actual published videos
  /** Content specific to this variant (thumbnail URL, title text, etc.) */
  content: Record<string, unknown>;
  metrics?: NormalizedMetrics;
  score?: number;            // 0–100
  isWinner: boolean;
  impressions: number;
  clicks: number;
  views: number;
  ctrPercent: number;
  retentionPercent: number;
}

// ─── A/B Test Result ──────────────────────────────────────────────────────────

export interface ABTestResult {
  testId: string;
  status: ABTestStatus;
  winnerId?: string;
  winnerLabel?: string;
  winnerContent?: Record<string, unknown>;
  /** Delta in CTR between winner and control (%) */
  ctrLift: number;
  /** Delta in retention */
  retentionLift: number;
  /** Delta in views */
  viewsLift: number;
  confidence: number;
  insight: string;
  recommendations: AnalyticsRecommendation[];
  completedAt: Date;
}

// ─── Ranking Entry ────────────────────────────────────────────────────────────

export interface RankingEntry {
  rank: number;
  entityId: string;         // platformVideoId, topic name, format name, etc.
  entityLabel: string;
  score: number;            // 0–100
  platform: AnalyticsPlatform;
  metrics: Partial<NormalizedMetrics>;
  /** Supporting evidence for this rank */
  reason: string;
  attributes: Record<string, unknown>;
}

// ─── Analytics Ranking ────────────────────────────────────────────────────────

export interface AnalyticsRanking {
  id: string;
  type: RankingType;
  platform: AnalyticsPlatform;
  entries: RankingEntry[];
  generatedAt: Date;
  /** Analytics history window used (days) */
  windowDays: number;
  insight: string;
}

// ─── Trend Prediction ─────────────────────────────────────────────────────────

export interface TrendPrediction {
  id: string;
  type: PredictionType;
  platform: AnalyticsPlatform;
  direction: TrendDirection;
  subject: string;           // Topic name, metric name, upload day/hour
  /** Predicted change value (e.g. +35 views/day, +2.5% CTR) */
  predictedDelta: number;
  predictedUnit: string;     // "views/day", "% CTR", "subscribers/week"
  confidence: number;        // 0–1
  /** Time horizon for this prediction */
  horizonDays: number;
  dataPoints: Array<{ date: Date; value: number }>;
  seasonality?: string;      // "Q4 spike", "weekend surge"
  generatedAt: Date;
  reasoning: string;
  actionable: boolean;
  suggestedAction?: string;
}

// ─── Snapshot Schedule ────────────────────────────────────────────────────────

export interface SnapshotSchedule {
  id: string;
  platformVideoId: string;
  platform: AnalyticsPlatform;
  intervals: SnapshotInterval[];
  /** Next time each interval fires */
  nextSnapshots: Partial<Record<SnapshotInterval, Date>>;
  createdAt: Date;
  active: boolean;
}

// ─── Analytics Snapshot Entry ─────────────────────────────────────────────────

export interface AnalyticsSnapshotEntry {
  id: string;
  platformVideoId: string;
  platform: AnalyticsPlatform;
  interval: SnapshotInterval;
  metrics: NormalizedMetrics;
  score: PerformanceScore;
  capturedAt: Date;
  windowStart: Date;
  windowEnd: Date;
}

// ─── Comparative Analysis ─────────────────────────────────────────────────────

export interface ComparativeAnalysis {
  id: string;
  type:
    | "VIDEO_VS_VIDEO"
    | "CHANNEL_VS_CHANNEL"
    | "CURRENT_VS_PREVIOUS"
    | "MONTH_VS_MONTH"
    | "PLATFORM_VS_PLATFORM"
    | "SERIES_VS_SERIES"
    | "TOPIC_VS_TOPIC";
  baselineId: string;
  comparisonId: string;
  baselineLabel: string;
  comparisonLabel: string;
  platform?: AnalyticsPlatform;
  /** Metric deltas: positive = comparison is better */
  deltas: Partial<Record<keyof NormalizedMetrics, number>>;
  baselineMetrics: Partial<NormalizedMetrics>;
  comparisonMetrics: Partial<NormalizedMetrics>;
  winner: "BASELINE" | "COMPARISON" | "TIE";
  winMargin: number;        // 0–100, how decisive the win is
  insights: string[];
  generatedAt: Date;
}

// ─── Optimization Recommendation (extends AnalyticsRecommendation) ────────────

export interface OptimizationRecommendation extends AnalyticsRecommendation {
  /** Which engine should receive this recommendation */
  targetEngine: string;
  /** Whether this was AI-generated from trend/benchmark data */
  aiGenerated: boolean;
  /** Linked A/B test ID if this recommendation is being tested */
  abTestId?: string;
  /** Linked prediction ID */
  predictionId?: string;
  /** Which videos triggered this recommendation */
  triggerVideoIds: string[];
  appliedByEngine?: string;
  appliedAt?: Date;
}

// ─── Optimization Request ─────────────────────────────────────────────────────

export interface OptimizationRequest {
  id: string;
  /** Analytics response IDs to process */
  analyticsIds: string[];
  platforms: AnalyticsPlatform[];
  options: {
    runRanking?: boolean;
    runABTests?: boolean;
    runPredictions?: boolean;
    runComparative?: boolean;
    runSnapshots?: boolean;
    feedbackToEngines?: boolean;
    snapshotIntervals?: SnapshotInterval[];
    windowDays?: number;
  };
  timestamp: Date;
}

// ─── Optimization Response ────────────────────────────────────────────────────

export interface OptimizationResponse {
  id: string;
  requestId: string;
  rankings: AnalyticsRanking[];
  abTestResults: ABTestResult[];
  predictions: TrendPrediction[];
  comparisons: ComparativeAnalysis[];
  snapshots: AnalyticsSnapshotEntry[];
  recommendations: OptimizationRecommendation[];
  feedbackSent: boolean;
  enginesUpdated: string[];
  timestamp: Date;
}
