/**
 * Sprint 13.2 — AI Analytics & Performance Intelligence Engine
 * Verification Suite — 20 Tests
 */

import { AnalyticsEngine }    from "./analytics/AnalyticsEngine";
import { AnalyticsBuilder }   from "./analytics/AnalyticsBuilder";
import { AnalyticsValidator } from "./analytics/AnalyticsValidator";
import { AnalyticsState }     from "./analytics/AnalyticsState";
import { AnalyticsPlatform }  from "./analytics/AnalyticsPlatform";
import { MetricType }         from "./analytics/MetricType";
import { PerformanceLevel }   from "./analytics/PerformanceLevel";
import { RecommendationType } from "./analytics/RecommendationType";
import {
  AnalyticsValidationException,
  DuplicateAnalyticsException,
} from "./analytics/types";
import type {
  AnalyticsRequest,
  NormalizedMetrics,
  AnalyticsRecommendation,
} from "./analytics/models";
import type {
  IAnalyticsProvider,
  IMetricCollector,
  IPerformanceAnalyzer,
  IRecommendationEngine,
  IBenchmarkEngine,
  ILearningEngine,
} from "./analytics/interfaces";

// ─── Assertion Helper ─────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function makeContext(overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  const store = new Map<string, any>();
  return {
    logger: {
      info:  (..._: any[]) => {},
      error: (..._: any[]) => {},
      warn:  (..._: any[]) => {},
    },
    eventBus: {
      publish: async (evt: any) => { events.push(evt); },
      _events: events,
    },
    memoryStore: {
      get: async (_ns: string, key: string) =>
        store.has(key) ? { value: store.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { store.set(key, value); },
      _store: store,
    },
    registry: {
      has:     (_t: any) => false,
      resolve: (_t: any) => null,
    },
    ...overrides,
  };
}

function makeRequest(overrides: Partial<AnalyticsRequest> = {}): AnalyticsRequest {
  return {
    id:              overrides.id              ?? `analytics-req-${Date.now()}`,
    publishingId:    overrides.publishingId    ?? `pub-001`,
    platformVideoId: overrides.platformVideoId ?? `vid-yt-001`,
    platform:        overrides.platform        ?? AnalyticsPlatform.YOUTUBE,
    state:           overrides.state           ?? AnalyticsState.CREATED,
    timestamp:       overrides.timestamp       ?? new Date(),
    options:         overrides.options         ?? {
      generateRecommendations: true,
      runBenchmark:            true,
      triggerLearning:         true,
      collectionWindowDays:    7,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START AI ANALYTICS & PERFORMANCE INTELLIGENCE ENGINE TESTS ===\n");

  // ==========================================================================
  // 1. Builder Validation
  // ==========================================================================
  console.log("1. Builder Validation...");
  try {
    new AnalyticsBuilder().build();
    throw new Error("Expected AnalyticsValidationException");
  } catch (err: unknown) {
    assert(
      err instanceof AnalyticsValidationException,
      "Builder without context must throw AnalyticsValidationException"
    );
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 2. Lifecycle Transitions
  // ==========================================================================
  console.log("2. Lifecycle Transitions...");
  const eng2 = new AnalyticsEngine(makeContext());
  assert(eng2.state === AnalyticsState.CREATED, "Initial state must be CREATED");
  await eng2.initialize();
  assert(eng2.state === AnalyticsState.INITIALIZED, "State after initialize() must be INITIALIZED");
  await eng2.start();
  assert(eng2.state === AnalyticsState.COLLECTING, "State after start() must be COLLECTING");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 3. Provider Routing
  // ==========================================================================
  console.log("3. Provider Routing...");
  const allPlatforms = [
    AnalyticsPlatform.YOUTUBE,
    AnalyticsPlatform.INSTAGRAM,
    AnalyticsPlatform.TIKTOK,
    AnalyticsPlatform.FACEBOOK,
    AnalyticsPlatform.X,
    AnalyticsPlatform.LINKEDIN,
    AnalyticsPlatform.RUMBLE,
    AnalyticsPlatform.CUSTOM,
  ];
  for (const platform of allPlatforms) {
    const eng = new AnalyticsEngine(makeContext());
    await eng.initialize();
    const resp = await eng.analyze(makeRequest({
      id: `route-test-${platform.toLowerCase()}`,
      platform,
    }));
    assert(
      resp.platform === platform,
      `Provider routing must correctly handle platform ${platform}`
    );
    assert(
      resp.platformAnalytics.platform === platform,
      `PlatformAnalytics.platform must match requested platform ${platform}`
    );
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 4. Metric Collection
  // ==========================================================================
  console.log("4. Metric Collection...");
  const eng4 = new AnalyticsEngine(makeContext());
  await eng4.initialize();
  const resp4 = await eng4.analyze(makeRequest({ id: "analytics-004" }));
  assert(
    resp4.platformAnalytics.normalizedMetrics.views > 0,
    "Metric collector must collect a positive view count"
  );
  assert(
    resp4.platformAnalytics.rawMetrics[MetricType.VIEWS] !== undefined,
    "Raw metrics must include VIEWS"
  );
  assert(
    resp4.platformAnalytics.rawMetrics[MetricType.WATCH_TIME] !== undefined,
    "Raw metrics must include WATCH_TIME"
  );
  assert(
    resp4.platformAnalytics.collectedAt instanceof Date,
    "PlatformAnalytics.collectedAt must be a Date"
  );
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 5. Metric Normalization
  // ==========================================================================
  console.log("5. Metric Normalization...");
  let capturedNormalized: NormalizedMetrics | undefined;
  const customCollector: IMetricCollector = {
    collect: async (req, provider) => {
      const raw = await provider.fetchMetrics(req.platformVideoId, 7);
      const normalized = this_normalize(raw);
      capturedNormalized = normalized;
      return {
        platform:            req.platform,
        platformVideoId:     req.platformVideoId,
        publishedUrl:        "https://youtube.com/watch?v=test",
        rawMetrics:          raw,
        normalizedMetrics:   normalized,
        collectedAt:         new Date(),
        collectionWindowDays: 7,
      };
    },
    normalize: (raw, _platform) => this_normalize(raw),
  };

  function this_normalize(raw: Partial<Record<MetricType, number>>): NormalizedMetrics {
    return {
      views:                   raw[MetricType.VIEWS]       ?? 0,
      watchTimeMinutes:        raw[MetricType.WATCH_TIME]  ?? 0,
      ctrPercent:              raw[MetricType.CTR]         ?? 0,
      averageRetentionPercent: raw[MetricType.RETENTION]   ?? 0,
      likes:                   raw[MetricType.LIKES]       ?? 0,
      comments:                raw[MetricType.COMMENTS]    ?? 0,
      shares:                  raw[MetricType.SHARES]      ?? 0,
      subscribersGained:       raw[MetricType.SUBSCRIBERS] ?? 0,
      followersGained:         raw[MetricType.FOLLOWERS]   ?? 0,
      revenueUsd:              raw[MetricType.REVENUE]     ?? 0,
      rpmUsd:                  raw[MetricType.RPM]         ?? 0,
      cpmUsd:                  raw[MetricType.CPM]         ?? 0,
      impressions:             raw[MetricType.IMPRESSIONS] ?? 0,
      engagementRate:          raw[MetricType.ENGAGEMENT]  ?? 0,
    };
  }

  const eng5 = new AnalyticsBuilder()
    .withContext(makeContext())
    .withCollector(customCollector)
    .build();
  await eng5.initialize();
  await eng5.analyze(makeRequest({ id: "analytics-005" }));
  assert(capturedNormalized !== undefined, "Custom collector must be called and normalize metrics");
  assert(capturedNormalized!.views >= 0, "Normalized views must be non-negative");
  assert(capturedNormalized!.ctrPercent >= 0 && capturedNormalized!.ctrPercent <= 100, "CTR must be 0–100");
  assert(capturedNormalized!.averageRetentionPercent >= 0, "Retention must be non-negative");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 6. Performance Score
  // ==========================================================================
  console.log("6. Performance Score...");
  const eng6 = new AnalyticsEngine(makeContext());
  await eng6.initialize();
  const resp6 = await eng6.analyze(makeRequest({ id: "analytics-006" }));
  const score6 = resp6.performanceScore;
  assert(score6.overall >= 0 && score6.overall <= 100, "Overall score must be 0–100");
  assert(score6.hook >= 0 && score6.hook <= 100, "Hook score must be 0–100");
  assert(score6.retention >= 0 && score6.retention <= 100, "Retention score must be 0–100");
  assert(score6.ctr >= 0 && score6.ctr <= 100, "CTR score must be 0–100");
  assert(score6.engagement >= 0 && score6.engagement <= 100, "Engagement score must be 0–100");
  assert(Object.values(PerformanceLevel).includes(score6.level), "Performance level must be a valid PerformanceLevel");
  assert(Array.isArray(score6.weakPoints), "weakPoints must be an array");
  assert(Array.isArray(score6.strongPoints), "strongPoints must be an array");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 7. Recommendation Generation
  // ==========================================================================
  console.log("7. Recommendation Generation...");
  const eng7 = new AnalyticsEngine(makeContext());
  await eng7.initialize();
  const resp7 = await eng7.analyze(makeRequest({
    id: "analytics-007",
    options: { generateRecommendations: true, runBenchmark: false, triggerLearning: false },
  }));
  assert(resp7.recommendations.length > 0, "At least one recommendation must be generated");
  for (const rec of resp7.recommendations) {
    assert(!!rec.id, "Every recommendation must have an ID");
    assert(!!rec.type, "Every recommendation must have a type");
    assert(!!rec.title, "Every recommendation must have a title");
    assert(rec.expectedImpactPercent >= 0, "Impact percent must be non-negative");
  }
  // Verify recommendation types are valid
  const validTypes = Object.values(RecommendationType);
  for (const rec of resp7.recommendations) {
    assert(validTypes.includes(rec.type), `Recommendation type "${rec.type}" must be a valid RecommendationType`);
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 8. Benchmark Analysis
  // ==========================================================================
  console.log("8. Benchmark Analysis...");
  const eng8 = new AnalyticsEngine(makeContext());
  await eng8.initialize();
  // Run 2 analyses to build history for benchmark
  await eng8.analyze(makeRequest({ id: "analytics-008a", platformVideoId: "vid-bench-1" }));
  const resp8 = await eng8.analyze(makeRequest({ id: "analytics-008b", platformVideoId: "vid-bench-2" }));
  assert(resp8.benchmark !== undefined, "Benchmark must be present when runBenchmark=true");
  const bench = resp8.benchmark!;
  assert(typeof bench.channelRank === "number", "Benchmark must include channelRank");
  assert(typeof bench.bestUploadDay === "string", "Benchmark must include bestUploadDay");
  assert(typeof bench.bestUploadHour === "number", "Benchmark must include bestUploadHour");
  assert(bench.channelAverage !== undefined, "Benchmark must include channelAverage metrics");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 9. Revenue Metrics
  // ==========================================================================
  console.log("9. Revenue Metrics...");
  const eng9 = new AnalyticsEngine(makeContext());
  await eng9.initialize();
  const resp9 = await eng9.analyze(makeRequest({ id: "analytics-009" }));
  const revenue = resp9.report.revenueMetrics;
  assert(revenue.totalRevenueUsd >= 0, "Revenue must be non-negative");
  assert(revenue.rpmUsd >= 0, "RPM must be non-negative");
  assert(revenue.cpmUsd >= 0, "CPM must be non-negative");
  assert(revenue.estimatedMonetizedPlaybacks >= 0, "Monetized playbacks must be non-negative");
  assert(revenue.revenuePerView >= 0, "Revenue per view must be non-negative");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 10. Audience Metrics
  // ==========================================================================
  console.log("10. Audience Metrics...");
  const resp10 = resp9; // reuse from test 9
  const audience = resp10.audienceAnalytics;
  assert(audience.totalUniqueViewers >= 0, "Unique viewers must be non-negative");
  assert(audience.newViewers >= 0, "New viewers must be non-negative");
  assert(audience.returningViewers >= 0, "Returning viewers must be non-negative");
  assert(Array.isArray(audience.bestDaysOfWeek), "bestDaysOfWeek must be an array");
  assert(Array.isArray(audience.bestHoursOfDay), "bestHoursOfDay must be an array");
  assert(Array.isArray(audience.interestCategories), "interestCategories must be an array");
  assert(typeof audience.deviceSplit === "object", "deviceSplit must be an object");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 11. Publishing Integration
  // ==========================================================================
  console.log("11. Publishing Integration...");
  // Simulate publishing engine providing a video ID to analytics
  const ctxPub = makeContext({
    publishingEngine: {
      getHistory: () => [{
        requestId:   "pub-from-analytics",
        jobs: [{ platform: "YOUTUBE", platformVideoId: "yt-from-pub-001", publishedUrl: "https://youtube.com/watch?v=yt-from-pub-001" }],
      }],
    },
  });
  const engPub = new AnalyticsEngine(ctxPub);
  await engPub.initialize();
  const respPub = await engPub.analyze(makeRequest({
    id:              "analytics-pub-int",
    publishingId:    "pub-from-analytics",
    platformVideoId: "yt-from-pub-001",
  }));
  assert(respPub.platformAnalytics.platformVideoId === "yt-from-pub-001",
    "Analytics must process the video ID provided by the publishing engine"
  );
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 12. Research Integration
  // ==========================================================================
  console.log("12. Research Integration...");
  let researchUpdated = false;
  const ctxResearch = makeContext({
    researchEngine: {
      updateTrends: async (_data: any) => { researchUpdated = true; },
    },
  });
  const engResearch = new AnalyticsEngine(ctxResearch);
  await engResearch.initialize();
  await engResearch.analyze(makeRequest({ id: "analytics-research-int" }));
  assert(researchUpdated, "Learning engine must call researchEngine.updateTrends()");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 13. Strategy Integration
  // ==========================================================================
  console.log("13. Strategy Integration...");
  let strategyUpdated = false;
  const ctxStrategy = makeContext({
    strategyEngine: {
      updatePriorities: async (_data: any) => { strategyUpdated = true; },
    },
  });
  const engStrategy = new AnalyticsEngine(ctxStrategy);
  await engStrategy.initialize();
  await engStrategy.analyze(makeRequest({ id: "analytics-strategy-int" }));
  assert(strategyUpdated, "Learning engine must call strategyEngine.updatePriorities()");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 14. Decision Integration
  // ==========================================================================
  console.log("14. Decision Integration...");
  let decisionRecorded = false;
  const ctxDec = makeContext({
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: (_t: any) => ({
        record: async (data: any) => {
          decisionRecorded = true;
          assert(data.analyticsId !== undefined, "Decision record must contain analyticsId");
          assert(data.overallScore !== undefined, "Decision record must contain overallScore");
          assert(data.performanceLevel !== undefined, "Decision record must contain performanceLevel");
        },
      }),
    },
  });
  const engDec = new AnalyticsEngine(ctxDec);
  await engDec.initialize();
  await engDec.analyze(makeRequest({ id: "analytics-dec-int" }));
  assert(decisionRecorded, "Decision engine record must be triggered by the learning engine");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 15. Memory Integration
  // ==========================================================================
  console.log("15. Memory Integration...");
  const ctxMem = makeContext();
  const engMem = new AnalyticsEngine(ctxMem);
  await engMem.initialize();
  await engMem.analyze(makeRequest({ id: "analytics-mem-int", platformVideoId: "vid-mem-001" }));
  const memStore = ctxMem.memoryStore._store as Map<string, any>;
  assert(memStore.has("analytics:analytics-mem-int"), "analytics-history must be in memory");
  assert(memStore.has("perf:vid-mem-001"), "video-performance must be in memory");
  assert(memStore.has("recs:analytics-mem-int"), "recommendations must be in memory");
  assert(memStore.has("learn:analytics-mem-int"), "learning-updates must be in memory");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 16. Agent Integration
  // ==========================================================================
  console.log("16. Agent Integration...");
  const engAgent: import("./analytics/interfaces").IAnalyticsEngine =
    new AnalyticsEngine(makeContext());
  assert(typeof engAgent.initialize  === "function", "IAnalyticsEngine.initialize must be a function");
  assert(typeof engAgent.analyze     === "function", "IAnalyticsEngine.analyze must be a function");
  assert(typeof engAgent.cancel      === "function", "IAnalyticsEngine.cancel must be a function");
  assert(typeof engAgent.getReport   === "function", "IAnalyticsEngine.getReport must be a function");
  assert(typeof engAgent.getSnapshot === "function", "IAnalyticsEngine.getSnapshot must be a function");
  assert(typeof engAgent.getHistory  === "function", "IAnalyticsEngine.getHistory must be a function");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 17. Event Publishing
  // ==========================================================================
  console.log("17. Event Publishing...");
  const ctxEvt = makeContext();
  const engEvt = new AnalyticsEngine(ctxEvt);
  await engEvt.initialize();
  await engEvt.analyze(makeRequest({ id: "analytics-evt-test" }));
  const publishedNames = (ctxEvt.eventBus._events as any[]).map((e: any) => e.name);
  assert(publishedNames.includes("AnalyticsStarted"),      "AnalyticsStarted must be emitted");
  assert(publishedNames.includes("MetricsCollected"),      "MetricsCollected must be emitted");
  assert(publishedNames.includes("PerformanceCalculated"), "PerformanceCalculated must be emitted");
  assert(publishedNames.includes("RecommendationGenerated"),"RecommendationGenerated must be emitted");
  assert(publishedNames.includes("BenchmarkCompleted"),    "BenchmarkCompleted must be emitted");
  assert(publishedNames.includes("LearningUpdated"),       "LearningUpdated must be emitted");
  assert(publishedNames.includes("AnalyticsCompleted"),    "AnalyticsCompleted must be emitted");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 18. Validator Rules
  // ==========================================================================
  console.log("18. Validator Rules...");

  // 18a. Empty ID
  try {
    AnalyticsValidator.validateRequest({ ...makeRequest(), id: "" });
    throw new Error("Expected AnalyticsValidationException");
  } catch (err: unknown) {
    assert(err instanceof AnalyticsValidationException, "Empty ID must fail validation");
  }

  // 18b. Invalid platform
  try {
    AnalyticsValidator.validateRequest({ ...makeRequest(), platform: "SNAPCHAT" as any });
    throw new Error("Expected AnalyticsValidationException");
  } catch (err: unknown) {
    assert(err instanceof AnalyticsValidationException, "Invalid platform must fail validation");
  }

  // 18c. Negative views
  try {
    AnalyticsValidator.validateMetrics({
      views: -1, ctrPercent: 5, averageRetentionPercent: 50, revenueUsd: 10, engagementRate: 5,
    });
    throw new Error("Expected AnalyticsValidationException");
  } catch (err: unknown) {
    assert(err instanceof AnalyticsValidationException, "Negative views must fail validation");
  }

  // 18d. Negative revenue
  try {
    AnalyticsValidator.validateMetrics({
      views: 1000, ctrPercent: 5, averageRetentionPercent: 50, revenueUsd: -5, engagementRate: 5,
    });
    throw new Error("Expected AnalyticsValidationException");
  } catch (err: unknown) {
    assert(err instanceof AnalyticsValidationException, "Negative revenue must fail validation");
  }

  // 18e. Invalid retention curve (out of range value)
  try {
    AnalyticsValidator.validateRetentionCurve([
      { secondMark: 0, retentionPercent: 100 },
      { secondMark: -5, retentionPercent: 80 },
    ]);
    throw new Error("Expected AnalyticsValidationException");
  } catch (err: unknown) {
    assert(err instanceof AnalyticsValidationException, "Negative secondMark must fail retention curve validation");
  }

  // 18f. Duplicate recommendations
  const dupRec: AnalyticsRecommendation = {
    id: "rec-dup-001",
    type: RecommendationType.HOOK,
    priority: "HIGH",
    title: "Test",
    description: "Test",
    expectedImpactPercent: 20,
    targetMetric: MetricType.RETENTION,
    evidence: "Test",
    action: "TEST",
    parameters: {},
  };
  try {
    AnalyticsValidator.validateRecommendations([dupRec, { ...dupRec }]);
    throw new Error("Expected DuplicateAnalyticsException");
  } catch (err: unknown) {
    assert(err instanceof DuplicateAnalyticsException, "Duplicate recommendation IDs must throw DuplicateAnalyticsException");
  }

  // 18g. Invalid performance score
  try {
    AnalyticsValidator.validatePerformanceScore({
      overall: 150, hook: 0, retention: 0, engagement: 0, ctr: 0, growth: 0, revenue: 0, reach: 0,
      level: PerformanceLevel.AVERAGE, weakPoints: [], strongPoints: [],
    });
    throw new Error("Expected AnalyticsValidationException");
  } catch (err: unknown) {
    assert(err instanceof AnalyticsValidationException, "Score > 100 must fail performance score validation");
  }

  // 18h. Invalid state transition
  try {
    AnalyticsValidator.validateStateTransition("job-val", AnalyticsState.CREATED, AnalyticsState.COMPLETED);
    throw new Error("Expected AnalyticsValidationException");
  } catch (err: unknown) {
    assert(err instanceof AnalyticsValidationException, "Forbidden state transition must fail validation");
  }

  // 18i. Duplicate analytics request
  const engDup = new AnalyticsEngine(makeContext());
  await engDup.initialize();
  await engDup.analyze(makeRequest({ id: "analytics-dup-guard" }));
  try {
    await engDup.analyze(makeRequest({ id: "analytics-dup-guard" }));
    throw new Error("Expected DuplicateAnalyticsException");
  } catch (err: unknown) {
    assert(err instanceof DuplicateAnalyticsException, "Duplicate analytics request ID must throw DuplicateAnalyticsException");
  }

  console.log("✓ Passed.\n");

  // ==========================================================================
  // 19. Snapshot Immutability
  // ==========================================================================
  console.log("19. Snapshot Immutability...");
  const engSnap = new AnalyticsEngine(makeContext());
  await engSnap.initialize();
  await engSnap.analyze(makeRequest({ id: "analytics-snap-test" }));
  const snap19 = engSnap.getSnapshot("analytics-snap-test");
  assert(Object.isFrozen(snap19), "Snapshot root must be frozen");
  assert(snap19.analyticsId === "analytics-snap-test", "Snapshot analyticsId must match request ID");
  assert(snap19.state === AnalyticsState.COMPLETED, "Snapshot state must be COMPLETED");
  assert(snap19.overallScore >= 0 && snap19.overallScore <= 100, "Snapshot overallScore must be 0–100");
  assert(Object.values(PerformanceLevel).includes(snap19.performanceLevel), "Snapshot performanceLevel must be valid");
  assert(snap19.recommendationCount >= 0, "Snapshot recommendationCount must be non-negative");

  let snapMutationFailed = false;
  try {
    (snap19 as any).analyticsId = "hacked";
  } catch (_) {
    snapMutationFailed = true;
  }
  assert(snap19.analyticsId === "analytics-snap-test" || snapMutationFailed, "Snapshot must be immutable");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 20. Full End-to-End Analytics Pipeline
  // ==========================================================================
  console.log("20. Full End-to-End Analytics Pipeline...");

  let researchCalled = false;
  let strategyCalled = false;
  let scriptCalled   = false;
  let channelCalled  = false;
  let decisionCalled = false;

  const ctxE2E = makeContext({
    researchEngine: { updateTrends:        async (_: any) => { researchCalled = true; } },
    strategyEngine: { updatePriorities:    async (_: any) => { strategyCalled = true; } },
    scriptEngine:   { learnFromAnalytics:  async (_: any) => { scriptCalled   = true; } },
    channelEngine:  { updateChannelInsights: async (_: any) => { channelCalled = true; } },
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: (_t: any) => ({
        record: async (_: any) => { decisionCalled = true; },
      }),
    },
  });

  const engE2E = new AnalyticsBuilder()
    .withContext(ctxE2E)
    .withMetadata({ sprint: "13.2" })
    .build();

  await engE2E.initialize();
  assert(engE2E.state === AnalyticsState.INITIALIZED, "Engine must be INITIALIZED before analyze");

  const respE2E = await engE2E.analyze(makeRequest({
    id:              "analytics-e2e",
    publishingId:    "pub-e2e-001",
    platformVideoId: "yt-e2e-final-001",
    platform:        AnalyticsPlatform.YOUTUBE,
    options: {
      collectionWindowDays:    14,
      generateRecommendations: true,
      runBenchmark:            true,
      triggerLearning:         true,
    },
  }));

  // State
  assert(engE2E.state === AnalyticsState.COMPLETED, "Engine must be COMPLETED after analyze");
  assert(respE2E.state === AnalyticsState.COMPLETED, "Response state must be COMPLETED");

  // Metrics collected
  assert(respE2E.platformAnalytics.normalizedMetrics.views > 0, "E2E: views must be > 0");
  assert(respE2E.platformAnalytics.normalizedMetrics.ctrPercent > 0, "E2E: CTR must be > 0");
  assert(respE2E.platformAnalytics.collectionWindowDays === 14, "E2E: collection window must be 14 days");

  // Performance score
  assert(respE2E.performanceScore.overall > 0, "E2E: overall score must be > 0");
  assert(respE2E.performanceScore.overall <= 100, "E2E: overall score must be <= 100");
  assert(Object.values(PerformanceLevel).includes(respE2E.performanceScore.level), "E2E: performance level must be valid");

  // Recommendations
  assert(respE2E.recommendations.length > 0, "E2E: must generate at least one recommendation");

  // Benchmark
  assert(respE2E.benchmark !== undefined, "E2E: benchmark must be present");
  assert(typeof respE2E.benchmark!.channelRank === "number", "E2E: benchmark channelRank must be a number");

  // Learning
  assert(respE2E.learningUpdate !== undefined, "E2E: learningUpdate must be present");
  assert(researchCalled, "E2E: Research engine must be updated");
  assert(strategyCalled, "E2E: Strategy engine must be updated");
  assert(scriptCalled,   "E2E: Script engine must be updated");
  assert(channelCalled,  "E2E: Channel engine must be updated");
  assert(decisionCalled, "E2E: Decision engine must be updated");

  // Report
  const e2eReport = engE2E.getReport("analytics-e2e");
  assert(!!e2eReport, "E2E: report must exist");
  assert(e2eReport.normalizedMetrics.views > 0, "E2E report: views must be > 0");
  assert(e2eReport.engagementMetrics.overallEngagement >= 0, "E2E report: engagement must be non-negative");
  assert(e2eReport.revenueMetrics.totalRevenueUsd >= 0, "E2E report: revenue must be non-negative");

  // Snapshot
  const e2eSnap = engE2E.getSnapshot("analytics-e2e");
  assert(Object.isFrozen(e2eSnap), "E2E: snapshot must be frozen");
  assert(e2eSnap.analyticsId === "analytics-e2e", "E2E: snapshot analyticsId must match");
  assert(e2eSnap.state === AnalyticsState.COMPLETED, "E2E: snapshot state must be COMPLETED");
  assert(e2eSnap.learningTriggered === true, "E2E: snapshot must record that learning was triggered");
  assert(e2eSnap.recommendationCount > 0, "E2E: snapshot must record recommendation count");

  // Events
  const e2eEventNames = (ctxE2E.eventBus._events as any[]).map((e: any) => e.name);
  assert(e2eEventNames.includes("AnalyticsStarted"),       "E2E: AnalyticsStarted must be emitted");
  assert(e2eEventNames.includes("MetricsCollected"),       "E2E: MetricsCollected must be emitted");
  assert(e2eEventNames.includes("PerformanceCalculated"),  "E2E: PerformanceCalculated must be emitted");
  assert(e2eEventNames.includes("RecommendationGenerated"),"E2E: RecommendationGenerated must be emitted");
  assert(e2eEventNames.includes("BenchmarkCompleted"),     "E2E: BenchmarkCompleted must be emitted");
  assert(e2eEventNames.includes("LearningUpdated"),        "E2E: LearningUpdated must be emitted");
  assert(e2eEventNames.includes("AnalyticsCompleted"),     "E2E: AnalyticsCompleted must be emitted");

  // Memory
  const e2eMemStore = ctxE2E.memoryStore._store as Map<string, any>;
  assert(e2eMemStore.has("analytics:analytics-e2e"),   "E2E: analytics-history must be in memory");
  assert(e2eMemStore.has("perf:yt-e2e-final-001"),     "E2E: video-performance must be in memory");
  assert(e2eMemStore.has("recs:analytics-e2e"),        "E2E: recommendations must be in memory");
  assert(e2eMemStore.has("learn:analytics-e2e"),       "E2E: learning-updates must be in memory");

  // History
  const history = engE2E.getHistory();
  assert(history.length === 1, "E2E: history must contain exactly 1 response");

  console.log("✓ Passed.\n");

  console.log("=== ALL 20 ANALYTICS ENGINE TESTS PASSED ✓ ===");
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
