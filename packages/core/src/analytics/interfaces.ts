import { AnalyticsState } from "./AnalyticsState";
import { AnalyticsPlatform } from "./AnalyticsPlatform";
import { AggregationType } from "./AggregationType";
import { MetricType } from "./MetricType";
import {
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
  AnalyticsEngineStatistics
} from "./models";

export interface IAnalyticsEngine {
  getState(): AnalyticsState;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  collectMetrics(platforms: AnalyticsPlatform[]): Promise<CollectionJob>;
  getSnapshot(): AnalyticsSnapshot;
  getStatistics(): AnalyticsEngineStatistics;

  // Managers
  getCollectorManager(): ICollectorManager;
  getAggregationManager(): IAggregationManager;
  getTrendManager(): ITrendManager;
  getEngagementManager(): IEngagementManager;
  getRetentionManager(): IRetentionManager;
  getReportingManager(): IReportingManager;
  getDatasetManager(): IDatasetManager;
  getHistoryManager(): IHistoryManager;
  getMetricsManager(): IMetricsManager;

  // Events
  on(event: string, handler: (payload: any) => void): void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface ICollectorManager {
  registerCollector(platform: AnalyticsPlatform, collector: IPlatformCollector): void;
  getCollector(platform: AnalyticsPlatform): IPlatformCollector | undefined;
  listCollectors(): IPlatformCollector[];
}

export interface IPlatformCollector {
  platform: AnalyticsPlatform;
  collect(contentId: string): Promise<MetricSnapshot>;
}

export interface IAggregationManager {
  aggregate(records: AnalyticsRecord[], period: AggregationType): Promise<AnalyticsSummary>;
}

export interface ITrendManager {
  analyzeTrends(records: AnalyticsRecord[], metric: MetricType, periodDays: number): Promise<TrendAnalysis>;
}

export interface IEngagementManager {
  calculateEngagement(record: AnalyticsRecord, platform: AnalyticsPlatform): Promise<EngagementReport>;
}

export interface IRetentionManager {
  analyzeRetention(record: AnalyticsRecord): Promise<RetentionCurve>;
}

export interface IReportingManager {
  generateCreatorReport(summary: AnalyticsSummary): Promise<string>;
  generatePlatformReport(records: AnalyticsRecord[], platform: AnalyticsPlatform): Promise<string>;
}

export interface IDatasetManager {
  generateLearningDataset(records: AnalyticsRecord[]): Promise<LearningDataset>;
}

export interface IHistoryManager {
  logMetrics(history: AnalyticsHistory): Promise<void>;
  getHistory(contentId: string): Promise<AnalyticsHistory[]>;
}

export interface IMetricsManager {
  normalizeMetrics(raw: any, platform: AnalyticsPlatform): Promise<MetricSnapshot>;
}
