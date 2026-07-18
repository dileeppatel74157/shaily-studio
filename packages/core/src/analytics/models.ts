import { AnalyticsState }       from "./AnalyticsState";
import { AnalyticsPlatform }    from "./AnalyticsPlatform";
import { MetricType }           from "./MetricType";
import { PerformanceLevel }     from "./PerformanceLevel";
import { RecommendationType }   from "./RecommendationType";

// ─── Analytics Request ────────────────────────────────────────────────────────

export interface AnalyticsRequest {
  /** Unique analytics job ID */
  id: string;
  /** Publishing job ID that produced the video */
  publishingId: string;
  /** Platform-assigned video ID (from PublishingResult.platformVideoId) */
  platformVideoId: string;
  /** Platform to collect analytics from */
  platform: AnalyticsPlatform;
  /** ID of the original PublishingRequest for traceability */
  originalRequestId?: string;
  /** ID of the QualityResponse for quality-vs-performance comparison */
  qualityId?: string;
  state: AnalyticsState;
  timestamp: Date;
  options?: {
    correlationId?: string;
    /** Collection window in days (default: 7) */
    collectionWindowDays?: number;
    /** Whether to generate AI recommendations */
    generateRecommendations?: boolean;
    /** Whether to run benchmark comparison */
    runBenchmark?: boolean;
    /** Whether to trigger learning updates to connected engines */
    triggerLearning?: boolean;
    /** Minimum views before running analysis (default: 100) */
    minViewsThreshold?: number;
  };
}

// ─── Analytics Response ───────────────────────────────────────────────────────

export interface AnalyticsResponse {
  id: string;
  requestId: string;
  state: AnalyticsState;
  platform: AnalyticsPlatform;
  platformAnalytics: PlatformAnalytics;
  videoAnalytics: VideoAnalytics;
  audienceAnalytics: AudienceAnalytics;
  performanceScore: PerformanceScore;
  recommendations: AnalyticsRecommendation[];
  benchmark?: BenchmarkComparison;
  learningUpdate?: LearningUpdate;
  report: AnalyticsReport;
  snapshot: AnalyticsSnapshot;
  timestamp: Date;
}

// ─── Platform Analytics ───────────────────────────────────────────────────────

export interface PlatformAnalytics {
  platform: AnalyticsPlatform;
  platformVideoId: string;
  publishedUrl: string;
  /** Raw metric values keyed by MetricType */
  rawMetrics: Partial<Record<MetricType, number>>;
  /** Normalized metrics (same schema regardless of platform) */
  normalizedMetrics: NormalizedMetrics;
  collectedAt: Date;
  collectionWindowDays: number;
}

// ─── Normalized Metrics ───────────────────────────────────────────────────────

export interface NormalizedMetrics {
  views: number;
  watchTimeMinutes: number;
  ctrPercent: number;              // 0–100
  averageRetentionPercent: number; // 0–100
  likes: number;
  comments: number;
  shares: number;
  subscribersGained: number;
  followersGained: number;
  revenueUsd: number;
  rpmUsd: number;                  // Revenue per 1000 views
  cpmUsd: number;                  // Cost per 1000 impressions
  impressions: number;
  engagementRate: number;          // 0–100
}

// ─── Video Analytics ──────────────────────────────────────────────────────────

export interface VideoAnalytics {
  videoId: string;
  title: string;
  durationSeconds: number;
  publishedAt: Date;
  /** Peak concurrent viewers (live/premiere) */
  peakConcurrentViewers: number;
  /** Percentage of viewers who clicked through from impressions */
  clickThroughRate: number;
  /** Average watch duration in seconds */
  averageViewDurationSeconds: number;
  /** Percentage of full video watched on average */
  averageViewedPercent: number;
  retentionGraph: RetentionGraph;
  trafficSources: TrafficSource[];
  topCountries: Array<{ country: string; viewPercent: number }>;
  topAgeGroups: Array<{ range: string; viewPercent: number }>;
  genderSplit: { male: number; female: number; other: number };
}

// ─── Audience Analytics ───────────────────────────────────────────────────────

export interface AudienceAnalytics {
  totalUniqueViewers: number;
  returningViewers: number;
  newViewers: number;
  subscriberViewPercent: number;   // % of views from subscribers
  /** Best days for the audience */
  bestDaysOfWeek: string[];
  /** Best hours (0–23) */
  bestHoursOfDay: number[];
  /** Audience interest categories */
  interestCategories: string[];
  /** Devices used (mobile, desktop, tablet, tv) */
  deviceSplit: Record<string, number>;
}

// ─── Retention Graph ──────────────────────────────────────────────────────────

export interface RetentionGraph {
  /** Retention % at each second (index = second of video) */
  dataPoints: Array<{ secondMark: number; retentionPercent: number }>;
  /** Seconds where the largest audience drops occur */
  dropPoints: number[];
  /** Strongest spike (re-watch) points in seconds */
  spikePoints: number[];
  /** Overall average retention % */
  averageRetention: number;
  /** Retention at the 30-second mark (hook effectiveness proxy) */
  retentionAt30s: number;
  /** Retention at the midpoint */
  retentionAtMidpoint: number;
}

// ─── Traffic Source ───────────────────────────────────────────────────────────

export interface TrafficSource {
  source: string;       // e.g. "YouTube Search", "Suggested", "External", "Direct"
  viewPercent: number;  // 0–100
  views: number;
  ctrPercent: number;
}

// ─── Engagement Metrics ───────────────────────────────────────────────────────

export interface EngagementMetrics {
  likeRate: number;       // likes / views * 100
  commentRate: number;    // comments / views * 100
  shareRate: number;      // shares / views * 100
  overallEngagement: number; // composite 0–100
  /** Positive sentiment ratio from comments (0–1) */
  sentimentScore: number;
  /** Top performing comment themes */
  commentThemes: string[];
  /** Whether comment section triggered community boost */
  communityBoost: boolean;
}

// ─── Revenue Metrics ──────────────────────────────────────────────────────────

export interface RevenueMetrics {
  totalRevenueUsd: number;
  rpmUsd: number;
  cpmUsd: number;
  adImpressions: number;
  estimatedMonetizedPlaybacks: number;
  membershipRevenue: number;
  superChatRevenue: number;
  merchandiseRevenue: number;
  /** Revenue per view in USD */
  revenuePerView: number;
}

// ─── Performance Score ────────────────────────────────────────────────────────

export interface PerformanceScore {
  /** Composite score 0–100 */
  overall: number;
  hook: number;         // Retention at 30s
  retention: number;    // Average retention
  engagement: number;   // Overall engagement
  ctr: number;          // Click-through rate score
  growth: number;       // Subscriber/follower gain
  revenue: number;      // Revenue vs channel average
  reach: number;        // Impressions and views
  level: PerformanceLevel;
  weakPoints: string[];
  strongPoints: string[];
}

// ─── Analytics Recommendation ─────────────────────────────────────────────────

export interface AnalyticsRecommendation {
  id: string;
  type: RecommendationType;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  /** Expected improvement if applied (% gain on target metric) */
  expectedImpactPercent: number;
  /** Target metric this recommendation affects */
  targetMetric: MetricType;
  /** Supporting data evidence */
  evidence: string;
  /** Concrete action to take */
  action: string;
  /** Machine-readable parameters for automated application */
  parameters: Record<string, unknown>;
  appliedAt?: Date;
}

// ─── Benchmark Comparison ─────────────────────────────────────────────────────

export interface BenchmarkComparison {
  /** Channel's own historical average performance */
  channelAverage: Partial<NormalizedMetrics>;
  /** Top-10 performing videos on the channel */
  top10Average: Partial<NormalizedMetrics>;
  /** How this video compares to channel average (% delta) */
  vsChannelAverage: Partial<Record<keyof NormalizedMetrics, number>>;
  /** Best performing topic on this channel */
  bestTopic: string;
  /** Best performing thumbnail style */
  bestThumbnailStyle: string;
  /** Best upload day */
  bestUploadDay: string;
  /** Best upload hour (0–23) */
  bestUploadHour: number;
  /** Rank within channel (1 = best) */
  channelRank: number;
}

// ─── Analytics Report ─────────────────────────────────────────────────────────

export interface AnalyticsReport {
  id: string;
  timestamp: Date;
  requestId: string;
  publishingId: string;
  platform: AnalyticsPlatform;
  platformVideoId: string;
  normalizedMetrics: NormalizedMetrics;
  videoAnalytics: VideoAnalytics;
  audienceAnalytics: AudienceAnalytics;
  engagementMetrics: EngagementMetrics;
  revenueMetrics: RevenueMetrics;
  performanceScore: PerformanceScore;
  recommendations: AnalyticsRecommendation[];
  benchmark?: BenchmarkComparison;
  learningUpdate?: LearningUpdate;
  warnings: string[];
  errors: string[];
}

// ─── Analytics Snapshot (Immutable) ──────────────────────────────────────────

export interface AnalyticsSnapshot {
  readonly analyticsId: string;
  readonly state: AnalyticsState;
  readonly platform: AnalyticsPlatform;
  readonly platformVideoId: string;
  readonly overallScore: number;
  readonly performanceLevel: PerformanceLevel;
  readonly views: number;
  readonly ctrPercent: number;
  readonly averageRetentionPercent: number;
  readonly recommendationCount: number;
  readonly learningTriggered: boolean;
  readonly timestamp: Date;
}

// ─── Learning Update ──────────────────────────────────────────────────────────

export interface LearningUpdate {
  analyticsId: string;
  platform: AnalyticsPlatform;
  triggeredAt: Date;
  /** Engines that received updates */
  updatedEngines: string[];
  /** Key insights extracted */
  insights: LearningInsight[];
  /** Whether the update was applied successfully */
  applied: boolean;
}

// ─── Learning Insight ─────────────────────────────────────────────────────────

export interface LearningInsight {
  type: RecommendationType;
  description: string;
  confidence: number;   // 0–1
  /** Winning pattern extracted */
  winningPattern?: string;
  /** Losing pattern to avoid */
  losingPattern?: string;
  /** Which engine this insight feeds into */
  targetEngine: string;
  parameters: Record<string, unknown>;
}
