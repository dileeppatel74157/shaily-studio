import {
  AnalyticsRequest,
  AnalyticsResponse,
  PlatformAnalytics,
  NormalizedMetrics,
  VideoAnalytics,
  AudienceAnalytics,
  EngagementMetrics,
  RevenueMetrics,
  PerformanceScore,
  AnalyticsRecommendation,
  BenchmarkComparison,
  AnalyticsReport,
  AnalyticsSnapshot,
  LearningUpdate,
} from "./models";
import { AnalyticsState }    from "./AnalyticsState";
import { AnalyticsPlatform } from "./AnalyticsPlatform";
import { MetricType }        from "./MetricType";

// ─── Core Engine ──────────────────────────────────────────────────────────────

export interface IAnalyticsEngine {
  readonly state: AnalyticsState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  analyze(request: AnalyticsRequest): Promise<AnalyticsResponse>;
  cancel(analyticsId: string): Promise<void>;
  getReport(analyticsId: string): AnalyticsReport;
  getSnapshot(analyticsId: string): AnalyticsSnapshot;
  getHistory(): AnalyticsResponse[];
}

// ─── Analytics Provider ───────────────────────────────────────────────────────

export interface IAnalyticsProvider {
  /** Platform this provider handles */
  readonly platform: AnalyticsPlatform;

  /**
   * Fetches raw platform metrics for a given video.
   * Returns platform-native metric map.
   */
  fetchMetrics(
    platformVideoId: string,
    windowDays: number
  ): Promise<Partial<Record<MetricType, number>>>;

  /**
   * Fetches detailed video analytics (retention graph, traffic sources, etc.)
   */
  fetchVideoAnalytics(platformVideoId: string): Promise<Partial<VideoAnalytics>>;

  /**
   * Fetches audience demographics and behaviour data.
   */
  fetchAudienceAnalytics(platformVideoId: string): Promise<Partial<AudienceAnalytics>>;
}

// ─── Metric Collector ─────────────────────────────────────────────────────────

export interface IMetricCollector {
  /**
   * Drives the full collection sequence:
   * raw metrics → video analytics → audience analytics → normalization.
   */
  collect(
    request: AnalyticsRequest,
    provider: IAnalyticsProvider
  ): Promise<PlatformAnalytics>;

  /**
   * Normalizes platform-raw metrics into the universal NormalizedMetrics schema.
   * Handles differences in field names, units, and scales across platforms.
   */
  normalize(
    raw: Partial<Record<MetricType, number>>,
    platform: AnalyticsPlatform
  ): NormalizedMetrics;
}

// ─── Performance Analyzer ─────────────────────────────────────────────────────

export interface IPerformanceAnalyzer {
  /**
   * Computes a multi-dimensional performance score (0–100) with
   * weak points, strong points, and a PerformanceLevel classification.
   */
  analyze(
    metrics: NormalizedMetrics,
    videoAnalytics: VideoAnalytics,
    engagementMetrics: EngagementMetrics,
    revenueMetrics: RevenueMetrics
  ): PerformanceScore;

  /**
   * Derives engagement metrics from normalized data.
   */
  computeEngagement(metrics: NormalizedMetrics): EngagementMetrics;

  /**
   * Derives revenue metrics from normalized data.
   */
  computeRevenue(metrics: NormalizedMetrics): RevenueMetrics;
}

// ─── Recommendation Engine ────────────────────────────────────────────────────

export interface IRecommendationEngine {
  /**
   * Generates prioritized improvement recommendations from performance data.
   * Each recommendation includes type, expected impact, evidence, and action.
   */
  generate(
    score: PerformanceScore,
    videoAnalytics: VideoAnalytics,
    metrics: NormalizedMetrics,
    platform: AnalyticsPlatform
  ): AnalyticsRecommendation[];
}

// ─── Benchmark Engine ─────────────────────────────────────────────────────────

export interface IBenchmarkEngine {
  /**
   * Compares this video's metrics against channel history and top performers.
   */
  compare(
    metrics: NormalizedMetrics,
    history: AnalyticsResponse[]
  ): BenchmarkComparison;
}

// ─── Learning Engine ──────────────────────────────────────────────────────────

export interface ILearningEngine {
  /**
   * Extracts insights from analytics data and propagates them to
   * Research, Strategy, Script, Channel, and Decision engines via context.
   */
  learn(
    response: AnalyticsResponse,
    context: Record<string, unknown>
  ): Promise<LearningUpdate>;
}
