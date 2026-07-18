// ─── Enums ────────────────────────────────────────────────────────────────────
export { AnalyticsState }      from "./AnalyticsState";
export { AnalyticsPlatform }   from "./AnalyticsPlatform";
export { MetricType }          from "./MetricType";
export { PerformanceLevel }    from "./PerformanceLevel";
export { RecommendationType }  from "./RecommendationType";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
  AnalyticsRequest,
  AnalyticsResponse,
  PlatformAnalytics,
  NormalizedMetrics,
  VideoAnalytics,
  AudienceAnalytics,
  RetentionGraph,
  TrafficSource,
  EngagementMetrics,
  RevenueMetrics,
  PerformanceScore,
  AnalyticsRecommendation,
  BenchmarkComparison,
  AnalyticsReport,
  AnalyticsSnapshot,
  LearningUpdate,
  LearningInsight,
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
  IAnalyticsEngine,
  IAnalyticsProvider,
  IMetricCollector,
  IPerformanceAnalyzer,
  IRecommendationEngine,
  IBenchmarkEngine,
  ILearningEngine,
} from "./interfaces";

// ─── Engine ───────────────────────────────────────────────────────────────────
export { AnalyticsEngine }    from "./AnalyticsEngine";
export { AnalyticsBuilder }   from "./AnalyticsBuilder";
export { AnalyticsValidator } from "./AnalyticsValidator";

// ─── Exception Types ──────────────────────────────────────────────────────────
export {
  AnalyticsException,
  AnalyticsValidationException,
  DuplicateAnalyticsException,
  InvalidAnalyticsStateException,
  AnalyticsPlatformException,
  AnalyticsProviderNotFoundException,
} from "./types";

// ─── Sprint 14.2: Optimization Enums ─────────────────────────────────────────
export { SnapshotInterval }  from "./SnapshotInterval";
export { ABTestStatus }      from "./ABTestStatus";
export { RankingType }       from "./RankingType";
export { PredictionType }    from "./PredictionType";
export { TrendDirection }    from "./TrendDirection";

// ─── Sprint 14.2: Optimization Models ────────────────────────────────────────
export type {
  ABTest,
  ABTestVariant,
  ABTestResult,
  RankingEntry,
  AnalyticsRanking,
  TrendPrediction,
  SnapshotSchedule,
  AnalyticsSnapshotEntry,
  ComparativeAnalysis,
  OptimizationRecommendation,
  OptimizationRequest,
  OptimizationResponse,
} from "./optimization-models";

// ─── Sprint 14.2: Optimization Interfaces ────────────────────────────────────
export type {
  IRankingEngine,
  IABTestEngine,
  ITrendPredictor,
  ISnapshotScheduler,
  IComparativeAnalyzer,
  IOptimizationEngine,
} from "./optimization-interfaces";

// ─── Sprint 14.2: Optimization Engines ───────────────────────────────────────
export { AnalyticsOptimizationEngine }   from "./AnalyticsOptimizationEngine";
export { AnalyticsOptimizationBuilder }  from "./AnalyticsOptimizationBuilder";
export { AnalyticsOptimizationValidator, OptimizationValidationException } from "./AnalyticsOptimizationValidator";
export { DefaultRankingEngine }          from "./RankingEngine";
export { DefaultABTestEngine }           from "./ABTestEngine";
export { DefaultTrendPredictor }         from "./TrendPredictionEngine";
export { DefaultSnapshotScheduler }      from "./SnapshotScheduler";
export { DefaultComparativeAnalyzer }    from "./ComparativeAnalyzer";

