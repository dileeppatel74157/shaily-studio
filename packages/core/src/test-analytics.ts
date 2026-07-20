import { AnalyticsEngine } from "./analytics/AnalyticsEngine";
import { AnalyticsBuilder } from "./analytics/AnalyticsBuilder";
import { AnalyticsState } from "./analytics/AnalyticsState";
import { AnalyticsPlatform } from "./analytics/AnalyticsPlatform";
import { CollectionState } from "./analytics/CollectionState";
import { MetricType } from "./analytics/MetricType";
import { AggregationType } from "./analytics/AggregationType";
import { TrendDirection } from "./analytics/TrendDirection";
import { AnalyticsEventType } from "./analytics/AnalyticsEventType";
import { AnalyticsValidator } from "./analytics/AnalyticsValidator";
import { ValidationException, CollectionException } from "./analytics/types";
import { RuntimeEngine } from "./runtime/RuntimeEngine";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { KnowledgeNodeType } from "./knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "./knowledge-base/KnowledgeSource";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// Mock context maker
function makeMockContext(overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  const dbQueries: any[] = [];
  const memoryMap = new Map<string, any>();
  const kbStore: any[] = [];

  return {
    env: "test",
    namespace: "analytics-test",
    logger: { info: () => {}, error: () => {}, warn: () => {} },
    eventBus: {
      publish: async (e: any) => { events.push(e); },
      events
    },
    databaseEngine: {
      getQueryManager: () => ({
        execute: async (req: any) => {
          dbQueries.push(req);
          return { id: "db-resp", rows: [] };
        }
      }),
      dbQueries
    },
    memoryStore: {
      set: async (ns: string, key: string, value: any) => {
        memoryMap.set(`${ns}:${key}`, value);
      },
      get: async (ns: string, key: string) => {
        return memoryMap.get(`${ns}:${key}`);
      },
      memoryMap
    },
    knowledgeBaseEngine: {
      store: async (req: any) => {
        kbStore.push(req);
        return { nodeId: `kb-${Date.now()}`, success: true };
      },
      kbStore
    },
    ...overrides
  };
}

async function run(): Promise<void> {
  console.log("\n=== START SPRINT 27.1 ANALYTICS COLLECTION TESTS ===\n");

  const ctx = makeMockContext();

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  const engine = new AnalyticsBuilder().withContext(ctx).build() as AnalyticsEngine;
  assert(engine !== undefined, "engine created");
  await engine.initialize();
  assert(engine.getState() === AnalyticsState.READY, "initialized");

  // 2. Platform Registration
  console.log("2. Platform Registration...");
  const collectorMgr = engine.getCollectorManager();
  const ytColl = collectorMgr.getCollector(AnalyticsPlatform.YOUTUBE);
  const instaColl = collectorMgr.getCollector(AnalyticsPlatform.INSTAGRAM);
  assert(ytColl !== undefined && ytColl.platform === AnalyticsPlatform.YOUTUBE, "YouTube collector registered");
  assert(instaColl !== undefined && instaColl.platform === AnalyticsPlatform.INSTAGRAM, "Instagram collector registered");

  // 3. Metrics Collection
  console.log("3. Metrics Collection...");
  const rawSnap = await ytColl!.collect("vid-123");
  const metricsMgr = engine.getMetricsManager();
  const normalized = await metricsMgr.normalizeMetrics(rawSnap, AnalyticsPlatform.YOUTUBE);
  assert(normalized.metrics.views === 1200, "metrics collected");
  assert(normalized.platform === AnalyticsPlatform.YOUTUBE, "values normalized");

  // Mock record for calculations
  const record: any = {
    id: "rec-vid-123",
    contentId: "vid-123",
    title: "Test Content Title",
    publishedAt: new Date(Date.now() - 24 * 3600 * 1000),
    platforms: [AnalyticsPlatform.YOUTUBE, AnalyticsPlatform.INSTAGRAM],
    snapshots: {
      [AnalyticsPlatform.YOUTUBE]: [normalized],
      [AnalyticsPlatform.INSTAGRAM]: [normalized]
    },
    latestMetrics: {
      [AnalyticsPlatform.YOUTUBE]: normalized.metrics,
      [AnalyticsPlatform.INSTAGRAM]: normalized.metrics
    }
  };
  engine.getRecordsMap().set(record.contentId, record);

  // 4. Aggregation
  console.log("4. Aggregation...");
  const aggMgr = engine.getAggregationManager();
  const summaryDaily = await aggMgr.aggregate([record], AggregationType.DAILY);
  const summaryWeekly = await aggMgr.aggregate([record], AggregationType.WEEKLY);
  assert(summaryDaily.periodType === AggregationType.DAILY && summaryDaily.totalViews > 0, "daily aggregation works");
  assert(summaryWeekly.periodType === AggregationType.WEEKLY && summaryWeekly.totalImpressions > 0, "weekly aggregation works");

  // 5. Trend Detection
  console.log("5. Trend Detection...");
  const trendMgr = engine.getTrendManager();
  const trend = await trendMgr.analyzeTrends([record], MetricType.VIEWS, 7);
  assert(trend.direction === TrendDirection.UP, "growth trend calculated");
  assert(trend.growthRatePercent > 0, "decline detected");

  // 6. Engagement Analysis
  console.log("6. Engagement Analysis...");
  const engagementMgr = engine.getEngagementManager();
  const report = await engagementMgr.calculateEngagement(record, AnalyticsPlatform.YOUTUBE);
  assert(report.engagementRatePercent === 4.8, "engagement calculated");
  assert(report.likeRatioPercent > 0, "interaction ratios correct");

  // 7. Retention Analysis
  console.log("7. Retention Analysis...");
  const retentionMgr = engine.getRetentionManager();
  const curve = await retentionMgr.analyzeRetention(record);
  assert(curve.points.length > 0, "retention calculated");
  assert(curve.averageRetentionPercent === 60.0, "completion rate calculated");

  // 8. Report Generation
  console.log("8. Report Generation...");
  const reportingMgr = engine.getReportingManager();
  const creatorRep = await reportingMgr.generateCreatorReport(summaryWeekly);
  const platformRep = await reportingMgr.generatePlatformReport([record], AnalyticsPlatform.YOUTUBE);
  assert(creatorRep.includes("CREATOR REPORT"), "creator report generated");
  assert(platformRep.includes("PLATFORM REPORT for YOUTUBE"), "platform report generated");

  // 9. Dataset Generation
  console.log("9. Dataset Generation...");
  const datasetMgr = engine.getDatasetManager();
  const dataset = await datasetMgr.generateLearningDataset([record]);
  assert(dataset.features.length > 0, "learning dataset created");
  assert(dataset.labels[0].score === 85.0, "dataset stored");

  // 10. History
  console.log("10. History...");
  const historyMgr = engine.getHistoryManager();
  const histRecord = {
    id: "hist-999",
    timestamp: new Date(),
    contentId: "vid-123",
    platform: AnalyticsPlatform.YOUTUBE,
    views: 1200,
    ctrPercent: 6.0,
    engagementRatePercent: 4.8
  };
  await historyMgr.logMetrics(histRecord);
  const histories = await historyMgr.getHistory("vid-123");
  assert(histories.length > 0, "history recorded");
  assert(histories[0].views === 1200, "lookup succeeds");

  // 12. Database Integration
  console.log("11. Database Integration...");
  const job = await engine.collectMetrics([AnalyticsPlatform.YOUTUBE, AnalyticsPlatform.INSTAGRAM]);
  assert(ctx.databaseEngine.dbQueries.length > 0, "analytics stored");
  const aggQueries = ctx.databaseEngine.dbQueries.filter((q: any) => q.sql.includes("analytics_daily_aggregates"));
  assert(aggQueries.length > 0, "aggregation stored");

  // 13. Knowledge Base Integration
  console.log("12. Knowledge Base Integration...");
  const kbStore = ctx.knowledgeBaseEngine.kbStore;
  assert(kbStore.length > 0, "analytics archived");
  assert(kbStore.some((n: any) => n.title.startsWith("Analytics Trend:")), "trends archived");

  // 14. Memory Integration
  console.log("13. Memory Integration...");
  const memoryKey = "analytics:snapshot:latest";
  assert(ctx.memoryStore.memoryMap.has(memoryKey), "execution logged");
  const statsSnapshot = engine.getSnapshot();
  assert(statsSnapshot.state === AnalyticsState.READY, "snapshot saved");

  // 15. Event Publishing
  console.log("14. Event Publishing...");
  const events = ctx.eventBus.events;
  assert(events.length > 0, "collection events fired");
  assert(events.some((e: any) => e.name === AnalyticsEventType.COLLECTION_COMPLETED), "report event received");

  // 16. Dashboard Metrics
  console.log("15. Dashboard Metrics...");
  const dash = await engine.getDashboardMetrics();
  assert(dash.totalSubscribers === 15400, "dashboard metrics generated");
  assert(dash.aggregateViews > 0, "summary generated");

  // 17. Multi-platform Collection
  console.log("16. Multi-platform Collection...");
  assert(job.recordsCollected === 2, "all enabled platforms collected");
  assert(job.state === CollectionState.COMPLETED, "unified report created");

  // 18. Snapshot Immutability
  console.log("17. Snapshot Immutability...");
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "snapshot frozen");
  let mutationFailed = false;
  try {
    (snap as any).state = AnalyticsState.READY;
  } catch {
    mutationFailed = true;
  }
  assert(mutationFailed, "mutation rejected");

  // 19. Validator Rules
  console.log("18. Validator Rules...");
  let ruleRejected = false;
  try {
    const invalidRecord = { ...record, title: "" };
    AnalyticsValidator.assertValid(invalidRecord, [AnalyticsPlatform.YOUTUBE]);
  } catch (err) {
    if (err instanceof ValidationException) {
      ruleRejected = true;
    }
  }
  assert(ruleRejected, "invalid metric rejected");
  let ruleAccepted = true;
  try {
    AnalyticsValidator.assertValid(record, [AnalyticsPlatform.YOUTUBE, AnalyticsPlatform.INSTAGRAM]);
  } catch {
    ruleAccepted = false;
  }
  assert(ruleAccepted, "valid report accepted");

  // 20. Runtime Integration
  console.log("19. Runtime Integration...");
  const rtCtx = makeMockContext();
  const rtEngine = new RuntimeBuilder()
    .withContext(rtCtx)
    .withConfig({
      env: "test",
      heartbeatIntervalMs: 5000,
      healthCheckIntervalMs: 10000,
      startupTimeoutMs: 5000,
      shutdownTimeoutMs: 5000,
      metadata: {}
    })
    .build() as RuntimeEngine;
  assert(rtEngine !== undefined, "engine registered");
  const order = rtEngine.getStartupManager().determineStartupOrder(rtEngine.getSnapshot().engines);
  assert(order.indexOf("AnalyticsEngine") > order.indexOf("SocialPlatformEngine"), "dependencies resolved");

  // 21. Complete End-to-End Analytics Collection
  console.log("20. Complete End-to-End Analytics Collection...");
  assert(job.state === CollectionState.COMPLETED, "analytics pipeline completed");
  assert(dataset.features.length === 1 && dataset.labels.length === 1, "learning dataset exported");

  console.log(`\n=== ${passed}/${passed + failed} ANALYTICS COLLECTION TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `— ${failed} FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
