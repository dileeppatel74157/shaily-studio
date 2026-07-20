import { AnalyticsPlatform } from "./AnalyticsPlatform";
import { MetricType } from "./MetricType";
import { CollectionState } from "./CollectionState";
import { AggregationType } from "./AggregationType";
import { TrendDirection } from "./TrendDirection";
import { AnalyticsState } from "./AnalyticsState";

export interface PlatformMetrics {
  views: number;
  impressions: number;
  watchTimeSeconds: number;
  ctrPercent: number;
  likes: number;
  comments: number;
  shares: number;
  clicks?: number;
  engagementRatePercent: number;
}

export interface VideoMetrics {
  durationSeconds: number;
  averageViewDurationSeconds: number;
  completionRatePercent: number;
  retentionCurvePoints: number[]; // Percentage of audience remaining at 10% intervals
}

export interface SocialMetrics {
  reach: number;
  interactions: number;
  follows: number;
}

export interface MetricSnapshot {
  timestamp: Date;
  platform: AnalyticsPlatform;
  metrics: PlatformMetrics;
  videoMetrics?: VideoMetrics;
  socialMetrics?: SocialMetrics;
}

export interface AnalyticsRecord {
  id: string;
  contentId: string; // Video ID or Post ID
  title: string;
  publishedAt: Date;
  platforms: AnalyticsPlatform[];
  snapshots: Record<AnalyticsPlatform, MetricSnapshot[]>;
  latestMetrics: Record<AnalyticsPlatform, PlatformMetrics>;
}

export interface TrendAnalysis {
  direction: TrendDirection;
  growthRatePercent: number;
  metricType: MetricType;
  confidenceScore: number;
  periodDays: number;
}

export interface EngagementReport {
  postId: string;
  platform: AnalyticsPlatform;
  engagementRatePercent: number;
  likeRatioPercent: number;
  commentRatioPercent: number;
  shareRatioPercent: number;
}

export interface RetentionCurve {
  contentId: string;
  points: Array<{ timestampSeconds: number; retentionPercent: number }>;
  averageRetentionPercent: number;
  dropOffRatePercent: number;
}

export interface CTRReport {
  contentId: string;
  platform: AnalyticsPlatform;
  impressions: number;
  clicks: number;
  ctrPercent: number;
}

export interface RevenueEstimate {
  contentId: string;
  estimatedEarningsUsd: number;
  cpmUsd: number;
  rpmUsd: number;
}

export interface SubscriberGrowth {
  platform: AnalyticsPlatform;
  netGained: number;
  totalFollowers: number;
  growthRatePercent: number;
}

export interface CollectionJob {
  id: string;
  startTime: Date;
  endTime?: Date;
  platforms: AnalyticsPlatform[];
  state: CollectionState;
  recordsCollected: number;
  error?: string;
}

export interface AnalyticsHistory {
  id: string;
  timestamp: Date;
  contentId: string;
  platform: AnalyticsPlatform;
  views: number;
  ctrPercent: number;
  engagementRatePercent: number;
}

export interface AnalyticsSummary {
  periodType: AggregationType;
  startDate: Date;
  endDate: Date;
  totalViews: number;
  totalImpressions: number;
  averageCtrPercent: number;
  totalEngagementPercent: number;
}

export interface DashboardMetrics {
  totalSubscribers: number;
  aggregateViews: number;
  growthPercent: number;
  topPerformingContentId: string;
  recentActivityScore: number;
}

export interface DatasetFeature {
  titleLength: number;
  hasThumbnail: boolean;
  durationSeconds: number;
  providerType: string;
  modelCategory: string;
  tagsCount: number;
}

export interface DatasetLabel {
  viewsCount: number;
  ctrPercent: number;
  engagementPercent: number;
  score: number;
}

export interface LearningDataset {
  id: string;
  features: DatasetFeature[];
  labels: DatasetLabel[];
  exportedAt: Date;
  count: number;
}

export interface AnalyticsSnapshot {
  snapshotId: string;
  state: AnalyticsState;
  activeCollectionJobs: number;
  monitoredChannelsCount: number;
  timestamp: Date;
}

export interface AnalyticsEngineStatistics {
  totalCollections: number;
  successfulCollections: number;
  failedCollections: number;
  totalRecordsProcessed: number;
}

export interface AnalyticsValidationIssue {
  field: string;
  message: string;
  severity: "WARNING" | "CRITICAL";
}

export interface AnalyticsValidationReport {
  valid: boolean;
  issues: AnalyticsValidationIssue[];
  timestamp: Date;
}
