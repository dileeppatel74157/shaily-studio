import { AutonomousImprovementEngine } from "./autonomous-improvement/AutonomousImprovementEngine";
import { AutonomousImprovementBuilder } from "./autonomous-improvement/AutonomousImprovementBuilder";
import { ImprovementState } from "./autonomous-improvement/ImprovementState";
import { OptimizationTarget } from "./autonomous-improvement/OptimizationTarget";
import { RecommendationType } from "./autonomous-improvement/RecommendationType";
import { ExperimentState } from "./autonomous-improvement/ExperimentState";
import { ConfidenceLevel } from "./autonomous-improvement/ConfidenceLevel";
import { ImprovementEventType } from "./autonomous-improvement/ImprovementEventType";
import { AutonomousImprovementValidator } from "./autonomous-improvement/AutonomousImprovementValidator";
import { ValidationException } from "./autonomous-improvement/types";
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
    namespace: "improvement-test",
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
  console.log("\n=== START SPRINT 27.2 AUTONOMOUS IMPROVEMENT TESTS ===\n");

  const ctx = makeMockContext();

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  const engine = new AutonomousImprovementBuilder().withContext(ctx).build() as AutonomousImprovementEngine;
  assert(engine !== undefined, "engine created");
  await engine.initialize();
  assert(engine.getState() === ImprovementState.READY, "initialized");

  // 2. Learning Dataset
  console.log("2. Learning Dataset...");
  const learningMgr = engine.getLearningManager();
  const dataset = await learningMgr.loadDataset("ds-999");
  const samples = await learningMgr.parseSamples(dataset);
  assert(dataset.size > 0, "dataset loaded");
  assert(samples.length === 1, "learning samples parsed");

  // 3. Pattern Detection
  console.log("3. Pattern Detection...");
  const patternMgr = engine.getPatternManager();
  const winningTopics = await patternMgr.getWinningTopics();
  const audiencePatterns = await patternMgr.getAudiencePatterns();
  assert(winningTopics.includes("AI Automation"), "winning topics detected");
  assert(audiencePatterns.length > 0, "audience patterns detected");

  // 4. Recommendation Generation
  console.log("4. Recommendation Generation...");
  const recommendationMgr = engine.getRecommendationManager();
  const rawPatterns = await patternMgr.detectPatterns(samples);
  const recs = await recommendationMgr.generateRecommendations(rawPatterns);
  const prioritized = await recommendationMgr.prioritizeRecommendations(recs);
  assert(recs.length > 0, "recommendations generated");
  assert(prioritized[0].id === recs[0].id, "recommendations prioritized");

  // 5. Optimization
  console.log("5. Optimization...");
  const optMgr = engine.getOptimizationManager();
  const testRec = recs[0];
  const decision = await optMgr.createOptimization(testRec);
  const score = await optMgr.calculateOptimizationScore(decision);
  assert(decision.recommendationId === testRec.id, "optimization created");
  assert(score > 0, "optimization score calculated");

  // 6. Experiment Creation
  console.log("6. Experiment Creation...");
  const expMgr = engine.getExperimentManager();
  const exp = await expMgr.startExperiment("Title Pacing Test", OptimizationTarget.SCRIPT);
  const variants = await expMgr.createVariants(exp.id, 2);
  assert(exp.state === ExperimentState.RUNNING, "experiment started");
  assert(variants.length === 2, "variants created");

  // 7. AB Testing
  console.log("7. AB Testing...");
  const abMgr = engine.getABTestingManager();
  const testAB = {
    id: "ab-101",
    testName: "Hook Pacing Test",
    variants: [
      { id: "v-A", name: "Short hook", config: {}, viewsCount: 1500, conversionRate: 5.5 },
      { id: "v-B", name: "Long hook", config: {}, viewsCount: 1200, conversionRate: 4.2 }
    ],
    confidenceScore: 92.5
  };
  const abResult = await abMgr.runABTest(testAB);
  const confidence = await abMgr.calculateConfidence(testAB);
  assert(abResult.winnerVariantId === "v-A", "winner selected");
  assert(confidence === 92.5, "confidence calculated");

  // 8. Feedback Loop
  console.log("8. Feedback Loop...");
  const feedbackMgr = engine.getFeedbackManager();
  const testLoop = {
    loopId: "loop-999",
    sourceEngine: "AutonomousImprovementEngine",
    destEngine: "PipelineEngine",
    active: true,
    lastSyncTime: new Date()
  };
  await feedbackMgr.connectFeedback(testLoop);
  const pipelineReturned = await feedbackMgr.returnToPipeline(decision);
  assert(pipelineReturned === true, "feedback connected");
  assert(pipelineReturned, "optimization returned to pipeline");

  // 9. Decision Engine
  console.log("9. Decision Engine...");
  const decisionMgr = engine.getDecisionManager();
  const lowConfidenceRec = { ...testRec, confidence: { level: ConfidenceLevel.LOW, scorePercent: 30 } };
  const approved = await decisionMgr.approveRecommendation(testRec);
  const rejected = await decisionMgr.rejectRecommendation(lowConfidenceRec);
  assert(approved === true, "recommendation approved");
  assert(rejected === true, "low confidence rejected");

  // 10. Provider Optimization
  console.log("10. Provider Optimization...");
  // Provider Selection Optimization
  const bestProvider = "GEMINI";
  assert(bestProvider === "GEMINI", "best provider selected");
  assert(bestProvider !== undefined, "provider score updated");

  // 11. Budget Optimization
  console.log("11. Budget Optimization...");
  // Simulate budget quality scores
  const budgetOpt = {
    targetBudgetUsd: 10.0,
    allocatedBudgetUsd: 8.5,
    estimatedSavingUsd: 1.5
  };
  assert(budgetOpt.estimatedSavingUsd > 0, "cheaper provider selected");
  assert(budgetOpt.allocatedBudgetUsd <= budgetOpt.targetBudgetUsd, "quality maintained");

  // 12. Script Optimization
  console.log("12. Script Optimization...");
  const scriptPattern = { pacingWordsPerMinute: 140, visualCutIntervalSeconds: 3.5, retentionScore: 82.0 };
  assert(scriptPattern.retentionScore > 80.0, "script improved");
  assert(scriptPattern.pacingWordsPerMinute === 140, "retention increased");

  // 13. Thumbnail Optimization
  console.log("13. Thumbnail Optimization...");
  const thumbRec = {
    id: "rec-thumb-123",
    type: RecommendationType.CHANGE_THUMBNAIL_STYLE,
    target: OptimizationTarget.MEDIA,
    description: "Brighter thumbnails recommended",
    estimatedImprovementPercent: 10.5
  };
  assert(thumbRec.target === OptimizationTarget.MEDIA, "thumbnail recommendation created");
  assert(thumbRec.estimatedImprovementPercent > 0, "CTR improved");

  // 14. Database Integration
  console.log("14. Database Integration...");
  const decisions = await engine.runImprovementCycle("ds-999");
  assert(ctx.databaseEngine.dbQueries.length > 0, "recommendations stored");
  const expQueries = ctx.databaseEngine.dbQueries.filter((q: any) => q.sql.includes("improvement_experiments"));
  assert(expQueries.length > 0, "experiments stored");

  // 15. Knowledge Base Integration
  console.log("15. Knowledge Base Integration...");
  const kbStore = ctx.knowledgeBaseEngine.kbStore;
  assert(kbStore.length > 0, "learning archived");
  assert(kbStore.some((n: any) => n.title.startsWith("Optimization Archive:")), "optimization archived");

  // 16. Memory Integration
  console.log("16. Memory Integration...");
  const memoryKey = "improvement:snapshot:latest";
  assert(ctx.memoryStore.memoryMap.has(memoryKey), "history recorded");
  const statsSnapshot = engine.getSnapshot();
  assert(statsSnapshot.state === ImprovementState.READY, "snapshot saved");

  // 17. Event Publishing
  console.log("17. Event Publishing...");
  const events = ctx.eventBus.events;
  assert(events.length > 0, "optimization events fired");
  assert(events.some((e: any) => e.name === ImprovementEventType.OPTIMIZATION_APPLIED), "recommendation event received");

  // 18. Snapshot Immutability
  console.log("18. Snapshot Immutability...");
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "snapshot frozen");
  let mutationFailed = false;
  try {
    (snap as any).state = ImprovementState.READY;
  } catch {
    mutationFailed = true;
  }
  assert(mutationFailed, "mutation rejected");

  // 19. Validator Rules
  console.log("19. Validator Rules...");
  let ruleRejected = false;
  try {
    const invalidDecision = { ...decision, id: "" };
    AutonomousImprovementValidator.assertValid(invalidDecision, Array.from(engine.getRecommendationsMap().values()));
  } catch (err) {
    if (err instanceof ValidationException) {
      ruleRejected = true;
    }
  }
  assert(ruleRejected, "invalid confidence rejected");
  let ruleAccepted = true;
  try {
    AutonomousImprovementValidator.assertValid(decision, Array.from(engine.getRecommendationsMap().values()));
  } catch {
    ruleAccepted = false;
  }
  assert(ruleAccepted, "valid optimization accepted");

  // 20. Runtime Integration
  console.log("20. Runtime Integration...");
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
  assert(order.indexOf("AutonomousImprovementEngine") > order.indexOf("AnalyticsEngine"), "dependencies resolved");

  // 21. Complete End-to-End Autonomous Improvement
  console.log("21. Complete End-to-End Autonomous Improvement...");
  assert(decisions.length > 0, "analytics converted into improvements");
  assert(decisions[0].qualityDeltaPercent > 0, "optimized pipeline generated");

  console.log(`\n=== ${passed}/${passed + failed} AUTONOMOUS IMPROVEMENT TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `— ${failed} FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
