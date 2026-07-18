import { AnalyticsPlatform }   from "./AnalyticsPlatform";
import { RankingType }         from "./RankingType";
import { PredictionType }      from "./PredictionType";
import { SnapshotInterval }    from "./SnapshotInterval";
import { NormalizedMetrics, PerformanceScore, AnalyticsResponse } from "./models";
import {
  AnalyticsRanking,
  ABTest,
  ABTestResult,
  TrendPrediction,
  SnapshotSchedule,
  AnalyticsSnapshotEntry,
  ComparativeAnalysis,
  OptimizationRecommendation,
  OptimizationRequest,
  OptimizationResponse,
} from "./optimization-models";

// ─── Ranking Engine ───────────────────────────────────────────────────────────

export interface IRankingEngine {
  /** Rank entities (videos, topics, formats, etc.) within an analytics history */
  rank(
    type: RankingType,
    platform: AnalyticsPlatform,
    history: AnalyticsResponse[],
    windowDays?: number
  ): AnalyticsRanking;
}

// ─── A/B Test Engine ──────────────────────────────────────────────────────────

export interface IABTestEngine {
  /** Creates and registers a new A/B test */
  createTest(test: ABTest): void;

  /** Updates a test with new performance data */
  updateTest(testId: string, metrics: Partial<NormalizedMetrics>[]): void;

  /** Evaluates all running tests and declares winners */
  evaluate(): ABTestResult[];

  /** Returns a specific test by ID */
  getTest(testId: string): ABTest | undefined;

  /** Returns all A/B tests */
  listTests(): ABTest[];
}

// ─── Trend Predictor ──────────────────────────────────────────────────────────

export interface ITrendPredictor {
  /** Generates trend predictions from analytics history */
  predict(
    history: AnalyticsResponse[],
    platforms: AnalyticsPlatform[],
    types?: PredictionType[]
  ): TrendPrediction[];
}

// ─── Snapshot Scheduler ───────────────────────────────────────────────────────

export interface ISnapshotScheduler {
  /** Registers a video for recurring analytics snapshots */
  register(schedule: SnapshotSchedule): void;

  /** Captures a snapshot for a given video at a given interval */
  capture(
    platformVideoId: string,
    interval: SnapshotInterval,
    metrics: NormalizedMetrics,
    score: PerformanceScore
  ): AnalyticsSnapshotEntry;

  /** Returns all snapshots for a video */
  getSnapshots(platformVideoId: string): AnalyticsSnapshotEntry[];

  /** Returns snapshots due to be captured now */
  getDue(now?: Date): SnapshotSchedule[];
}

// ─── Comparative Analyzer ─────────────────────────────────────────────────────

export interface IComparativeAnalyzer {
  /** Compares two entities (videos, channels, months, platforms, etc.) */
  compare(
    type: ComparativeAnalysis["type"],
    baselineId: string,
    comparisonId: string,
    history: AnalyticsResponse[]
  ): ComparativeAnalysis;
}

// ─── Optimization Engine ──────────────────────────────────────────────────────

export interface IOptimizationEngine {
  /** Runs the full optimization pipeline */
  optimize(
    request: OptimizationRequest,
    history: AnalyticsResponse[]
  ): Promise<OptimizationResponse>;

  /** Feeds optimization recommendations back to connected engines */
  feedbackToEngines(
    response: OptimizationResponse,
    context: Record<string, unknown>
  ): Promise<string[]>;
}
