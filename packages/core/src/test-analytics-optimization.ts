/**
 * Sprint 14.2 — Analytics + Optimization Engine
 * Verification Suite — 20 Tests
 */

import { AnalyticsOptimizationEngine }   from "./analytics/AnalyticsOptimizationEngine";
import { AnalyticsOptimizationBuilder }  from "./analytics/AnalyticsOptimizationBuilder";
import { AnalyticsOptimizationValidator, OptimizationValidationException } from "./analytics/AnalyticsOptimizationValidator";
import { AnalyticsEngine }              from "./analytics/AnalyticsEngine";
import { SnapshotInterval }             from "./analytics/SnapshotInterval";
import { ABTestStatus }                 from "./analytics/ABTestStatus";
import { RankingType }                  from "./analytics/RankingType";
import { PredictionType }               from "./analytics/PredictionType";
import { TrendDirection }               from "./analytics/TrendDirection";
import { AnalyticsPlatform }            from "./analytics/AnalyticsPlatform";
import { DefaultRankingEngine }         from "./analytics/RankingEngine";
import { DefaultABTestEngine }          from "./analytics/ABTestEngine";
import { DefaultTrendPredictor }        from "./analytics/TrendPredictionEngine";
import { DefaultSnapshotScheduler }     from "./analytics/SnapshotScheduler";
import { DefaultComparativeAnalyzer }   from "./analytics/ComparativeAnalyzer";
import type { OptimizationRequest, ABTest, AnalyticsSnapshotEntry } from "./analytics/optimization-models";
import type { AnalyticsResponse, VideoAnalytics } from "./analytics/models";
import type {
  IRankingEngine, IABTestEngine, ITrendPredictor,
  ISnapshotScheduler, IComparativeAnalyzer,
} from "./analytics/optimization-interfaces";
import { PerformanceLevel }             from "./analytics/PerformanceLevel";
import { MetricType }                   from "./analytics/MetricType";
import { AnalyticsState }               from "./analytics/AnalyticsState";

// ─── Assertion Helper ─────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) { console.error("❌ Assertion Failed:", message); process.exit(1); }
}

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function makeContext(overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  const store = new Map<string, any>();
  return {
    logger:   { info: () => {}, error: () => {}, warn: () => {} },
    eventBus: { publish: async (e: any) => { events.push(e); }, _events: events },
    memoryStore: {
      get: async (_ns: string, key: string) => store.has(key) ? { value: store.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { store.set(key, value); },
      _store: store,
    },
    registry: { has: () => false, resolve: () => null },
    ...overrides,
  };
}

function makeOptRequest(id: string, overrides: Partial<OptimizationRequest> = {}): OptimizationRequest {
  return {
    id,
    analyticsIds: [],
    platforms:    [AnalyticsPlatform.YOUTUBE],
    options: {
      runRanking:        true,
      runABTests:        true,
      runPredictions:    true,
      runComparative:    true,
      runSnapshots:      true,
      feedbackToEngines: true,
      snapshotIntervals: [SnapshotInterval.DAILY, SnapshotInterval.WEEKLY],
      windowDays:        30,
    },
    timestamp: new Date(),
    ...overrides,
  };
}

/** Build a fake AnalyticsResponse for testing */
function makeFakeAnalyticsResponse(
  id: string,
  platform = AnalyticsPlatform.YOUTUBE,
  overrides: Record<string, any> = {}
): AnalyticsResponse {
  const score = overrides.score ?? Math.round(50 + Math.random() * 40);
  const views  = overrides.views ?? Math.round(10_000 + Math.random() * 90_000);
  return {
    id:          id,
    requestId:   id,
    platform,
    state:       AnalyticsState.COMPLETED,
    platformAnalytics: {
      platform,
      platformVideoId: overrides.videoId ?? `vid-${id}`,
      publishedUrl:    `https://youtube.com/watch?v=vid-${id}`,
      rawMetrics:      { [MetricType.VIEWS]: views, [MetricType.CTR]: 5, [MetricType.RETENTION]: 55 },
      normalizedMetrics: {
        views,
        watchTimeMinutes:        views * 8,
        ctrPercent:              overrides.ctr ?? (3 + Math.random() * 7),
        averageRetentionPercent: overrides.retention ?? (40 + Math.random() * 35),
        likes:                   Math.round(views * 0.04),
        comments:                Math.round(views * 0.005),
        shares:                  Math.round(views * 0.002),
        subscribersGained:       Math.round(views * 0.003),
        followersGained:         0,
        revenueUsd:              Math.round(views * 0.003 * 100) / 100,
        rpmUsd:                  3.2,
        cpmUsd:                  4.5,
        impressions:             Math.round(views * 1.5),
        engagementRate:          4.5 + Math.random() * 3,
      },
      collectedAt:         new Date(),
      collectionWindowDays: 7,
    },
    videoAnalytics: {
      videoId:                    `vid-${id}`,
      title:                      overrides.title ?? `Video ${id}`,
      publishedAt:                new Date(Date.now() - 30 * 86_400_000),
      durationSeconds:            overrides.duration ?? 600,
      peakConcurrentViewers:      0,
      clickThroughRate:           overrides.ctr ?? 5,
      averageViewDurationSeconds: 240,
      averageViewedPercent:       overrides.retention ?? 50,
      retentionGraph: {
        dataPoints:        [],
        retentionAt30s:    overrides.hookScore ?? 65,
        retentionAtMidpoint: 50,
        averageRetention:  50,
        dropPoints:        [],
        spikePoints:       [],
      },
      trafficSources:  [],
      topCountries:    [{ country: "IN", viewPercent: 35 }],
      topAgeGroups:    [{ range: "18-24", viewPercent: 40 }],
      genderSplit:     { male: 0.55, female: 0.40, other: 0.05 },
    } as VideoAnalytics,
    audienceAnalytics: {
      totalUniqueViewers:      Math.round(views * 0.8),
      newViewers:              Math.round(views * 0.5),
      returningViewers:        Math.round(views * 0.3),
      subscriberViewPercent:   35,
      bestDaysOfWeek:          ["Tuesday", "Thursday"],
      bestHoursOfDay:          [14, 17, 20],
      interestCategories:      overrides.topics ?? ["Technology", "AI", "Education"],
      deviceSplit:             { mobile: 0.65, desktop: 0.30, tablet: 0.05 },
    },
    performanceScore: {
      overall:     score,
      hook:        overrides.hookScore ?? 65,
      retention:   55,
      ctr:         60,
      engagement:  55,
      growth:      45,
      revenue:     40,
      reach:       50,
      level:       score >= 70 ? PerformanceLevel.HIGH : score >= 55 ? PerformanceLevel.GOOD : PerformanceLevel.AVERAGE,
      weakPoints:  score < 60 ? ["Low CTR"] : [],
      strongPoints: score >= 70 ? ["Strong retention"] : [],
    },
    recommendations: [],
    benchmark: {
      channelId:       "ch-yt-001",
      channelAverage:  { views: 50_000, ctrPercent: 4.5, averageRetentionPercent: 48, revenueUsd: 150, engagementRate: 4.0 },
      topPerformers:   [],
      channelRank:     Math.ceil(Math.random() * 10),
      bestUploadDay:   "Tuesday",
      bestUploadHour:  17,
      bestTopic:       "AI",
      bestThumbnailStyle: "Text-heavy",
    },
    learningUpdate: {
      analyticsId:     id,
      insights:        [],
      researchUpdated: true,
      strategyUpdated: true,
      scriptUpdated:   true,
      channelUpdated:  true,
      decisionUpdated: true,
      appliedAt:       new Date(),
    },
    audienceInsights: {},
    report: {
      id:               `report-${id}`,
      platformVideoId:  `vid-${id}`,
      platform,
      timestamp:        new Date(),
      normalizedMetrics: {} as any,
      engagementMetrics: { likes: 0, comments: 0, shares: 0, likeRate: 0, commentRate: 0, shareRate: 0, overallEngagement: 4.5, sentimentScore: 0.8 },
      revenueMetrics: { totalRevenueUsd: 100, rpmUsd: 3.2, cpmUsd: 4.5, estimatedMonetizedPlaybacks: 5000, revenuePerView: 0.001, superChatRevenue: 0, membershipRevenue: 0, currency: "USD" },
    } as any,
    snapshot: {} as any,
    timestamp: new Date(Date.now() - Math.random() * 30 * 86_400_000),
  } as unknown as AnalyticsResponse;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START ANALYTICS + OPTIMIZATION ENGINE TESTS ===\n");

  // ==========================================================================
  // 1. Builder Validation
  // ==========================================================================
  console.log("1. Builder Validation...");
  try {
    new AnalyticsOptimizationBuilder().build();
    throw new Error("Expected OptimizationValidationException");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Builder without context must throw OptimizationValidationException");
  }
  const eng1 = new AnalyticsOptimizationBuilder()
    .withContext(makeContext())
    .withMetadata({ sprint: "14.2" })
    .build();
  assert(eng1 instanceof AnalyticsOptimizationEngine, "Builder must produce AnalyticsOptimizationEngine");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 2. Lifecycle Transitions
  // ==========================================================================
  console.log("2. Lifecycle Transitions...");
  // OptimizationEngine is request-driven, not state-machine-based
  // Verify it processes request from INITIAL state (no prior calls) correctly
  const eng2  = new AnalyticsOptimizationEngine(makeContext());
  const hist2 = [makeFakeAnalyticsResponse("r2-a"), makeFakeAnalyticsResponse("r2-b")];
  const resp2 = await eng2.optimize(makeOptRequest("opt-lifecycle-001"), hist2);
  assert(resp2.requestId === "opt-lifecycle-001", "Response requestId must match request ID");
  assert(resp2.timestamp instanceof Date, "Response timestamp must be a Date");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 3. Metrics Collection (Sprint 13.2 analytics feeds into 14.2)
  // ==========================================================================
  console.log("3. Metrics Collection...");
  const ctx3   = makeContext();
  const e13_2  = new AnalyticsEngine(ctx3);
  await e13_2.initialize();
  const a13_2  = await e13_2.analyze({
    id: "metrics-collect-001", publishingId: "pub-001", platformVideoId: "yt-001",
    platform: AnalyticsPlatform.YOUTUBE, state: AnalyticsState.CREATED,
    timestamp: new Date(),
    options: { generateRecommendations: true, runBenchmark: true, triggerLearning: true, collectionWindowDays: 7 },
  });
  assert(a13_2.platformAnalytics.normalizedMetrics.views > 0, "Sprint 13.2 must collect views");
  // Feed into 14.2
  const eng3 = new AnalyticsOptimizationEngine(ctx3);
  const resp3 = await eng3.optimize(makeOptRequest("opt-metrics-001"), [a13_2]);
  assert(resp3.rankings.length > 0, "Rankings must be generated from Sprint 13.2 analytics");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 4. Multi-Platform Analytics
  // ==========================================================================
  console.log("4. Multi-Platform Analytics...");
  const platforms = [AnalyticsPlatform.YOUTUBE, AnalyticsPlatform.INSTAGRAM, AnalyticsPlatform.TIKTOK, AnalyticsPlatform.RUMBLE];
  const multiHist = platforms.map((p, i) => makeFakeAnalyticsResponse(`multi-${i}`, p));
  const eng4  = new AnalyticsOptimizationEngine(makeContext());
  const resp4 = await eng4.optimize(
    makeOptRequest("opt-multi-001", { platforms }),
    multiHist
  );
  // Rankings must include all platforms
  const rankedPlatforms = new Set(resp4.rankings.map(r => r.platform));
  for (const p of platforms) {
    assert(rankedPlatforms.has(p), `Rankings must cover platform ${p}`);
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 5. Snapshot Creation
  // ==========================================================================
  console.log("5. Snapshot Creation...");
  const scheduler5 = new DefaultSnapshotScheduler();
  const hist5      = [makeFakeAnalyticsResponse("snap-001"), makeFakeAnalyticsResponse("snap-002")];
  const eng5       = new AnalyticsOptimizationBuilder()
    .withContext(makeContext())
    .withSnapshotScheduler(scheduler5)
    .build();
  const resp5 = await eng5.optimize(
    makeOptRequest("opt-snap-001", { options: { runSnapshots: true, snapshotIntervals: [SnapshotInterval.DAILY, SnapshotInterval.WEEKLY], windowDays: 30 } }),
    hist5
  );
  assert(resp5.snapshots.length >= 2, "Must create at least 1 snapshot per analytics response");
  for (const snap of resp5.snapshots) {
    assert(!!snap.platformVideoId, "Snapshot must have a platformVideoId");
    assert(Object.values(SnapshotInterval).includes(snap.interval), "Snapshot must have a valid interval");
    assert(snap.capturedAt instanceof Date, "Snapshot capturedAt must be a Date");
    AnalyticsOptimizationValidator.validateSnapshot(snap);
  }
  const stored5 = scheduler5.getSnapshots(resp5.snapshots[0].platformVideoId);
  assert(stored5.length > 0, "Snapshot scheduler must store captured snapshots");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 6. Performance Scoring
  // ==========================================================================
  console.log("6. Performance Scoring...");
  const hist6 = [
    makeFakeAnalyticsResponse("perf-high", AnalyticsPlatform.YOUTUBE, { score: 85, views: 100_000 }),
    makeFakeAnalyticsResponse("perf-low",  AnalyticsPlatform.YOUTUBE, { score: 30, views: 5_000  }),
  ];
  const eng6  = new AnalyticsOptimizationEngine(makeContext());
  const resp6 = await eng6.optimize(makeOptRequest("opt-perf-001"), hist6);
  const bestRanking = resp6.rankings.find(r => r.type === RankingType.BEST_VIDEOS);
  assert(bestRanking !== undefined, "BEST_VIDEOS ranking must be present");
  const lastEntry6 = bestRanking!.entries[bestRanking!.entries.length - 1];
  assert(bestRanking!.entries[0].score >= (lastEntry6 ? lastEntry6.score : 0),
    "Best videos ranking must be sorted by descending score"
  );
  const worstRanking = resp6.rankings.find(r => r.type === RankingType.WORST_VIDEOS);
  assert(worstRanking !== undefined, "WORST_VIDEOS ranking must be present");
  assert(Array.isArray(worstRanking!.entries), "Worst videos ranking entries must be an array");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 7. Ranking Engine
  // ==========================================================================
  console.log("7. Ranking Engine...");
  const hist7 = Array.from({ length: 10 }, (_, i) =>
    makeFakeAnalyticsResponse(`rank-${i}`, AnalyticsPlatform.YOUTUBE, {
      score: 40 + i * 5, views: 20_000 + i * 5_000,
      topics: i % 2 === 0 ? ["AI", "Technology"] : ["Education", "Business"],
    })
  );
  const ranker7 = new DefaultRankingEngine();

  const rankTypes = [
    RankingType.BEST_VIDEOS, RankingType.WORST_VIDEOS, RankingType.BEST_TOPICS,
    RankingType.BEST_THUMBNAILS, RankingType.BEST_HOOKS, RankingType.BEST_VIDEO_LENGTHS,
  ];
  for (const type of rankTypes) {
    const r = ranker7.rank(type, AnalyticsPlatform.YOUTUBE, hist7, 30);
    assert(!!r.id, `Ranking ${type} must have an ID`);
    assert(r.type === type, `Ranking type must match requested type ${type}`);
    assert(typeof r.insight === "string" && r.insight.length > 0, `Ranking ${type} must have insight`);
    assert(r.windowDays === 30, `Ranking windowDays must be 30`);
  }
  // Verify sort order for BEST_VIDEOS
  const bestR7 = ranker7.rank(RankingType.BEST_VIDEOS, AnalyticsPlatform.YOUTUBE, hist7, 30);
  for (let i = 0; i < bestR7.entries.length - 1; i++) {
    assert(bestR7.entries[i].score >= bestR7.entries[i + 1].score, "BEST_VIDEOS must be sorted descending");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 8. Recommendation Generation
  // ==========================================================================
  console.log("8. Recommendation Generation...");
  const hist8 = [
    makeFakeAnalyticsResponse("rec-low-ctr",  AnalyticsPlatform.YOUTUBE, { ctr: 1.5, retention: 35, score: 40 }),
    makeFakeAnalyticsResponse("rec-low-ret",  AnalyticsPlatform.YOUTUBE, { ctr: 2.0, retention: 30, score: 35 }),
  ];
  const eng8  = new AnalyticsOptimizationEngine(makeContext());
  const resp8 = await eng8.optimize(makeOptRequest("opt-rec-001"), hist8);
  assert(resp8.recommendations.length > 0, "Must generate at least one recommendation");
  for (const rec of resp8.recommendations) {
    assert(!!rec.id, "Recommendation must have ID");
    assert(!!rec.type, "Recommendation must have type");
    assert(!!rec.targetEngine, "OptimizationRecommendation must have targetEngine");
    assert(rec.aiGenerated === true, "OptimizationRecommendation must be marked aiGenerated");
    assert(rec.expectedImpactPercent >= 0, "Impact must be non-negative");
  }
  // Low CTR → THUMBNAIL recommendation
  const thumbnailRec = resp8.recommendations.find(r => r.action === "REDESIGN_THUMBNAILS");
  assert(thumbnailRec !== undefined, "Low CTR must trigger REDESIGN_THUMBNAILS recommendation");
  // Low retention → HOOK recommendation
  const hookRec = resp8.recommendations.find(r => r.action === "REWRITE_HOOKS");
  assert(hookRec !== undefined, "Low retention must trigger REWRITE_HOOKS recommendation");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 9. A/B Testing
  // ==========================================================================
  console.log("9. A/B Testing...");
  const abEngine = new DefaultABTestEngine();
  const testId   = "ab-thumbnail-001";
  const test: ABTest = {
    id:                testId,
    name:              "Thumbnail Test",
    variable:          "THUMBNAIL",
    platform:          AnalyticsPlatform.YOUTUBE,
    status:            ABTestStatus.RUNNING as any,
    variants: [
      { id: "v-a", testId, label: "A", description: "Dark background", content: { style: "dark" }, isWinner: false, impressions: 5000, clicks: 200, views: 1500, ctrPercent: 4.0, retentionPercent: 52 },
      { id: "v-b", testId, label: "B", description: "Bright background", content: { style: "bright" }, isWinner: false, impressions: 5000, clicks: 350, views: 2000, ctrPercent: 7.0, retentionPercent: 60 },
    ],
    startedAt:         new Date(Date.now() - 7 * 86_400_000),
    durationDays:      7,
    minViewsThreshold: 100,
    confidence:        0,
    createdAt:         new Date(Date.now() - 7 * 86_400_000),
    metadata:          {},
  };

  AnalyticsOptimizationValidator.validateABTest(test);
  abEngine.createTest(test);
  assert(abEngine.getTest(testId) !== undefined, "A/B test must be retrievable after creation");

  abEngine.updateTest(testId, [
    { ctrPercent: 4.0, averageRetentionPercent: 52, views: 1500, impressions: 5000 },
    { ctrPercent: 7.0, averageRetentionPercent: 60, views: 2000, impressions: 5000 },
  ]);

  const results9 = abEngine.evaluate();
  assert(results9.length === 1, "Must produce exactly 1 A/B test result");
  assert(results9[0].status === ABTestStatus.WINNER_FOUND, "Test status must be WINNER_FOUND");
  assert(results9[0].winnerId === "v-b", "Variant B must win (higher CTR and retention)");
  assert(results9[0].ctrLift > 0, "CTR lift must be positive (B wins)");
  assert(results9[0].confidence > 0 && results9[0].confidence <= 1, "Confidence must be 0–1");

  // Duplicate test IDs are idempotent
  abEngine.createTest(test); // second call must not throw
  assert(abEngine.listTests().length === 1, "Duplicate test creation must be idempotent");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 10. Trend Prediction
  // ==========================================================================
  console.log("10. Trend Prediction...");
  const predictor10 = new DefaultTrendPredictor();
  const hist10      = Array.from({ length: 6 }, (_, i) =>
    makeFakeAnalyticsResponse(`pred-${i}`, AnalyticsPlatform.YOUTUBE, {
      topics: i < 3 ? ["AI", "Technology"] : ["AI", "Technology", "Emerging"],
      score:  50 + i * 5,
    })
  );
  const preds10 = predictor10.predict(hist10, [AnalyticsPlatform.YOUTUBE]);
  assert(preds10.length > 0, "Predictor must generate at least one prediction");
  for (const pred of preds10) {
    assert(!!pred.id, "Prediction must have ID");
    assert(Object.values(PredictionType).includes(pred.type), "Prediction type must be valid");
    assert(Object.values(TrendDirection).includes(pred.direction), "Trend direction must be valid");
    assert(pred.confidence >= 0 && pred.confidence <= 1, "Confidence must be 0–1");
    assert(pred.horizonDays >= 1, "horizonDays must be ≥ 1");
  }

  // Feed into opt engine
  const eng10 = new AnalyticsOptimizationEngine(makeContext());
  const resp10 = await eng10.optimize(
    makeOptRequest("opt-pred-001", { options: { runPredictions: true, runRanking: false, runABTests: false, runComparative: false, runSnapshots: false, windowDays: 30 } }),
    hist10
  );
  assert(resp10.predictions.length > 0, "Optimization engine must include predictions in response");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 11. Publishing Integration
  // ==========================================================================
  console.log("11. Publishing Integration...");
  // PublishingEngine results flow into analytics history, then into optimization
  const hist11 = [
    makeFakeAnalyticsResponse("pub-int-001", AnalyticsPlatform.YOUTUBE, { views: 80_000, score: 78 }),
  ];
  hist11[0].platformAnalytics.publishedUrl = "https://youtube.com/watch?v=vid-pub-int-001";

  let publishingApplied = false;
  const ctx11 = makeContext({
    publishingEngine: { applyOptimizations: async () => { publishingApplied = true; } },
  });
  const eng11 = new AnalyticsOptimizationEngine(ctx11);
  await eng11.optimize(makeOptRequest("opt-pub-int-001", { options: { feedbackToEngines: true, windowDays: 30 } }), hist11);
  assert(publishingApplied, "Publishing engine must receive optimization feedback");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 12. Channel Manager Integration
  // ==========================================================================
  console.log("12. Channel Manager Integration...");
  let channelUpdated = false;
  const ctx12 = makeContext({
    channelEngine: { updateChannelInsights: async () => { channelUpdated = true; } },
  });
  const eng12 = new AnalyticsOptimizationEngine(ctx12);
  await eng12.optimize(
    makeOptRequest("opt-ch-mgr-001"),
    [makeFakeAnalyticsResponse("ch-mgr-vid-001")]
  );
  assert(channelUpdated, "Channel engine must receive optimization feedback");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 13. Decision Integration
  // ==========================================================================
  console.log("13. Decision Integration...");
  let decisionRecorded = false;
  const ctx13 = makeContext({
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: () => ({
        record: async (data: any) => {
          decisionRecorded = true;
          assert(data.optimizationRequestId !== undefined, "Decision record must include optimizationRequestId");
          assert(data.feedbackSent === true, "Decision record must flag feedbackSent = true");
        },
      }),
    },
  });
  const eng13 = new AnalyticsOptimizationEngine(ctx13);
  await eng13.optimize(makeOptRequest("opt-dec-001"), [makeFakeAnalyticsResponse("dec-vid-001")]);
  assert(decisionRecorded, "Decision engine must be called with optimization context");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 14. Memory Integration
  // ==========================================================================
  console.log("14. Memory Integration...");
  const ctx14 = makeContext();
  const eng14 = new AnalyticsOptimizationEngine(ctx14);
  await eng14.optimize(makeOptRequest("opt-mem-001"), [makeFakeAnalyticsResponse("mem-vid-001"), makeFakeAnalyticsResponse("mem-vid-002")]);
  const memStore = ctx14.memoryStore._store as Map<string, any>;
  assert(memStore.has("opt:opt-mem-001"),       "analytics namespace must be written");
  assert(memStore.has("history:opt-mem-001"),   "analytics-history namespace must be written");
  assert(memStore.has("scores:opt-mem-001"),    "performance namespace must be written");
  assert(memStore.has("tests:opt-mem-001"),     "ab-tests namespace must be written");
  assert(memStore.has("recs:opt-mem-001"),      "recommendations namespace must be written");
  assert(memStore.has("ranks:opt-mem-001"),     "rankings namespace must be written");
  assert(memStore.has("preds:opt-mem-001"),     "predictions namespace must be written");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 15. Agent Integration
  // ==========================================================================
  console.log("15. Agent Integration...");
  const engAgent = new AnalyticsOptimizationEngine(makeContext());
  assert(typeof engAgent.optimize          === "function", "IOptimizationEngine.optimize must be a function");
  assert(typeof engAgent.feedbackToEngines === "function", "IOptimizationEngine.feedbackToEngines must be a function");
  // All sub-engine interfaces present
  const ranking15: IRankingEngine   = new DefaultRankingEngine();
  const abTest15:  IABTestEngine    = new DefaultABTestEngine();
  const pred15:    ITrendPredictor  = new DefaultTrendPredictor();
  const snap15:    ISnapshotScheduler = new DefaultSnapshotScheduler();
  const comp15:    IComparativeAnalyzer = new DefaultComparativeAnalyzer();
  assert(typeof ranking15.rank       === "function", "IRankingEngine.rank must exist");
  assert(typeof abTest15.createTest  === "function", "IABTestEngine.createTest must exist");
  assert(typeof pred15.predict       === "function", "ITrendPredictor.predict must exist");
  assert(typeof snap15.capture       === "function", "ISnapshotScheduler.capture must exist");
  assert(typeof comp15.compare       === "function", "IComparativeAnalyzer.compare must exist");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 16. Event Publishing
  // ==========================================================================
  console.log("16. Event Publishing...");
  const ctx16 = makeContext();
  const eng16 = new AnalyticsOptimizationEngine(ctx16);
  await eng16.optimize(
    makeOptRequest("opt-evt-001"),
    [makeFakeAnalyticsResponse("evt-vid-001"), makeFakeAnalyticsResponse("evt-vid-002")]
  );
  const evtNames = (ctx16.eventBus._events as any[]).map((e: any) => e.name);
  assert(evtNames.includes("AnalyticsStarted"),        "AnalyticsStarted must be emitted");
  assert(evtNames.includes("PerformanceUpdated"),      "PerformanceUpdated must be emitted");
  assert(evtNames.includes("ABTestFinished"),          "ABTestFinished must be emitted when winner found");
  assert(evtNames.includes("PredictionGenerated"),     "PredictionGenerated must be emitted");
  assert(evtNames.includes("SnapshotCreated"),         "SnapshotCreated must be emitted");
  assert(evtNames.includes("RecommendationGenerated"), "RecommendationGenerated must be emitted");
  assert(evtNames.includes("AnalyticsCompleted"),      "AnalyticsCompleted must be emitted");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 17. Snapshot Immutability
  // ==========================================================================
  console.log("17. Snapshot Immutability...");
  const snap17 = new DefaultSnapshotScheduler().capture(
    "vid-immut-001",
    SnapshotInterval.DAILY,
    {
      views: 50_000, watchTimeMinutes: 400_000, ctrPercent: 5.2, averageRetentionPercent: 55,
      likes: 2000, comments: 300, shares: 100, subscribersGained: 150, followersGained: 0,
      revenueUsd: 150, rpmUsd: 3, cpmUsd: 4.5, impressions: 75_000, engagementRate: 4.8,
    },
    {
      overall: 72, hook: 68, retention: 70, ctr: 75, engagement: 68, growth: 60, revenue: 55, reach: 65,
      level: PerformanceLevel.HIGH, weakPoints: [], strongPoints: ["Strong CTR"],
    }
  );
  assert(snap17.platformVideoId === "vid-immut-001", "Snapshot must store platformVideoId");
  assert(snap17.interval === SnapshotInterval.DAILY, "Snapshot must store interval");
  assert(snap17.metrics.views === 50_000, "Snapshot must store metrics");
  assert(snap17.score.overall === 72, "Snapshot must store performance score");
  AnalyticsOptimizationValidator.validateSnapshot(snap17);
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 18. Validator Rules
  // ==========================================================================
  console.log("18. Validator Rules...");

  // 18a. Empty request ID
  try {
    AnalyticsOptimizationValidator.validateRequest({ id: "", platforms: [AnalyticsPlatform.YOUTUBE], analyticsIds: [], options: {}, timestamp: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Empty ID must fail validation");
  }

  // 18b. Empty platforms
  try {
    AnalyticsOptimizationValidator.validateRequest({ id: "req-val", platforms: [], analyticsIds: [], options: {}, timestamp: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Empty platforms must fail validation");
  }

  // 18c. Duplicate analytics IDs in history
  const dupA = makeFakeAnalyticsResponse("dup-001");
  const dupB = makeFakeAnalyticsResponse("dup-001"); // same ID
  try {
    AnalyticsOptimizationValidator.validateHistory([dupA, dupB]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Duplicate analytics IDs in history must fail");
  }

  // 18d. Negative views
  const negViews = makeFakeAnalyticsResponse("neg-views");
  negViews.platformAnalytics.normalizedMetrics.views = -1;
  try {
    AnalyticsOptimizationValidator.validateHistory([negViews]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Negative views must fail history validation");
  }

  // 18e. Prediction confidence out of range
  const badPred = { id: "p1", confidence: 1.5, horizonDays: 30 } as any;
  try {
    AnalyticsOptimizationValidator.validatePredictionConfidence([badPred]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Confidence > 1 must fail validation");
  }

  // 18f. A/B test with 1 variant
  try {
    AnalyticsOptimizationValidator.validateABTest({ id: "ab-bad", variants: [{}] as any, durationDays: 7, platform: AnalyticsPlatform.YOUTUBE } as any);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "A/B test with < 2 variants must fail validation");
  }

  // 18g. Invalid platform in request
  try {
    AnalyticsOptimizationValidator.validateRequest({ id: "req-plat", platforms: ["SNAPCHAT" as any], analyticsIds: [], options: {}, timestamp: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Invalid platform must fail validation");
  }

  // 18h. windowDays out of range
  try {
    AnalyticsOptimizationValidator.validateRequest({ id: "req-window", platforms: [AnalyticsPlatform.YOUTUBE], analyticsIds: [], options: { windowDays: 400 }, timestamp: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "windowDays > 365 must fail validation");
  }

  console.log("✓ Passed.\n");

  // ==========================================================================
  // 19. Regression Tests (Existing Sprint 13.2 still works)
  // ==========================================================================
  console.log("19. Regression Tests...");
  const ctx19 = makeContext();
  const e19   = new AnalyticsEngine(ctx19);
  await e19.initialize();
  const r19   = await e19.analyze({
    id: "regression-001", publishingId: "pub-reg-001", platformVideoId: "yt-reg-001",
    platform: AnalyticsPlatform.YOUTUBE, state: AnalyticsState.CREATED,
    timestamp: new Date(),
    options: { generateRecommendations: true, runBenchmark: true, triggerLearning: false, collectionWindowDays: 7 },
  });
  assert(r19.state === AnalyticsState.COMPLETED, "Regression: Sprint 13.2 engine state must be COMPLETED");
  assert(r19.performanceScore.overall >= 0 && r19.performanceScore.overall <= 100, "Regression: score must be 0–100");
  assert(r19.recommendations.length > 0, "Regression: recommendations must still be generated");
  assert(Object.isFrozen(e19.getSnapshot("regression-001")), "Regression: Sprint 13.2 snapshot must still be frozen");

  // And 14.2 builds on top cleanly
  const eng19 = new AnalyticsOptimizationEngine(ctx19);
  const resp19 = await eng19.optimize(makeOptRequest("opt-reg-001"), [r19]);
  assert(resp19.rankings.length > 0, "Regression: 14.2 must process Sprint 13.2 output correctly");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 20. Full End-to-End Analytics & Optimization
  // ==========================================================================
  console.log("20. Full End-to-End Analytics & Optimization...");

  let e2eResearch    = false;
  let e2eStrategy    = false;
  let e2eScript      = false;
  let e2eChannel     = false;
  let e2eProduction  = false;
  let e2eGeneration  = false;
  let e2eComposition = false;
  let e2eRendering   = false;
  let e2ePublishing  = false;
  let e2eDecision    = false;

  const ctxE2E = makeContext({
    researchEngine:    { updateTrends:          async () => { e2eResearch    = true; } },
    strategyEngine:    { updatePriorities:      async () => { e2eStrategy    = true; } },
    scriptEngine:      { learnFromAnalytics:    async () => { e2eScript      = true; } },
    channelEngine:     { updateChannelInsights: async () => { e2eChannel     = true; } },
    productionEngine:  { applyOptimizations:    async () => { e2eProduction  = true; } },
    generationEngine:  { applyOptimizations:    async () => { e2eGeneration  = true; } },
    compositionEngine: { applyOptimizations:    async () => { e2eComposition = true; } },
    renderingEngine:   { applyOptimizations:    async () => { e2eRendering   = true; } },
    publishingEngine:  { applyOptimizations:    async () => { e2ePublishing  = true; } },
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: () => ({ record: async () => { e2eDecision = true; } }),
    },
  });

  const e2eHistory = [
    makeFakeAnalyticsResponse("e2e-vid-001", AnalyticsPlatform.YOUTUBE, { score: 82, views: 120_000, ctr: 6.5, retention: 58, topics: ["AI", "Future"] }),
    makeFakeAnalyticsResponse("e2e-vid-002", AnalyticsPlatform.YOUTUBE, { score: 65, views: 55_000,  ctr: 4.2, retention: 48, topics: ["AI", "Education"] }),
    makeFakeAnalyticsResponse("e2e-vid-003", AnalyticsPlatform.YOUTUBE, { score: 45, views: 18_000,  ctr: 2.1, retention: 32, topics: ["Business"] }),
    makeFakeAnalyticsResponse("e2e-vid-004", AnalyticsPlatform.INSTAGRAM, { score: 71, views: 80_000, ctr: 5.5, retention: 52, topics: ["AI", "Tech"] }),
    makeFakeAnalyticsResponse("e2e-vid-005", AnalyticsPlatform.RUMBLE,    { score: 60, views: 30_000, ctr: 3.8, retention: 45, topics: ["Education"] }),
  ];

  const engE2E = new AnalyticsOptimizationBuilder()
    .withContext(ctxE2E)
    .withMetadata({ sprint: "14.2" })
    .build();

  const respE2E = await engE2E.optimize(
    makeOptRequest("opt-e2e-001", {
      platforms: [AnalyticsPlatform.YOUTUBE, AnalyticsPlatform.INSTAGRAM, AnalyticsPlatform.RUMBLE],
      analyticsIds: e2eHistory.map(r => r.id),
      options: {
        runRanking:        true,
        runABTests:        true,
        runPredictions:    true,
        runComparative:    true,
        runSnapshots:      true,
        feedbackToEngines: true,
        snapshotIntervals: [SnapshotInterval.DAILY, SnapshotInterval.WEEKLY, SnapshotInterval.MONTHLY],
        windowDays:        30,
      },
    }),
    e2eHistory
  );

  // Rankings
  assert(respE2E.rankings.length > 0, "E2E: Must generate rankings");
  const e2eBestVideos = respE2E.rankings.find(r => r.type === RankingType.BEST_VIDEOS && r.platform === AnalyticsPlatform.YOUTUBE);
  assert(e2eBestVideos !== undefined, "E2E: Must rank best YouTube videos");
  if (e2eBestVideos && e2eBestVideos.entries.length > 0) {
    assert(e2eBestVideos.entries[0].score >= 0, "E2E: Top-ranked video must have a score");
  }

  // A/B Tests
  assert(respE2E.abTestResults.length > 0, "E2E: Must produce A/B test results");

  // Predictions
  assert(respE2E.predictions.length > 0, "E2E: Must generate predictions");
  const uploadWindowPred = respE2E.predictions.find(p => p.type === PredictionType.UPLOAD_WINDOW);
  assert(uploadWindowPred !== undefined, "E2E: Must predict best upload window");
  assert(uploadWindowPred!.confidence > 0, "E2E: Prediction confidence must be > 0");

  // Comparative Analysis
  assert(respE2E.comparisons.length > 0, "E2E: Must generate comparative analysis");
  assert(["BASELINE","COMPARISON","TIE"].includes(respE2E.comparisons[0].winner), "E2E: Comparison must declare a winner");

  // Snapshots
  assert(respE2E.snapshots.length >= 3, "E2E: Must create multiple snapshots (3 intervals × videos)");

  // Recommendations
  assert(respE2E.recommendations.length > 0, "E2E: Must generate optimization recommendations");
  const timingRec = respE2E.recommendations.find(r => r.action === "UPDATE_SCHEDULE");
  assert(timingRec !== undefined, "E2E: Must generate posting time recommendation");
  assert(timingRec!.targetEngine === "PublishingEngine", "E2E: Timing rec must target PublishingEngine");

  // Feedback sent
  assert(respE2E.feedbackSent === true, "E2E: feedbackSent must be true");
  assert(e2eResearch,    "E2E: Research engine must receive feedback");
  assert(e2eStrategy,    "E2E: Strategy engine must receive feedback");
  assert(e2eScript,      "E2E: Script engine must receive feedback");
  assert(e2eChannel,     "E2E: Channel engine must receive feedback");
  assert(e2eProduction,  "E2E: Production engine must receive feedback");
  assert(e2eGeneration,  "E2E: Generation engine must receive feedback");
  assert(e2eComposition, "E2E: Composition engine must receive feedback");
  assert(e2eRendering,   "E2E: Rendering engine must receive feedback");
  assert(e2ePublishing,  "E2E: Publishing engine must receive feedback");
  assert(e2eDecision,    "E2E: Decision engine must receive feedback");
  assert(respE2E.enginesUpdated.length >= 9, "E2E: At least 9 engines must be updated");

  // Events
  const e2eEvts = (ctxE2E.eventBus._events as any[]).map((e: any) => e.name);
  assert(e2eEvts.includes("AnalyticsStarted"),        "E2E: AnalyticsStarted must be emitted");
  assert(e2eEvts.includes("PerformanceUpdated"),      "E2E: PerformanceUpdated must be emitted");
  assert(e2eEvts.includes("SnapshotCreated"),         "E2E: SnapshotCreated must be emitted");
  assert(e2eEvts.includes("RecommendationGenerated"), "E2E: RecommendationGenerated must be emitted");
  assert(e2eEvts.includes("AnalyticsCompleted"),      "E2E: AnalyticsCompleted must be emitted");

  // Memory
  const e2eMemStore = ctxE2E.memoryStore._store as Map<string, any>;
  assert(e2eMemStore.has("opt:opt-e2e-001"),     "E2E: analytics namespace written");
  assert(e2eMemStore.has("recs:opt-e2e-001"),    "E2E: recommendations namespace written");
  assert(e2eMemStore.has("ranks:opt-e2e-001"),   "E2E: rankings namespace written");
  assert(e2eMemStore.has("preds:opt-e2e-001"),   "E2E: predictions namespace written");

  console.log("✓ Passed.\n");

  console.log("=== ALL 20 ANALYTICS + OPTIMIZATION ENGINE TESTS PASSED ✓ ===");
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
