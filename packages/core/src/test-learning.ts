/**
 * Sprint 16.1 — Learning Engine
 * Verification Suite — 20 Tests
 */

import { LearningEngine }          from "./learning/LearningEngine";
import { LearningBuilder }         from "./learning/LearningBuilder";
import { LearningValidator }       from "./learning/LearningValidator";
import { LearningState }           from "./learning/LearningState";
import { LearningSource }          from "./learning/LearningSource";
import { LearningType }            from "./learning/LearningType";
import { PatternConfidence }       from "./learning/PatternConfidence";
import { RecommendationPriority }  from "./learning/RecommendationPriority";
import { KnowledgeType }           from "./learning/KnowledgeType";
import { ImprovementTarget }       from "./learning/ImprovementTarget";
import {
  LearningValidationException,
  LearningException,
  PatternException,
  KnowledgeException,
} from "./learning/types";
import { ControlAction, ControlCenterBuilder } from "./control-center/index";
import type {
  LearningRequest,
  LearningResponse,
  LearningSession,
  LearningPattern,
  SuccessPattern,
  FailurePattern,
  WorkflowPattern,
  PromptPattern,
  DecisionPattern,
  ProviderPattern,
  KnowledgeEntry,
  KnowledgeGraph,
  Recommendation,
  LearningInsight,
  LearningHistory,
  LearningSnapshot,
} from "./learning/models";

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
    logger: { info: () => {}, error: () => {}, warn: () => {} },
    eventBus: {
      publish: async (e: any) => { events.push(e); },
      _events: events,
    },
    memoryStore: {
      get: async (ns: string, key: string) => store.has(`${ns}:${key}`) ? { value: store.get(`${ns}:${key}`) } : undefined,
      set: async (ns: string, key: string, value: any) => { store.set(`${ns}:${key}`, value); },
      _store: store,
    },
    registry: { has: () => false, resolve: () => null },
    ...overrides,
  };
}

function makeLearningRequest(overrides: Partial<LearningRequest> = {}): LearningRequest {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    source: LearningSource.ANALYTICS,
    timestamp: new Date(),
    ...overrides,
  };
}

function makeHistoryData(): LearningHistory[] {
  return [
    {
      id: "hist-1", projectId: "proj-1", source: LearningSource.ANALYTICS,
      success: true, durationMs: 2500, costUsd: 0.15,
      metrics: { ctrPercent: 7.5, retentionPercent: 60, overallScore: 88 },
      timestamp: new Date(),
    },
    {
      id: "hist-2", projectId: "proj-2", source: LearningSource.QUALITY,
      success: false, durationMs: 3200, costUsd: 0.22,
      metrics: { ctrPercent: 2.1, retentionPercent: 32, overallScore: 42 },
      timestamp: new Date(),
    },
  ];
}

function makeControlRequest(action: any, overrides: any = {}): any {
  return {
    id: "req-cc-reg",
    action,
    targetWorkflowId: "test-workflow",
    timestamp: new Date(),
    requester: "FOUNDER",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START SPRINT 16.1 LEARNING ENGINE TESTS ===\n");

  const history = makeHistoryData();

  // ==========================================================================
  // 1. Builder Validation
  // ==========================================================================
  console.log("1. Builder Validation...");
  try {
    new LearningBuilder().build();
    throw new Error("Expected LearningValidationException");
  } catch (err: unknown) {
    assert(err instanceof LearningValidationException, "Builder without context must throw LearningValidationException");
  }
  const builder = new LearningBuilder().withContext(makeContext()).withMetadata({ sprint: "16.1" });
  const eng1 = builder.build();
  assert(eng1 instanceof LearningEngine, "Builder must construct LearningEngine");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 2. Lifecycle Transitions
  // ==========================================================================
  console.log("2. Lifecycle Transitions...");
  const eng2 = new LearningEngine(makeContext());
  assert(eng2.state === LearningState.CREATED, "Initial state must be CREATED");
  await eng2.initialize();
  assert(eng2.state === LearningState.INITIALIZED, "State must transition to INITIALIZED");
  await eng2.start();
  assert(eng2.state === LearningState.COLLECTING, "State must transition to COLLECTING");
  await eng2.stop();
  assert(eng2.state === LearningState.FAILED, "State must transition to FAILED");

  // Invalid state transition
  try {
    LearningValidator.validateStateTransition("test", LearningState.CREATED, LearningState.LEARNING);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof LearningValidationException, "Invalid transition must fail validation");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 3. History Collection
  // ==========================================================================
  console.log("3. History Collection...");
  const ctx3 = makeContext();
  const eng3 = new LearningEngine(ctx3);
  await eng3.initialize();
  await eng3.start();
  
  const req3 = makeLearningRequest({ id: "req-3" });
  const resp3 = await eng3.learn(req3, history);
  
  assert(resp3.requestId === "req-3", "Response requestId must match request ID");
  const historyEvents = (ctx3.eventBus._events as any[]).filter(e => e.name === "HistoryCollected");
  assert(historyEvents.length === 1, "Must emit HistoryCollected event during collection step");
  assert(historyEvents[0].payload.recordCount === 2, "Event must report correct record counts");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 4. Success Pattern Detection
  // ==========================================================================
  console.log("4. Success Pattern Detection...");
  const eng4 = new LearningEngine(makeContext());
  const successAnalyzer = eng4.getSuccessAnalyzer();
  const succPatterns = successAnalyzer.analyzeSuccess(history);

  assert(succPatterns.length === 1, "Should detect exactly 1 success pattern from history data");
  assert(succPatterns[0].overallScore === 88, "Should extract metric metrics from successful executions");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 5. Failure Pattern Detection
  // ==========================================================================
  console.log("5. Failure Pattern Detection...");
  const eng5 = new LearningEngine(makeContext());
  const failureAnalyzer = eng5.getFailureAnalyzer();
  const failPatterns = failureAnalyzer.analyzeFailure(history);

  assert(failPatterns.length === 1, "Should detect exactly 1 failure pattern from history data");
  assert(failPatterns[0].stageName === "quality", "Should identify the failed stage name");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 6. Prompt Learning
  // ==========================================================================
  console.log("6. Prompt Learning...");
  const eng6 = new LearningEngine(makeContext());
  const promptLearner = eng6.getPromptLearner();
  const promptPatterns = promptLearner.learnPrompt(history);

  assert(promptPatterns.length === 1, "Should perform prompt learning analytics");
  assert(promptPatterns[0].systemPromptHash === "hash-001", "Should reference prompt identification hash");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 7. Workflow Learning
  // ==========================================================================
  console.log("7. Workflow Learning...");
  const eng7 = new LearningEngine(makeContext());
  const workflowLearner = eng7.getWorkflowLearner();
  const wfPatterns = workflowLearner.learnWorkflow(history);

  assert(wfPatterns.length === 1, "Should learn workflow sequence patterns");
  assert(wfPatterns[0].sequence.includes("rendering"), "Sequence should contain standard rendering engine stage");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 8. Decision Learning
  // ==========================================================================
  console.log("8. Decision Learning...");
  const eng8 = new LearningEngine(makeContext());
  const decisionLearner = eng8.getDecisionLearner();
  const decPatterns = decisionLearner.learnDecision(history);

  assert(decPatterns.length === 1, "Should learn decision optimizations");
  assert(decPatterns[0].choiceMade === "ENFORCE_MIN_QUALITY_80", "Preserves choice outcome classification");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 9. Provider Learning
  // ==========================================================================
  console.log("9. Provider Learning...");
  const eng9 = new LearningEngine(makeContext());
  const providerLearner = eng9.getProviderLearner();
  const provPatterns = providerLearner.learnProvider(history);

  assert(provPatterns.length === 1, "Should learn provider usage cost-performance benchmarks");
  assert(provPatterns[0].providerName === "OpenAI", "Preserves provider categorization name");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 10. Recommendation Generation
  // ==========================================================================
  console.log("10. Recommendation Generation...");
  const eng10 = new LearningEngine(makeContext());
  const recEngine = eng10.getRecommendationEngine();
  const allPatterns = [...eng10.getSuccessAnalyzer().analyzeSuccess(history), ...eng10.getFailureAnalyzer().analyzeFailure(history)];
  const recommendations = recEngine.generateRecommendations(allPatterns);

  assert(recommendations.length >= 2, "Should generate recommendations for both success and failure pattern inputs");
  assert(recommendations.some(r => r.priority === RecommendationPriority.CRITICAL), "Failure pattern must trigger critical recommendation");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 11. Knowledge Base Update
  // ==========================================================================
  console.log("11. Knowledge Base Update...");
  const eng11 = new LearningEngine(makeContext());
  const knMgr = eng11.getKnowledgeManager();
  
  const initialCount = knMgr.listEntries().length;
  const newEntry: KnowledgeEntry = {
    id: "kn-test-01", type: KnowledgeType.RULE, target: ImprovementTarget.GENERATION,
    title: "New Rule", description: "Bypasses failures", confidence: PatternConfidence.HIGH,
    updatedAt: new Date(), dependencies: [],
  };
  knMgr.updateKnowledge([newEntry]);
  assert(knMgr.listEntries().length === initialCount + 1, "Should update central knowledge entries database");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 12. Memory Integration
  // ==========================================================================
  console.log("12. Memory Integration...");
  const ctx12 = makeContext();
  const eng12 = new LearningEngine(ctx12);
  await eng12.initialize();
  await eng12.start();
  await eng12.learn(makeLearningRequest({ id: "req-mem-01" }), history);

  const memStore = ctx12.memoryStore._store as Map<string, any>;
  assert(memStore.has("learning-history:history:req-mem-01"), "Must write history counts to memory");
  assert(memStore.has("learning-patterns:patterns:req-mem-01"), "Must write extracted patterns to memory");
  assert(memStore.has("knowledge-base:graph:req-mem-01"), "Must write knowledge base graph stats to memory");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 13. Planning Integration
  // ==========================================================================
  console.log("13. Planning Integration...");
  let planningTaskCreated = false;
  const ctx13 = makeContext({
    planningEngine: {
      createTask: async (task: any) => {
        planningTaskCreated = true;
        assert(task.type === "LEARNING_CYCLE_COMPLETE", "Planning task type must match LEARNING_CYCLE_COMPLETE");
        assert(task.insightsCount !== undefined, "Planning task must include count of insights");
      },
    },
  });
  const eng13 = new LearningEngine(ctx13);
  await eng13.initialize();
  await eng13.start();
  await eng13.learn(makeLearningRequest({ id: "req-plan-01" }), history);
  assert(planningTaskCreated, "Planning task must be created upon cycle completion");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 14. Decision Integration
  // ==========================================================================
  console.log("14. Decision Integration...");
  let decisionRecorded = false;
  const ctx14 = makeContext({
    decisionEngine: {
      record: async (data: any) => {
        decisionRecorded = true;
        assert(data.learningRequestId === "req-dec-01", "Decision record must contain learning request ID");
        assert(data.patternsExtractedCount !== undefined, "Decision record must log patterns count");
      },
    },
  });
  const eng14 = new LearningEngine(ctx14);
  await eng14.initialize();
  await eng14.start();
  await eng14.learn(makeLearningRequest({ id: "req-dec-01" }), history);
  assert(decisionRecorded, "Decision record must be logged after cycle execution completes");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 15. Analytics Integration
  // ==========================================================================
  console.log("15. Analytics Integration...");
  const eng15 = new LearningEngine(makeContext());
  await eng15.initialize();
  await eng15.start();
  const resp15 = await eng15.learn(makeLearningRequest({ id: "req-anal-01" }), history);
  assert(resp15.updatedKnowledgeEntries.length > 0, "Should generate target improvement entries linking analytics history");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 16. Event Publishing
  // ==========================================================================
  console.log("16. Event Publishing...");
  const ctx16 = makeContext();
  const eng16 = new LearningEngine(ctx16);
  await eng16.initialize();
  await eng16.start();
  await eng16.learn(makeLearningRequest({ id: "req-evt-01" }), history);

  const evtNames = (ctx16.eventBus._events as any[]).map(e => e.name);
  assert(evtNames.includes("LearningStarted"), "LearningStarted event must be published");
  assert(evtNames.includes("HistoryCollected"), "HistoryCollected event must be published");
  assert(evtNames.includes("PatternDetected"), "PatternDetected event must be published");
  assert(evtNames.includes("LearningCompleted"), "LearningCompleted event must be published");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 17. Snapshot Immutability
  // ==========================================================================
  console.log("17. Snapshot Immutability...");
  const eng17 = new LearningEngine(makeContext());
  await eng17.initialize();
  const snap17 = eng17.getSnapshot();
  assert(Object.isFrozen(snap17), "LearningSnapshot root must be frozen");

  let mutationFailed = false;
  try { (snap17 as any).id = "mutated"; } catch (_) { mutationFailed = true; }
  assert(snap17.id !== "mutated" || mutationFailed, "Snapshot ID must be immutable");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 18. Validator Rules
  // ==========================================================================
  console.log("18. Validator Rules...");

  // 18a. Empty request ID
  try {
    LearningValidator.validateLearningRequest({ id: "", source: LearningSource.ANALYTICS, timestamp: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof LearningValidationException, "Empty request ID must fail validation");
  }

  // 18b. Negative duration
  try {
    LearningValidator.validateHistoryEntry({
      id: "bad", projectId: "1", source: LearningSource.STRATEGY, success: true,
      durationMs: -100, costUsd: 5.0, metrics: {}, timestamp: new Date()
    });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof LearningValidationException, "Negative duration must fail validation");
  }

  // 18c. Circular knowledge dependency
  const circularEntries: KnowledgeEntry[] = [
    { id: "kn-a", type: KnowledgeType.RULE, target: ImprovementTarget.SCRIPT, title: "A", description: "A", confidence: PatternConfidence.HIGH, updatedAt: new Date(), dependencies: ["kn-b"] },
    { id: "kn-b", type: KnowledgeType.RULE, target: ImprovementTarget.SCRIPT, title: "B", description: "B", confidence: PatternConfidence.HIGH, updatedAt: new Date(), dependencies: ["kn-a"] },
  ];
  try {
    LearningValidator.validateNoCircularKnowledgeReferences(circularEntries);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof LearningValidationException, "Circular knowledge dependencies must fail validation");
  }

  // 18d. Duplicate patterns
  const p1: LearningPattern = { id: "p1", type: LearningType.SUCCESS_PATTERN, name: "P1", description: "", confidence: PatternConfidence.MEDIUM, supportCount: 1, lastObservedAt: new Date(), features: {} };
  const p2: LearningPattern = { id: "p1", type: LearningType.FAILURE_PATTERN, name: "P2", description: "", confidence: PatternConfidence.MEDIUM, supportCount: 1, lastObservedAt: new Date(), features: {} };
  try {
    LearningValidator.validateNoDuplicatePatterns([p1, p2]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof LearningValidationException, "Duplicate patterns must fail validation");
  }

  // 18e. Empty datasets
  try {
    LearningValidator.validateDatasetNotEmpty([]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof LearningValidationException, "Empty dataset must fail validation");
  }

  console.log("✓ Passed.\n");

  // ==========================================================================
  // 19. Regression Tests
  // ==========================================================================
  console.log("19. Regression Tests...");
  // Verify that Sprint 15.2 ControlCenterEngine still functions properly alongside learning
  const CCContext = makeContext();
  const ccEng = new ControlCenterBuilder().withContext(CCContext).build();
  await ccEng.initialize();
  await ccEng.start();
  const ccResp = await ccEng.execute(makeControlRequest(ControlAction.PAUSE, { targetWorkflowId: "wf-reg" }));
  assert(ccResp.success, "Control Center Engine must function properly (regression test)");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 20. Full End-to-End Learning Pipeline
  // ==========================================================================
  console.log("20. Full End-to-End Learning Pipeline...");

  let e2eDecisionCalled = false;
  let e2ePlanningCalled = false;

  const ctxE2E = makeContext({
    decisionEngine: { record: async () => { e2eDecisionCalled = true; } },
    planningEngine: { createTask: async () => { e2ePlanningCalled = true; } },
  });

  const engE2E = new LearningBuilder()
    .withContext(ctxE2E)
    .withMetadata({ mode: "e2e-run" })
    .build();

  await engE2E.initialize();
  await engE2E.start();

  const reqE2E = makeLearningRequest({ id: "req-e2e-learning-cycle" });
  const respE2E = await engE2E.learn(reqE2E, history);

  assert(respE2E.state === LearningState.COMPLETED, "E2E: Engine must reach COMPLETED state");
  assert(respE2E.patterns.length > 0, "E2E: Must extract patterns");
  assert(respE2E.recommendations.length > 0, "E2E: Must generate recommendations");
  assert(respE2E.updatedKnowledgeEntries.length > 0, "E2E: Must update knowledge base");

  const reportE2E = engE2E.getReport();
  assert(reportE2E.metrics.totalHistoryProcessed > 0, "E2E: Report metrics compiled");

  assert(e2eDecisionCalled, "E2E: Decision integration triggered");
  assert(e2ePlanningCalled, "E2E: Planning integration triggered");

  // Event validation
  const evts = (ctxE2E.eventBus._events as any[]).map(e => e.name);
  assert(evts.includes("LearningStarted"), "E2E: LearningStarted published");
  assert(evts.includes("HistoryCollected"), "E2E: HistoryCollected published");
  assert(evts.includes("WorkflowLearned"), "E2E: WorkflowLearned published");
  assert(evts.includes("KnowledgeUpdated"), "E2E: KnowledgeUpdated published");
  assert(evts.includes("LearningCompleted"), "E2E: LearningCompleted published");

  console.log("✓ Passed.\n");

  console.log("=== ALL 20/20 LEARNING ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
