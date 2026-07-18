import {
  IAnalyticsEngine,
  IAnalyticsProvider,
  IMetricCollector,
  IPerformanceAnalyzer,
  IRecommendationEngine,
  IBenchmarkEngine,
  ILearningEngine,
} from "./interfaces";
import { AnalyticsState }      from "./AnalyticsState";
import { AnalyticsPlatform }   from "./AnalyticsPlatform";
import { MetricType }          from "./MetricType";
import { PerformanceLevel }    from "./PerformanceLevel";
import { RecommendationType }  from "./RecommendationType";
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
  RetentionGraph,
  TrafficSource,
} from "./models";
import { AnalyticsValidator } from "./AnalyticsValidator";
import {
  AnalyticsException,
  DuplicateAnalyticsException,
  AnalyticsProviderNotFoundException,
  deepFreeze,
} from "./types";

// ─── Platform Provider Registry ───────────────────────────────────────────────

class ProviderRegistry {
  private readonly _map = new Map<AnalyticsPlatform, IAnalyticsProvider>();

  constructor(providers: IAnalyticsProvider[]) {
    for (const p of providers) this._map.set(p.platform, p);
  }

  public route(platform: AnalyticsPlatform): IAnalyticsProvider {
    const p = this._map.get(platform);
    if (!p) throw new AnalyticsProviderNotFoundException(platform);
    return p;
  }

  public register(provider: IAnalyticsProvider): void {
    this._map.set(provider.platform, provider);
  }

  public has(platform: AnalyticsPlatform): boolean {
    return this._map.has(platform);
  }
}

// ─── Base Platform Provider ───────────────────────────────────────────────────

class BasePlatformProvider implements IAnalyticsProvider {
  public readonly platform: AnalyticsPlatform;

  constructor(platform: AnalyticsPlatform) {
    this.platform = platform;
  }

  public async fetchMetrics(
    _videoId: string,
    windowDays: number
  ): Promise<Partial<Record<MetricType, number>>> {
    // Simulated platform metrics — production replaces with real API calls
    const base = windowDays * 100;
    return {
      [MetricType.VIEWS]:       base * 12,
      [MetricType.WATCH_TIME]:  base * 8,     // minutes
      [MetricType.CTR]:         4.2,           // %
      [MetricType.RETENTION]:   52,            // %
      [MetricType.LIKES]:       base * 0.8,
      [MetricType.COMMENTS]:    base * 0.05,
      [MetricType.SHARES]:      base * 0.03,
      [MetricType.SUBSCRIBERS]: base * 0.1,
      [MetricType.FOLLOWERS]:   base * 0.1,
      [MetricType.IMPRESSIONS]: base * 40,
      [MetricType.ENGAGEMENT]:  6.5,           // %
      [MetricType.REVENUE]:     base * 0.002,  // USD
      [MetricType.RPM]:         2.5,           // USD/1000 views
      [MetricType.CPM]:         3.8,           // USD/1000 impressions
    };
  }

  public async fetchVideoAnalytics(videoId: string): Promise<Partial<VideoAnalytics>> {
    const retention: RetentionGraph = {
      dataPoints: [
        { secondMark: 0,  retentionPercent: 100 },
        { secondMark: 10, retentionPercent: 82 },
        { secondMark: 30, retentionPercent: 68 },
        { secondMark: 60, retentionPercent: 55 },
        { secondMark: 90, retentionPercent: 48 },
        { secondMark: 120,retentionPercent: 40 },
      ],
      dropPoints:         [18, 45],
      spikePoints:        [32, 78],
      averageRetention:   52,
      retentionAt30s:     68,
      retentionAtMidpoint: 48,
    };

    const trafficSources: TrafficSource[] = [
      { source: "Suggested",     viewPercent: 42, views: 5040, ctrPercent: 5.2 },
      { source: "Search",        viewPercent: 28, views: 3360, ctrPercent: 6.8 },
      { source: "External",      viewPercent: 18, views: 2160, ctrPercent: 3.1 },
      { source: "Direct",        viewPercent: 12, views: 1440, ctrPercent: 4.0 },
    ];

    return {
      videoId,
      title:                    "Auto-fetched title",
      durationSeconds:          480,
      publishedAt:              new Date(Date.now() - 7 * 86_400_000),
      peakConcurrentViewers:    120,
      clickThroughRate:         4.2,
      averageViewDurationSeconds: 250,
      averageViewedPercent:     52,
      retentionGraph:           retention,
      trafficSources,
      topCountries:             [{ country: "IN", viewPercent: 38 }, { country: "US", viewPercent: 22 }],
      topAgeGroups:             [{ range: "18-24", viewPercent: 45 }, { range: "25-34", viewPercent: 30 }],
      genderSplit:              { male: 68, female: 28, other: 4 },
    };
  }

  public async fetchAudienceAnalytics(_videoId: string): Promise<Partial<AudienceAnalytics>> {
    return {
      totalUniqueViewers:       9800,
      returningViewers:         3200,
      newViewers:               6600,
      subscriberViewPercent:    32,
      bestDaysOfWeek:           ["Saturday", "Sunday", "Friday"],
      bestHoursOfDay:           [18, 19, 20, 21],
      interestCategories:       ["Technology", "AI", "Education"],
      deviceSplit:              { mobile: 62, desktop: 28, tablet: 7, tv: 3 },
    };
  }
}

class YouTubeProvider   extends BasePlatformProvider { constructor() { super(AnalyticsPlatform.YOUTUBE); } }
class InstagramProvider extends BasePlatformProvider { constructor() { super(AnalyticsPlatform.INSTAGRAM); } }
class TikTokProvider    extends BasePlatformProvider { constructor() { super(AnalyticsPlatform.TIKTOK); } }
class FacebookProvider  extends BasePlatformProvider { constructor() { super(AnalyticsPlatform.FACEBOOK); } }
class XProvider         extends BasePlatformProvider { constructor() { super(AnalyticsPlatform.X); } }
class LinkedInProvider  extends BasePlatformProvider { constructor() { super(AnalyticsPlatform.LINKEDIN); } }
class RumbleProvider    extends BasePlatformProvider { constructor() { super(AnalyticsPlatform.RUMBLE); } }
class CustomProvider    extends BasePlatformProvider { constructor() { super(AnalyticsPlatform.CUSTOM); } }

// ─── Default Metric Collector ─────────────────────────────────────────────────

class DefaultMetricCollector implements IMetricCollector {
  public async collect(
    request: AnalyticsRequest,
    provider: IAnalyticsProvider
  ): Promise<PlatformAnalytics> {
    const windowDays = request.options?.collectionWindowDays ?? 7;

    const [rawMetrics, videoPartial, audiencePartial] = await Promise.all([
      provider.fetchMetrics(request.platformVideoId, windowDays),
      provider.fetchVideoAnalytics(request.platformVideoId),
      provider.fetchAudienceAnalytics(request.platformVideoId),
    ]);

    const normalizedMetrics = this.normalize(rawMetrics, request.platform);

    return {
      platform:            request.platform,
      platformVideoId:     request.platformVideoId,
      publishedUrl:        this._buildUrl(request.platform, request.platformVideoId),
      rawMetrics,
      normalizedMetrics,
      collectedAt:         new Date(),
      collectionWindowDays: windowDays,
    };
  }

  public normalize(
    raw: Partial<Record<MetricType, number>>,
    _platform: AnalyticsPlatform
  ): NormalizedMetrics {
    return {
      views:                   raw[MetricType.VIEWS]       ?? 0,
      watchTimeMinutes:        raw[MetricType.WATCH_TIME]  ?? 0,
      ctrPercent:              Math.min(raw[MetricType.CTR] ?? 0, 100),
      averageRetentionPercent: Math.min(raw[MetricType.RETENTION] ?? 0, 100),
      likes:                   raw[MetricType.LIKES]       ?? 0,
      comments:                raw[MetricType.COMMENTS]    ?? 0,
      shares:                  raw[MetricType.SHARES]      ?? 0,
      subscribersGained:       raw[MetricType.SUBSCRIBERS] ?? 0,
      followersGained:         raw[MetricType.FOLLOWERS]   ?? 0,
      revenueUsd:              raw[MetricType.REVENUE]     ?? 0,
      rpmUsd:                  raw[MetricType.RPM]         ?? 0,
      cpmUsd:                  raw[MetricType.CPM]         ?? 0,
      impressions:             raw[MetricType.IMPRESSIONS] ?? 0,
      engagementRate:          Math.min(raw[MetricType.ENGAGEMENT] ?? 0, 100),
    };
  }

  private _buildUrl(platform: AnalyticsPlatform, videoId: string): string {
    const map: Partial<Record<AnalyticsPlatform, string>> = {
      [AnalyticsPlatform.YOUTUBE]:   `https://www.youtube.com/watch?v=${videoId}`,
      [AnalyticsPlatform.INSTAGRAM]: `https://www.instagram.com/reel/${videoId}/`,
      [AnalyticsPlatform.TIKTOK]:    `https://www.tiktok.com/@user/video/${videoId}`,
      [AnalyticsPlatform.FACEBOOK]:  `https://www.facebook.com/watch/?v=${videoId}`,
      [AnalyticsPlatform.X]:         `https://x.com/i/status/${videoId}`,
      [AnalyticsPlatform.LINKEDIN]:  `https://www.linkedin.com/feed/update/urn:li:video:${videoId}`,
      [AnalyticsPlatform.RUMBLE]:    `https://rumble.com/v${videoId}.html`,
    };
    return map[platform] ?? `https://custom-platform.example.com/video/${videoId}`;
  }
}

// ─── Default Performance Analyzer ─────────────────────────────────────────────

class DefaultPerformanceAnalyzer implements IPerformanceAnalyzer {
  public analyze(
    metrics: NormalizedMetrics,
    videoAnalytics: VideoAnalytics,
    engagement: EngagementMetrics,
    revenue: RevenueMetrics
  ): PerformanceScore {
    // Hook score: based on 30s retention
    const hookScore = Math.min(videoAnalytics.retentionGraph?.retentionAt30s ?? 60, 100);

    // Retention score: average retention
    const retentionScore = Math.min(metrics.averageRetentionPercent, 100);

    // CTR score: scale 0–10% CTR to 0–100
    const ctrScore = Math.min(metrics.ctrPercent * 10, 100);

    // Engagement score: directly 0–100
    const engagementScore = Math.min(engagement.overallEngagement, 100);

    // Growth score: subscriber gain normalized
    const growthScore = Math.min((metrics.subscribersGained / Math.max(metrics.views, 1)) * 10000, 100);

    // Revenue score: RPM normalized to 0–100 ($20 RPM = 100)
    const revenueScore = Math.min((revenue.rpmUsd / 20) * 100, 100);

    // Reach score: impressions normalized
    const reachScore = Math.min((metrics.impressions / 100_000) * 100, 100);

    // Weighted overall
    const overall = Math.round(
      hookScore       * 0.20 +
      retentionScore  * 0.25 +
      ctrScore        * 0.20 +
      engagementScore * 0.15 +
      growthScore     * 0.10 +
      revenueScore    * 0.05 +
      reachScore      * 0.05
    );

    // Classify performance level
    const level = this._classify(overall);

    // Identify weak and strong points
    const weakPoints: string[] = [];
    const strongPoints: string[] = [];

    if (hookScore < 50)       weakPoints.push("Hook is weak — high early drop-off before 30s");
    if (ctrScore < 40)        weakPoints.push("Low CTR — thumbnail or title needs improvement");
    if (retentionScore < 40)  weakPoints.push("Poor retention — audience leaving too early");
    if (engagementScore < 30) weakPoints.push("Low engagement — calls to action are ineffective");
    if (growthScore < 20)     weakPoints.push("Minimal subscriber growth from this video");

    if (hookScore > 75)       strongPoints.push("Strong hook — high early retention past 30s");
    if (ctrScore > 60)        strongPoints.push("Excellent CTR — compelling thumbnail/title");
    if (retentionScore > 60)  strongPoints.push("High average retention");
    if (engagementScore > 60) strongPoints.push("Strong engagement from viewers");
    if (revenueScore > 50)    strongPoints.push("Above-average revenue per 1000 views");

    return {
      overall,
      hook:        Math.round(hookScore),
      retention:   Math.round(retentionScore),
      engagement:  Math.round(engagementScore),
      ctr:         Math.round(ctrScore),
      growth:      Math.round(growthScore),
      revenue:     Math.round(revenueScore),
      reach:       Math.round(reachScore),
      level,
      weakPoints,
      strongPoints,
    };
  }

  public computeEngagement(metrics: NormalizedMetrics): EngagementMetrics {
    const views = Math.max(metrics.views, 1);
    const likeRate    = (metrics.likes    / views) * 100;
    const commentRate = (metrics.comments / views) * 100;
    const shareRate   = (metrics.shares   / views) * 100;
    const overall     = Math.min((likeRate * 0.5 + commentRate * 2 + shareRate * 3) * 10, 100);

    return {
      likeRate:         Math.round(likeRate * 100) / 100,
      commentRate:      Math.round(commentRate * 100) / 100,
      shareRate:        Math.round(shareRate * 100) / 100,
      overallEngagement: Math.round(overall),
      sentimentScore:   0.78, // mock
      commentThemes:    ["great video", "learned a lot", "more content like this"],
      communityBoost:   commentRate > 0.5,
    };
  }

  public computeRevenue(metrics: NormalizedMetrics): RevenueMetrics {
    const views = Math.max(metrics.views, 1);
    return {
      totalRevenueUsd:               metrics.revenueUsd,
      rpmUsd:                        metrics.rpmUsd,
      cpmUsd:                        metrics.cpmUsd,
      adImpressions:                 metrics.impressions,
      estimatedMonetizedPlaybacks:   Math.floor(metrics.views * 0.6),
      membershipRevenue:             0,
      superChatRevenue:              0,
      merchandiseRevenue:            0,
      revenuePerView:                metrics.revenueUsd / views,
    };
  }

  private _classify(score: number): PerformanceLevel {
    if (score >= 85) return PerformanceLevel.EXCELLENT;
    if (score >= 70) return PerformanceLevel.HIGH;
    if (score >= 55) return PerformanceLevel.GOOD;
    if (score >= 40) return PerformanceLevel.AVERAGE;
    if (score >= 25) return PerformanceLevel.LOW;
    return PerformanceLevel.VERY_LOW;
  }
}

// ─── Default Recommendation Engine ───────────────────────────────────────────

class DefaultRecommendationEngine implements IRecommendationEngine {
  public generate(
    score: PerformanceScore,
    videoAnalytics: VideoAnalytics,
    metrics: NormalizedMetrics,
    _platform: AnalyticsPlatform
  ): AnalyticsRecommendation[] {
    const recs: AnalyticsRecommendation[] = [];
    let idxCounter = 1;

    const make = (
      type: RecommendationType,
      priority: AnalyticsRecommendation["priority"],
      title: string,
      description: string,
      impact: number,
      metric: MetricType,
      evidence: string,
      action: string,
      parameters: Record<string, unknown> = {}
    ): AnalyticsRecommendation => ({
      id:                   `rec-${type.toLowerCase()}-${idxCounter++}`,
      type,
      priority,
      title,
      description,
      expectedImpactPercent: impact,
      targetMetric:          metric,
      evidence,
      action,
      parameters,
    });

    // Hook recommendation
    if (score.hook < 60) {
      recs.push(make(
        RecommendationType.HOOK,
        score.hook < 40 ? "CRITICAL" : "HIGH",
        "Strengthen your video hook",
        "Viewers are dropping off within the first 30 seconds. A stronger hook dramatically improves retention.",
        25,
        MetricType.RETENTION,
        `Retention at 30s is ${score.hook}% (target: 70%+). Drop point detected at second ${videoAnalytics.retentionGraph?.dropPoints?.[0] ?? 18}.`,
        "REWRITE_HOOK",
        { targetRetentionAt30s: 70, dropPoint: videoAnalytics.retentionGraph?.dropPoints?.[0] ?? 18 }
      ));
    }

    // CTR/Thumbnail recommendation
    if (metrics.ctrPercent < 4) {
      recs.push(make(
        RecommendationType.THUMBNAIL,
        "HIGH",
        "Redesign thumbnail for higher CTR",
        "Your click-through rate is below average. A stronger thumbnail can double your views from the same impressions.",
        40,
        MetricType.CTR,
        `Current CTR: ${metrics.ctrPercent.toFixed(1)}%. Channel average is typically 4–6%.`,
        "REDESIGN_THUMBNAIL",
        { currentCtr: metrics.ctrPercent, targetCtr: 5.0, style: "high-contrast-face" }
      ));
    }

    // Title/SEO recommendation
    if (metrics.ctrPercent < 3.5) {
      recs.push(make(
        RecommendationType.TITLE,
        "HIGH",
        "Optimize video title for search",
        "Your title may not match what your audience is searching for. Use high-volume keywords.",
        20,
        MetricType.IMPRESSIONS,
        `CTR of ${metrics.ctrPercent.toFixed(1)}% suggests title is not enticing to potential viewers.`,
        "REWRITE_TITLE",
        { includeKeywords: true, maxLength: 60 }
      ));
    }

    // Retention / pace recommendation
    if (score.retention < 45) {
      recs.push(make(
        RecommendationType.PACE,
        "HIGH",
        "Improve video pacing",
        "Viewers are leaving before the midpoint. Tighten editing and remove slow sections.",
        30,
        MetricType.WATCH_TIME,
        `Average retention: ${metrics.averageRetentionPercent}%. Drop detected at ${videoAnalytics.retentionGraph?.dropPoints?.join("s, ")}s.`,
        "TIGHTEN_EDIT",
        { maxLengthSeconds: 480, removeSections: videoAnalytics.retentionGraph?.dropPoints }
      ));
    }

    // Posting time recommendation
    if (score.reach < 40) {
      recs.push(make(
        RecommendationType.POSTING_TIME,
        "MEDIUM",
        "Publish at peak audience hours",
        "Your video may have missed the optimal upload window. Audience is most active in evenings.",
        15,
        MetricType.VIEWS,
        `Impression-to-view ratio suggests the algorithm did not distribute content at peak hours.`,
        "RESCHEDULE_UPLOAD",
        { recommendedHours: [18, 19, 20], recommendedDays: ["Saturday", "Sunday", "Friday"] }
      ));
    }

    // CTA recommendation
    if (score.growth < 30) {
      recs.push(make(
        RecommendationType.CTA,
        "MEDIUM",
        "Add a stronger subscribe call-to-action",
        "Subscriber conversion from this video is low. Add a direct CTA at the 60% mark.",
        18,
        MetricType.SUBSCRIBERS,
        `Subscriber conversion rate: ${(metrics.subscribersGained / Math.max(metrics.views, 1) * 100).toFixed(2)}%.`,
        "ADD_CTA",
        { insertAtPercent: 60, style: "direct-subscribe" }
      ));
    }

    // Script recommendation
    if (score.hook < 50 && score.retention < 50) {
      recs.push(make(
        RecommendationType.SCRIPT,
        "MEDIUM",
        "Restructure script with AIDA framework",
        "Both hook and retention are weak. A restructured script (Attention, Interest, Desire, Action) can improve both.",
        22,
        MetricType.WATCH_TIME,
        `Hook score: ${score.hook}, Retention score: ${score.retention}. Both below 50.`,
        "RESTRUCTURE_SCRIPT",
        { framework: "AIDA", hookDurationSeconds: 15 }
      ));
    }

    // SEO recommendation
    recs.push(make(
      RecommendationType.SEO,
      "LOW",
      "Improve tags and keywords",
      "Adding trending long-tail keywords to tags can increase search-driven impressions.",
      12,
      MetricType.IMPRESSIONS,
      `Search traffic accounts for ${videoAnalytics.trafficSources?.find(s => s.source === "Search")?.viewPercent ?? 0}% of views.`,
      "UPDATE_TAGS",
      { addLongTailKeywords: true, maxTags: 30 }
    ));

    return recs;
  }
}

// ─── Default Benchmark Engine ─────────────────────────────────────────────────

class DefaultBenchmarkEngine implements IBenchmarkEngine {
  public compare(
    metrics: NormalizedMetrics,
    history: AnalyticsResponse[]
  ): BenchmarkComparison {
    // Build channel averages from history
    const channelAvg: Partial<NormalizedMetrics> = {};
    if (history.length > 0) {
      const allMetrics = history.map((r) => r.platformAnalytics.normalizedMetrics);
      channelAvg.views = Math.round(
        allMetrics.reduce((s, m) => s + m.views, 0) / allMetrics.length
      );
      channelAvg.ctrPercent = Math.round(
        (allMetrics.reduce((s, m) => s + m.ctrPercent, 0) / allMetrics.length) * 10
      ) / 10;
      channelAvg.averageRetentionPercent = Math.round(
        allMetrics.reduce((s, m) => s + m.averageRetentionPercent, 0) / allMetrics.length
      );
    } else {
      channelAvg.views                   = 8000;
      channelAvg.ctrPercent              = 3.8;
      channelAvg.averageRetentionPercent = 45;
    }

    // Top-10 average (mock above-channel baseline)
    const top10Average: Partial<NormalizedMetrics> = {
      views:                   (channelAvg.views ?? 0) * 2.5,
      ctrPercent:              (channelAvg.ctrPercent ?? 0) * 1.4,
      averageRetentionPercent: (channelAvg.averageRetentionPercent ?? 0) * 1.3,
    };

    // Delta vs channel average
    const vsChannelAverage: Partial<Record<keyof NormalizedMetrics, number>> = {};
    if (channelAvg.views && channelAvg.views > 0) {
      vsChannelAverage.views = Math.round(((metrics.views - channelAvg.views) / channelAvg.views) * 100);
    }
    if (channelAvg.ctrPercent && channelAvg.ctrPercent > 0) {
      vsChannelAverage.ctrPercent = Math.round(((metrics.ctrPercent - channelAvg.ctrPercent) / channelAvg.ctrPercent) * 100);
    }

    // Rank among history (1 = best by views)
    const sortedByViews = [...history].sort(
      (a, b) => b.platformAnalytics.normalizedMetrics.views - a.platformAnalytics.normalizedMetrics.views
    );
    const rank = sortedByViews.findIndex(
      (r) => r.platformAnalytics.normalizedMetrics.views <= metrics.views
    );

    return {
      channelAverage:  channelAvg,
      top10Average,
      vsChannelAverage,
      bestTopic:       "AI / Technology",
      bestThumbnailStyle: "high-contrast-face-red-background",
      bestUploadDay:   "Saturday",
      bestUploadHour:  19,
      channelRank:     rank >= 0 ? rank + 1 : history.length + 1,
    };
  }
}

// ─── Default Learning Engine ──────────────────────────────────────────────────

class DefaultLearningEngine implements ILearningEngine {
  public async learn(
    response: AnalyticsResponse,
    context: Record<string, unknown>
  ): Promise<LearningUpdate> {
    const updatedEngines: string[] = [];
    const insights = this._extractInsights(response);

    // Research Engine: update trending scores
    if (context?.researchEngine) {
      try {
        const eng = context.researchEngine as any;
        if (eng?.updateTrends) {
          await eng.updateTrends({
            analyticsId: response.id,
            platform:    response.platform,
            score:       response.performanceScore.overall,
            insights,
          });
        }
        updatedEngines.push("researchEngine");
      } catch (_) {}
    }

    // Strategy Engine: update content calendar priorities
    if (context?.strategyEngine) {
      try {
        const eng = context.strategyEngine as any;
        if (eng?.updatePriorities) {
          await eng.updatePriorities({
            analyticsId:     response.id,
            performanceLevel: response.performanceScore.level,
            bestPostingTime: { day: "Saturday", hour: 19 },
          });
        }
        updatedEngines.push("strategyEngine");
      } catch (_) {}
    }

    // Script Engine: update from hook/retention insights
    if (context?.scriptEngine) {
      try {
        const eng = context.scriptEngine as any;
        if (eng?.learnFromAnalytics) {
          await eng.learnFromAnalytics({
            hookScore:       response.performanceScore.hook,
            retentionScore:  response.performanceScore.retention,
            dropPoints:      response.videoAnalytics.retentionGraph?.dropPoints ?? [],
            recommendations: response.recommendations.filter(
              (r) => r.type === RecommendationType.HOOK || r.type === RecommendationType.SCRIPT
            ),
          });
        }
        updatedEngines.push("scriptEngine");
      } catch (_) {}
    }

    // Channel Engine: update channel knowledge
    if (context?.channelEngine) {
      try {
        const eng = context.channelEngine as any;
        if (eng?.updateChannelInsights) {
          await eng.updateChannelInsights({
            analyticsId:         response.id,
            bestThumbnailStyle:  response.benchmark?.bestThumbnailStyle,
            bestUploadDay:       response.benchmark?.bestUploadDay,
            bestUploadHour:      response.benchmark?.bestUploadHour,
            audienceInterests:   response.audienceAnalytics.interestCategories ?? [],
          });
        }
        updatedEngines.push("channelEngine");
      } catch (_) {}
    }

    // Decision Engine: reward/penalize decisions
    if (context?.registry) {
      try {
        const token = { name: "IDecisionEngine" } as any;
        if ((context.registry as any).has?.(token)) {
          const decisionEngine = (context.registry as any).resolve?.(token) as any;
          if (decisionEngine?.record) {
            await decisionEngine.record({
              analyticsId:      response.id,
              platform:         response.platform,
              overallScore:     response.performanceScore.overall,
              performanceLevel: response.performanceScore.level,
              weakPoints:       response.performanceScore.weakPoints,
              strongPoints:     response.performanceScore.strongPoints,
              views:            response.platformAnalytics.normalizedMetrics.views,
              ctr:              response.platformAnalytics.normalizedMetrics.ctrPercent,
              retention:        response.platformAnalytics.normalizedMetrics.averageRetentionPercent,
            });
          }
        }
        updatedEngines.push("decisionEngine");
      } catch (_) {}
    }

    return {
      analyticsId:    response.id,
      platform:       response.platform,
      triggeredAt:    new Date(),
      updatedEngines,
      insights,
      applied:        updatedEngines.length > 0,
    };
  }

  private _extractInsights(response: AnalyticsResponse) {
    const insights = [];
    const score = response.performanceScore;

    if (score.hook >= 70) {
      insights.push({
        type:            RecommendationType.HOOK,
        description:     "Strong hook pattern detected — high 30s retention",
        confidence:      0.85,
        winningPattern:  "open-with-question-or-shocking-stat",
        targetEngine:    "scriptEngine",
        parameters:      { retentionAt30s: score.hook },
      });
    } else {
      insights.push({
        type:            RecommendationType.HOOK,
        description:     "Weak hook — early audience loss",
        confidence:      0.80,
        losingPattern:   "slow-intro-no-promise",
        targetEngine:    "scriptEngine",
        parameters:      { retentionAt30s: score.hook, improve: true },
      });
    }

    if (score.ctr >= 60) {
      insights.push({
        type:            RecommendationType.THUMBNAIL,
        description:     "Thumbnail style is driving strong CTR",
        confidence:      0.78,
        winningPattern:  "high-contrast-face-text-overlay",
        targetEngine:    "channelEngine",
        parameters:      { ctr: response.platformAnalytics.normalizedMetrics.ctrPercent },
      });
    }

    for (const rec of response.recommendations) {
      if (rec.priority === "CRITICAL" || rec.priority === "HIGH") {
        insights.push({
          type:         rec.type,
          description:  rec.description,
          confidence:   0.75,
          losingPattern: rec.action,
          targetEngine: "researchEngine",
          parameters:   rec.parameters,
        });
      }
    }

    return insights;
  }
}

// ─── Analytics Engine ─────────────────────────────────────────────────────────

export class AnalyticsEngine implements IAnalyticsEngine {
  private _state = AnalyticsState.CREATED;
  private readonly _requests  = new Map<string, AnalyticsRequest>();
  private readonly _responses = new Map<string, AnalyticsResponse>();
  private readonly _snapshots = new Map<string, AnalyticsSnapshot>();
  private readonly _reports   = new Map<string, AnalyticsReport>();
  private readonly _history: AnalyticsResponse[] = [];

  private readonly _collector:       IMetricCollector;
  private readonly _analyzer:        IPerformanceAnalyzer;
  private readonly _recommender:     IRecommendationEngine;
  private readonly _benchmark:       IBenchmarkEngine;
  private readonly _learner:         ILearningEngine;
  private readonly _providerRegistry: ProviderRegistry;

  constructor(
    public readonly context: any,
    public readonly configuration?: any,
    public readonly metadata: Record<string, unknown> = {},
    collector?: IMetricCollector,
    analyzer?: IPerformanceAnalyzer,
    recommender?: IRecommendationEngine,
    benchmark?: IBenchmarkEngine,
    learner?: ILearningEngine,
    extraProviders?: IAnalyticsProvider[]
  ) {
    this._collector   = collector   || new DefaultMetricCollector();
    this._analyzer    = analyzer    || new DefaultPerformanceAnalyzer();
    this._recommender = recommender || new DefaultRecommendationEngine();
    this._benchmark   = benchmark   || new DefaultBenchmarkEngine();
    this._learner     = learner     || new DefaultLearningEngine();

    const builtIn: IAnalyticsProvider[] = [
      new YouTubeProvider(),
      new InstagramProvider(),
      new TikTokProvider(),
      new FacebookProvider(),
      new XProvider(),
      new LinkedInProvider(),
      new RumbleProvider(),
      new CustomProvider(),
    ];
    this._providerRegistry = new ProviderRegistry([
      ...builtIn,
      ...(extraProviders ?? []),
    ]);
  }

  public get state(): AnalyticsState {
    return this._state;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    AnalyticsValidator.validateStateTransition("engine", this._state, AnalyticsState.INITIALIZED);
    this._state = AnalyticsState.INITIALIZED;
  }

  public async start(): Promise<void> {
    this._state = AnalyticsState.COLLECTING;
  }

  public async stop(): Promise<void> {
    this._state = AnalyticsState.CANCELLED;
  }

  public async cancel(analyticsId: string): Promise<void> {
    if (!this._responses.has(analyticsId) && !this._requests.has(analyticsId)) {
      throw new AnalyticsException(`Analytics job "${analyticsId}" not found.`);
    }
    this._state = AnalyticsState.CANCELLED;
    await this._publishEvent("AnalyticsFailed", analyticsId, { reason: "Cancelled by caller" });
  }

  public getReport(analyticsId: string): AnalyticsReport {
    const r = this._reports.get(analyticsId);
    if (!r) throw new AnalyticsException(`No report found for analytics job "${analyticsId}".`);
    return r;
  }

  public getSnapshot(analyticsId: string): AnalyticsSnapshot {
    const s = this._snapshots.get(analyticsId);
    if (!s) throw new AnalyticsException(`No snapshot found for analytics job "${analyticsId}".`);
    return s;
  }

  public getHistory(): AnalyticsResponse[] {
    return [...this._history];
  }

  // ─── Core Analyze Method ────────────────────────────────────────────────────

  public async analyze(request: AnalyticsRequest): Promise<AnalyticsResponse> {
    // ── Validate ────────────────────────────────────────────────────────────
    AnalyticsValidator.validateRequest(request);

    if (this._requests.has(request.id)) {
      throw new DuplicateAnalyticsException(request.id);
    }
    this._requests.set(request.id, request);

    await this._publishEvent("AnalyticsStarted", request.id, {
      publishingId:    request.publishingId,
      platform:        request.platform,
      platformVideoId: request.platformVideoId,
    });

    // ── Phase 1: Collect ─────────────────────────────────────────────────────
    this._state = AnalyticsState.COLLECTING;
    const provider = this._providerRegistry.route(request.platform);
    const platformAnalytics = await this._collector.collect(request, provider);

    await this._publishEvent("MetricsCollected", request.id, {
      platform:    request.platform,
      views:       platformAnalytics.normalizedMetrics.views,
      ctr:         platformAnalytics.normalizedMetrics.ctrPercent,
      retention:   platformAnalytics.normalizedMetrics.averageRetentionPercent,
    });

    // ── Phase 2: Build Video & Audience Analytics ─────────────────────────────
    this._state = AnalyticsState.PROCESSING;
    const videoPartial   = await provider.fetchVideoAnalytics(request.platformVideoId);
    const audiencePartial = await provider.fetchAudienceAnalytics(request.platformVideoId);

    const videoAnalytics: VideoAnalytics = {
      videoId:                    request.platformVideoId,
      title:                      videoPartial.title ?? "Unknown",
      durationSeconds:            videoPartial.durationSeconds ?? 0,
      publishedAt:                videoPartial.publishedAt ?? new Date(),
      peakConcurrentViewers:      videoPartial.peakConcurrentViewers ?? 0,
      clickThroughRate:           platformAnalytics.normalizedMetrics.ctrPercent,
      averageViewDurationSeconds: videoPartial.averageViewDurationSeconds ?? 0,
      averageViewedPercent:       platformAnalytics.normalizedMetrics.averageRetentionPercent,
      retentionGraph:             videoPartial.retentionGraph ?? {
        dataPoints: [], dropPoints: [], spikePoints: [],
        averageRetention: 0, retentionAt30s: 0, retentionAtMidpoint: 0,
      },
      trafficSources:  videoPartial.trafficSources ?? [],
      topCountries:    videoPartial.topCountries   ?? [],
      topAgeGroups:    videoPartial.topAgeGroups   ?? [],
      genderSplit:     videoPartial.genderSplit    ?? { male: 0, female: 0, other: 0 },
    };

    const audienceAnalytics: AudienceAnalytics = {
      totalUniqueViewers:    audiencePartial.totalUniqueViewers   ?? 0,
      returningViewers:      audiencePartial.returningViewers     ?? 0,
      newViewers:            audiencePartial.newViewers           ?? 0,
      subscriberViewPercent: audiencePartial.subscriberViewPercent ?? 0,
      bestDaysOfWeek:        audiencePartial.bestDaysOfWeek       ?? [],
      bestHoursOfDay:        audiencePartial.bestHoursOfDay       ?? [],
      interestCategories:    audiencePartial.interestCategories   ?? [],
      deviceSplit:           audiencePartial.deviceSplit          ?? {},
    };

    // ── Phase 3: Analyze ─────────────────────────────────────────────────────
    this._state = AnalyticsState.ANALYZING;
    const engagement = this._analyzer.computeEngagement(platformAnalytics.normalizedMetrics);
    const revenue    = this._analyzer.computeRevenue(platformAnalytics.normalizedMetrics);
    const score      = this._analyzer.analyze(
      platformAnalytics.normalizedMetrics, videoAnalytics, engagement, revenue
    );

    AnalyticsValidator.validatePerformanceScore(score);

    await this._publishEvent("PerformanceCalculated", request.id, {
      overall:  score.overall,
      level:    score.level,
      weakPoints: score.weakPoints.length,
    });

    // ── Phase 4: Recommendations ─────────────────────────────────────────────
    const recommendations: AnalyticsRecommendation[] = [];
    if (request.options?.generateRecommendations !== false) {
      const recs = this._recommender.generate(
        score, videoAnalytics, platformAnalytics.normalizedMetrics, request.platform
      );
      AnalyticsValidator.validateRecommendations(recs);
      recommendations.push(...recs);
    }

    for (const rec of recommendations) {
      await this._publishEvent("RecommendationGenerated", request.id, {
        type:     rec.type,
        priority: rec.priority,
        impact:   rec.expectedImpactPercent,
      });
    }

    // ── Phase 5: Benchmark ───────────────────────────────────────────────────
    let benchmark: BenchmarkComparison | undefined;
    if (request.options?.runBenchmark !== false) {
      benchmark = this._benchmark.compare(
        platformAnalytics.normalizedMetrics, this._history
      );
      await this._publishEvent("BenchmarkCompleted", request.id, {
        channelRank: benchmark.channelRank,
        bestDay:     benchmark.bestUploadDay,
      });
    }

    // ── Phase 6: Build partial response for learning ──────────────────────────
    this._state = AnalyticsState.REPORTING;

    const partialResponse: AnalyticsResponse = {
      id:               `analytics-resp-${request.id}`,
      requestId:        request.id,
      state:            AnalyticsState.REPORTING,
      platform:         request.platform,
      platformAnalytics,
      videoAnalytics,
      audienceAnalytics,
      performanceScore: score,
      recommendations,
      benchmark,
      report: {} as AnalyticsReport, // filled below
      snapshot: {} as AnalyticsSnapshot,
      timestamp: new Date(),
    };

    // ── Phase 7: Learning ────────────────────────────────────────────────────
    let learningUpdate: LearningUpdate | undefined;
    if (request.options?.triggerLearning !== false) {
      learningUpdate = await this._learner.learn(partialResponse, this.context ?? {});
      await this._publishEvent("LearningUpdated", request.id, {
        updatedEngines: learningUpdate.updatedEngines,
        insights:       learningUpdate.insights.length,
        applied:        learningUpdate.applied,
      });
    }

    // ── Phase 8: Report & Snapshot ────────────────────────────────────────────
    const report: AnalyticsReport = {
      id:               `report-${request.id}`,
      timestamp:        new Date(),
      requestId:        request.id,
      publishingId:     request.publishingId,
      platform:         request.platform,
      platformVideoId:  request.platformVideoId,
      normalizedMetrics: platformAnalytics.normalizedMetrics,
      videoAnalytics,
      audienceAnalytics,
      engagementMetrics: engagement,
      revenueMetrics:    revenue,
      performanceScore:  score,
      recommendations,
      benchmark,
      learningUpdate,
      warnings: [],
      errors:   [],
    };

    this._state = AnalyticsState.COMPLETED;

    const snapshot: AnalyticsSnapshot = deepFreeze({
      analyticsId:              request.id,
      state:                    this._state,
      platform:                 request.platform,
      platformVideoId:          request.platformVideoId,
      overallScore:             score.overall,
      performanceLevel:         score.level,
      views:                    platformAnalytics.normalizedMetrics.views,
      ctrPercent:               platformAnalytics.normalizedMetrics.ctrPercent,
      averageRetentionPercent:  platformAnalytics.normalizedMetrics.averageRetentionPercent,
      recommendationCount:      recommendations.length,
      learningTriggered:        !!learningUpdate?.applied,
      timestamp:                new Date(),
    });

    const response: AnalyticsResponse = {
      ...partialResponse,
      state:         this._state,
      learningUpdate,
      report,
      snapshot,
    };

    this._responses.set(request.id, response);
    this._reports.set(request.id, report);
    this._snapshots.set(request.id, snapshot);
    this._history.push(response);

    // ── Memory Integration ───────────────────────────────────────────────────
    if (this.context?.memoryStore) {
      const store = this.context.memoryStore;
      await store.set("analytics-history", `analytics:${request.id}`, response, {
        platform: request.platform,
        score:    score.overall,
      });
      await store.set("video-performance", `perf:${request.platformVideoId}`, {
        score:   score.overall,
        level:   score.level,
        metrics: platformAnalytics.normalizedMetrics,
      });
      await store.set("recommendations", `recs:${request.id}`,
        recommendations.map((r) => ({ type: r.type, impact: r.expectedImpactPercent }))
      );
      if (learningUpdate) {
        await store.set("learning-updates", `learn:${request.id}`, learningUpdate);
      }
    }

    await this._publishEvent("AnalyticsCompleted", request.id, {
      overall:     score.overall,
      level:       score.level,
      recCount:    recommendations.length,
      learned:     !!learningUpdate?.applied,
    });

    return response;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async _publishEvent(
    name: string,
    correlationId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (this.context?.eventBus) {
      try {
        await this.context.eventBus.publish({
          id:           `evt-${name.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`,
          name,
          timestamp:    new Date(),
          correlationId,
          source:       "AnalyticsEngine",
          payload,
          metadata:     {},
        });
      } catch (_) {}
    }
  }
}
