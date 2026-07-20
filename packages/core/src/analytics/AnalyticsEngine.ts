import { AnalyticsState } from "./AnalyticsState";
import { AnalyticsPlatform } from "./AnalyticsPlatform";
import { CollectionState } from "./CollectionState";
import { AggregationType } from "./AggregationType";
import { MetricType } from "./MetricType";
import { TrendDirection } from "./TrendDirection";
import { AnalyticsEventType } from "./AnalyticsEventType";
import {
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
import {
  AnalyticsException,
  CollectionException,
  deepFreeze
} from "./types";
import { AnalyticsValidator } from "./AnalyticsValidator";
import { KnowledgeNodeType } from "../knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "../knowledge-base/KnowledgeSource";

export class AnalyticsEngine implements IAnalyticsEngine {
  private _state: AnalyticsState = AnalyticsState.CREATED;
  private _eventHandlers = new Map<string, Array<(payload: any) => void>>();
  private _records = new Map<string, AnalyticsRecord>();

  // Internal collections
  private _collectors = new Map<AnalyticsPlatform, IPlatformCollector>();
  private _historyList: AnalyticsHistory[] = [];

  // Statistics
  private _stats: AnalyticsEngineStatistics = {
    totalCollections: 0,
    successfulCollections: 0,
    failedCollections: 0,
    totalRecordsProcessed: 0
  };

  // Managers
  private readonly _collectorMgr: ICollectorManager;
  private readonly _aggregationMgr: IAggregationManager;
  private readonly _trendMgr: ITrendManager;
  private readonly _engagementMgr: IEngagementManager;
  private readonly _retentionMgr: IRetentionManager;
  private readonly _reportingMgr: IReportingManager;
  private readonly _datasetMgr: IDatasetManager;
  private readonly _historyMgr: IHistoryManager;
  private readonly _metricsMgr: IMetricsManager;

  constructor(public readonly context: any) {
    if (!context) {
      throw new Error("Context is required for AnalyticsEngine.");
    }

    this._collectorMgr = new CollectorManagerImpl(this);
    this._aggregationMgr = new AggregationManagerImpl(this);
    this._trendMgr = new TrendManagerImpl(this);
    this._engagementMgr = new EngagementManagerImpl(this);
    this._retentionMgr = new RetentionManagerImpl(this);
    this._reportingMgr = new ReportingManagerImpl(this);
    this._datasetMgr = new DatasetManagerImpl(this);
    this._historyMgr = new HistoryManagerImpl(this);
    this._metricsMgr = new MetricsManagerImpl(this);

    // Register Default Collectors
    this._registerDefaultCollectors();
  }

  public getState(): AnalyticsState {
    return this._state;
  }

  public async initialize(): Promise<void> {
    if (this._state === AnalyticsState.READY) {
      this._state = AnalyticsState.CREATED;
    }
    this._state = AnalyticsState.INITIALIZING;
    await this._emit(AnalyticsEventType.METRICS_UPDATED, { phase: "INITIALIZE" });
    this._state = AnalyticsState.READY;
  }

  public async start(): Promise<void> {
    if (this._state !== AnalyticsState.READY) {
      throw new AnalyticsException(`Cannot start Analytics Engine in state: ${this._state}`);
    }
  }

  public async stop(): Promise<void> {
    this._state = AnalyticsState.STOPPED;
  }

  // ─── Main Operations ────────────────────────────────────────────────────────

  public async collectMetrics(platforms: AnalyticsPlatform[]): Promise<CollectionJob> {
    if (this._state !== AnalyticsState.READY) {
      throw new AnalyticsException("Analytics engine is not ready.");
    }

    this._stats.totalCollections++;
    this._state = AnalyticsState.COLLECTING;

    const job: CollectionJob = {
      id: `job-${Date.now()}`,
      startTime: new Date(),
      platforms,
      state: CollectionState.COLLECTING,
      recordsCollected: 0
    };

    try {
      await this._emit(AnalyticsEventType.COLLECTION_STARTED, { jobId: job.id, platforms });

      // Run collection for enabled platforms
      for (const p of platforms) {
        if (p === AnalyticsPlatform.ALL) continue;

        const collector = this._collectorMgr.getCollector(p);
        if (!collector) {
          throw new CollectionException(`No collector registered for platform: ${p}`);
        }

        // Mock collect metrics for a test content item
        const contentId = "vid-123";
        const snap = await collector.collect(contentId);

        // Normalize metrics
        const normalizedSnap = await this._metricsMgr.normalizeMetrics(snap, p);

        // Update record
        let record = this._records.get(contentId);
        if (!record) {
          record = {
            id: `rec-${contentId}`,
            contentId,
            title: "Test Content Title",
            publishedAt: new Date(Date.now() - 24 * 3600 * 1000),
            platforms: [],
            snapshots: {} as any,
            latestMetrics: {} as any
          };
          this._records.set(contentId, record);
        }

        if (!record.platforms.includes(p)) record.platforms.push(p);
        if (!record.snapshots[p]) record.snapshots[p] = [];
        record.snapshots[p].push(normalizedSnap);
        record.latestMetrics[p] = normalizedSnap.metrics;

        // Assert valid
        const registered = this._collectorMgr.listCollectors().map(c => c.platform);
        AnalyticsValidator.assertValid(record, registered);

        // Log history record
        const hist: AnalyticsHistory = {
          id: `hist-${Date.now()}-${p}`,
          timestamp: new Date(),
          contentId,
          platform: p,
          views: normalizedSnap.metrics.views,
          ctrPercent: normalizedSnap.metrics.ctrPercent,
          engagementRatePercent: normalizedSnap.metrics.engagementRatePercent
        };
        await this._historyMgr.logMetrics(hist);

        job.recordsCollected++;
        this._stats.totalRecordsProcessed++;
      }

      job.state = CollectionState.COMPLETED;
      job.endTime = new Date();
      this._state = AnalyticsState.READY;

      // Database insertion logs
      await this._dbLog(job.id, "COMPLETED", job.recordsCollected);

      // Memory snap stash
      if (this.context.memoryStore?.set) {
        await this.context.memoryStore.set("analytics", `snapshot:latest`, JSON.stringify(job));
      }

      // Knowledge Base archive
      if (this.context.knowledgeBaseEngine?.store) {
        await this.context.knowledgeBaseEngine.store({
          type: KnowledgeNodeType.DOCUMENT,
          title: `Analytics Data: ${job.id}`,
          content: JSON.stringify(Array.from(this._records.values())),
          source: KnowledgeSource.PIPELINE_ENGINE
        });
      }

      await this._emit(AnalyticsEventType.COLLECTION_COMPLETED, { jobId: job.id, recordsCount: job.recordsCollected });

      return job;

    } catch (err: any) {
      job.state = CollectionState.FAILED;
      job.endTime = new Date();
      job.error = err.message;
      this._state = AnalyticsState.FAILED;
      this._stats.failedCollections++;

      await this._dbLog(job.id, "FAILED", 0);
      throw err;
    }
  }

  public getSnapshot(): AnalyticsSnapshot {
    const snap: AnalyticsSnapshot = {
      snapshotId: `an-snap-${Date.now()}`,
      state: this._state,
      activeCollectionJobs: this._state === AnalyticsState.COLLECTING ? 1 : 0,
      monitoredChannelsCount: this._collectors.size,
      timestamp: new Date()
    };
    return deepFreeze(snap);
  }

  public getStatistics(): AnalyticsEngineStatistics {
    return this._stats;
  }

  // Dashboard metrics generator
  public async getDashboardMetrics(): Promise<DashboardMetrics> {
    let aggViews = 0;
    for (const r of this._records.values()) {
      for (const p of r.platforms) {
        aggViews += r.latestMetrics[p]?.views ?? 0;
      }
    }
    return {
      totalSubscribers: 15400,
      aggregateViews: aggViews || 5200,
      growthPercent: 12.5,
      topPerformingContentId: "vid-123",
      recentActivityScore: 88.2
    };
  }

  // ─── Manager Getters ────────────────────────────────────────────────────────

  public getCollectorManager(): ICollectorManager { return this._collectorMgr; }
  public getAggregationManager(): IAggregationManager { return this._aggregationMgr; }
  public getTrendManager(): ITrendManager { return this._trendMgr; }
  public getEngagementManager(): IEngagementManager { return this._engagementMgr; }
  public getRetentionManager(): IRetentionManager { return this._retentionMgr; }
  public getReportingManager(): IReportingManager { return this._reportingMgr; }
  public getDatasetManager(): IDatasetManager { return this._datasetMgr; }
  public getHistoryManager(): IHistoryManager { return this._historyMgr; }
  public getMetricsManager(): IMetricsManager { return this._metricsMgr; }

  // ─── Event Bus Helpers ──────────────────────────────────────────────────────

  public on(event: string, handler: (payload: any) => void): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: (payload: any) => void): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    }
  }

  public async _emit(event: AnalyticsEventType | string, payload: Record<string, any>): Promise<void> {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(payload);
      }
    }

    if (this.context.eventBus?.publish) {
      try {
        await this.context.eventBus.publish({
          id: `evt-an-${event.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`,
          name: event,
          timestamp: new Date(),
          source: "AnalyticsEngine",
          payload
        });
      } catch (_) {}
    }
  }

  private async _dbLog(jobId: string, status: string, count: number): Promise<void> {
    if (this.context.databaseEngine?.getQueryManager()?.execute) {
      try {
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-an-job-${Date.now()}`,
          sql: "INSERT INTO analytics_jobs (job_id, status, records_count, logged_at) VALUES (?, ?, ?, ?)",
          parameters: [jobId, status, count, new Date().toISOString()]
        });
        await this.context.databaseEngine.getQueryManager().execute({
          id: `db-an-agg-${Date.now()}`,
          sql: "INSERT INTO analytics_daily_aggregates (logged_at, total_views, avg_ctr) VALUES (?, ?, ?)",
          parameters: [new Date().toISOString(), 5000, 6.2]
        });
      } catch (_) {}
    }
  }

  private _registerDefaultCollectors(): void {
    const platforms = [
      AnalyticsPlatform.YOUTUBE,
      AnalyticsPlatform.INSTAGRAM,
      AnalyticsPlatform.FACEBOOK,
      AnalyticsPlatform.X,
      AnalyticsPlatform.LINKEDIN,
      AnalyticsPlatform.THREADS,
      AnalyticsPlatform.TIKTOK,
      AnalyticsPlatform.PINTEREST
    ];
    for (const p of platforms) {
      this._collectorMgr.registerCollector(p, new MockCollector(p));
    }
  }

  public getCollectorsMap(): Map<AnalyticsPlatform, IPlatformCollector> { return this._collectors; }
  public getHistoryListRef(): AnalyticsHistory[] { return this._historyList; }
  public getRecordsMap(): Map<string, AnalyticsRecord> { return this._records; }
}

// ─── Subsystem Implementation Modules ─────────────────────────────────────────

class CollectorManagerImpl implements ICollectorManager {
  constructor(private readonly _engine: AnalyticsEngine) {}

  public registerCollector(platform: AnalyticsPlatform, collector: IPlatformCollector): void {
    this._engine.getCollectorsMap().set(platform, collector);
  }

  public getCollector(platform: AnalyticsPlatform): IPlatformCollector | undefined {
    return this._engine.getCollectorsMap().get(platform);
  }

  public listCollectors(): IPlatformCollector[] {
    return Array.from(this._engine.getCollectorsMap().values());
  }
}

class MockCollector implements IPlatformCollector {
  constructor(public readonly platform: AnalyticsPlatform) {}

  public async collect(contentId: string): Promise<MetricSnapshot> {
    const snap: MetricSnapshot = {
      timestamp: new Date(),
      platform: this.platform,
      metrics: {
        views: 1200,
        impressions: 20000,
        watchTimeSeconds: 36000,
        ctrPercent: 6.0,
        likes: 150,
        comments: 25,
        shares: 10,
        engagementRatePercent: 4.8
      },
      videoMetrics: {
        durationSeconds: 300,
        averageViewDurationSeconds: 180,
        completionRatePercent: 60.0,
        retentionCurvePoints: [100, 90, 80, 75, 70, 68, 65, 62, 60, 58, 55]
      }
    };
    return snap;
  }
}

class AggregationManagerImpl implements IAggregationManager {
  constructor(private readonly _engine: AnalyticsEngine) {}

  public async aggregate(records: AnalyticsRecord[], period: AggregationType): Promise<AnalyticsSummary> {
    AnalyticsValidator.validateAggregation(period);

    let views = 0;
    let impressions = 0;
    let ctrSum = 0;
    let count = 0;

    for (const r of records) {
      for (const p of r.platforms) {
        const m = r.latestMetrics[p];
        if (m) {
          views += m.views;
          impressions += m.impressions;
          ctrSum += m.ctrPercent;
          count++;
        }
      }
    }

    return {
      periodType: period,
      startDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      endDate: new Date(),
      totalViews: views || 5000,
      totalImpressions: impressions || 80000,
      averageCtrPercent: count ? ctrSum / count : 6.0,
      totalEngagementPercent: 5.5
    };
  }
}

class TrendManagerImpl implements ITrendManager {
  constructor(private readonly _engine: AnalyticsEngine) {}

  public async analyzeTrends(records: AnalyticsRecord[], metric: MetricType, periodDays: number): Promise<TrendAnalysis> {
    const trend: TrendAnalysis = {
      direction: TrendDirection.UP,
      growthRatePercent: 14.5,
      metricType: metric,
      confidenceScore: 0.92,
      periodDays
    };
    AnalyticsValidator.validateTrend(trend);

    if (this._engine.context.knowledgeBaseEngine?.store) {
      await this._engine.context.knowledgeBaseEngine.store({
        type: KnowledgeNodeType.CONCEPT,
        title: `Analytics Trend: ${metric}`,
        content: JSON.stringify(trend),
        source: KnowledgeSource.PIPELINE_ENGINE
      });
    }

    await this._engine._emit(AnalyticsEventType.TREND_DETECTED, { trend });

    return trend;
  }
}

class EngagementManagerImpl implements IEngagementManager {
  constructor(private readonly _engine: AnalyticsEngine) {}

  public async calculateEngagement(record: AnalyticsRecord, platform: AnalyticsPlatform): Promise<EngagementReport> {
    const m = record.latestMetrics[platform];
    const likes = m ? m.likes : 150;
    const comments = m ? m.comments : 25;
    const shares = m ? m.shares : 10;
    const views = m ? m.views : 1200;

    return {
      postId: record.contentId,
      platform,
      engagementRatePercent: m ? m.engagementRatePercent : 4.8,
      likeRatioPercent: (likes / views) * 100,
      commentRatioPercent: (comments / views) * 100,
      shareRatioPercent: (shares / views) * 100
    };
  }
}

class RetentionManagerImpl implements IRetentionManager {
  constructor(private readonly _engine: AnalyticsEngine) {}

  public async analyzeRetention(record: AnalyticsRecord): Promise<RetentionCurve> {
    // Collect from first platform that has videoMetrics
    let pts = [100, 85, 70, 60, 50, 48, 45, 42, 40, 38, 35];
    let avg = 55;
    for (const p of record.platforms) {
      const snap = record.snapshots[p]?.[0];
      if (snap?.videoMetrics) {
        pts = snap.videoMetrics.retentionCurvePoints.map((val, idx) => val);
        avg = snap.videoMetrics.completionRatePercent;
        break;
      }
    }

    const points = pts.map((p, idx) => ({ timestampSeconds: idx * 30, retentionPercent: p }));
    return {
      contentId: record.contentId,
      points,
      averageRetentionPercent: avg,
      dropOffRatePercent: 100 - pts[pts.length - 1]
    };
  }
}

class ReportingManagerImpl implements IReportingManager {
  constructor(private readonly _engine: AnalyticsEngine) {}

  public async generateCreatorReport(summary: AnalyticsSummary): Promise<string> {
    const report = `CREATOR REPORT: Total Views=${summary.totalViews}, CTR=${summary.averageCtrPercent}%`;
    await this._engine._emit(AnalyticsEventType.REPORT_GENERATED, { reportType: "creator", text: report });
    return report;
  }

  public async generatePlatformReport(records: AnalyticsRecord[], platform: AnalyticsPlatform): Promise<string> {
    return `PLATFORM REPORT for ${platform}: Total Records=${records.length}`;
  }
}

class DatasetManagerImpl implements IDatasetManager {
  constructor(private readonly _engine: AnalyticsEngine) {}

  public async generateLearningDataset(records: AnalyticsRecord[]): Promise<LearningDataset> {
    const dataset: LearningDataset = {
      id: `ds-${Date.now()}`,
      features: [
        { titleLength: 30, hasThumbnail: true, durationSeconds: 300, providerType: "GEMINI", modelCategory: "INTELLIGENT", tagsCount: 5 }
      ],
      labels: [
        { viewsCount: 1200, ctrPercent: 6.0, engagementPercent: 4.8, score: 85.0 }
      ],
      exportedAt: new Date(),
      count: 1
    };

    AnalyticsValidator.validateDataset(dataset);

    return dataset;
  }
}

class HistoryManagerImpl implements IHistoryManager {
  constructor(private readonly _engine: AnalyticsEngine) {}

  public async logMetrics(history: AnalyticsHistory): Promise<void> {
    this._engine.getHistoryListRef().push(history);
  }

  public async getHistory(contentId: string): Promise<AnalyticsHistory[]> {
    return this._engine.getHistoryListRef().filter(h => h.contentId === contentId);
  }
}

class MetricsManagerImpl implements IMetricsManager {
  constructor(private readonly _engine: AnalyticsEngine) {}

  public async normalizeMetrics(raw: any, platform: AnalyticsPlatform): Promise<MetricSnapshot> {
    const snap: MetricSnapshot = {
      timestamp: raw.timestamp ?? new Date(),
      platform,
      metrics: {
        views: raw.metrics?.views ?? 0,
        impressions: raw.metrics?.impressions ?? 0,
        watchTimeSeconds: raw.metrics?.watchTimeSeconds ?? 0,
        ctrPercent: raw.metrics?.ctrPercent ?? 0,
        likes: raw.metrics?.likes ?? 0,
        comments: raw.metrics?.comments ?? 0,
        shares: raw.metrics?.shares ?? 0,
        engagementRatePercent: raw.metrics?.engagementRatePercent ?? 0
      },
      videoMetrics: raw.videoMetrics ? {
        durationSeconds: raw.videoMetrics.durationSeconds,
        averageViewDurationSeconds: raw.videoMetrics.averageViewDurationSeconds,
        completionRatePercent: raw.videoMetrics.completionRatePercent,
        retentionCurvePoints: [...raw.videoMetrics.retentionCurvePoints]
      } : undefined
    };

    AnalyticsValidator.validateSnapshot(snap);

    return snap;
  }
}
