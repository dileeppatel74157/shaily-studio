// ─── Enums ────────────────────────────────────────────────────────────────────
export { AnalyticsState } from "./AnalyticsState";
export { AnalyticsPlatform } from "./AnalyticsPlatform";
export { MetricType } from "./MetricType";
export { CollectionState } from "./CollectionState";
export { AggregationType } from "./AggregationType";
export { TrendDirection } from "./TrendDirection";
export { AnalyticsEventType } from "./AnalyticsEventType";
export { AnalyticsValidationResult } from "./AnalyticsValidationResult";

// ─── Models ───────────────────────────────────────────────────────────────────
export type {
  AnalyticsRecord,
  PlatformMetrics,
  VideoMetrics,
  SocialMetrics,
  MetricSnapshot,
  TrendAnalysis,
  EngagementReport,
  RetentionCurve,
  CTRReport,
  RevenueEstimate,
  SubscriberGrowth,
  CollectionJob,
  AnalyticsHistory,
  AnalyticsSummary,
  DashboardMetrics,
  LearningDataset,
  AnalyticsSnapshot,
  AnalyticsEngineStatistics,
  AnalyticsValidationIssue,
  AnalyticsValidationReport
} from "./models";

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type {
  IAnalyticsEngine,
  ICollectorManager,
  IPlatformCollector,
  IAggregationManager,
  ITrendManager,
  IEngagementManager,
  IRetentionManager,
  IReportingManager,
  IDatasetManager,
  IHistoryManager,
  IMetricsManager
} from "./interfaces";

// ─── Exceptions & Utilities ───────────────────────────────────────────────────
export {
  AnalyticsException,
  CollectionException,
  AggregationException,
  ReportingException,
  TrendException,
  DatasetException,
  ValidationException,
  deepFreeze
} from "./types";

// ─── Engine, Builder, Validator ───────────────────────────────────────────────
export { AnalyticsEngine } from "./AnalyticsEngine";
export { AnalyticsBuilder } from "./AnalyticsBuilder";
export { AnalyticsValidator } from "./AnalyticsValidator";
