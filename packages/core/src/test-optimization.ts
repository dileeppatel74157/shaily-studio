/**
 * Sprint 16.2 — Optimization Engine
 * Verification Suite — 20 Tests
 */

import { OptimizationEngine }       from "./optimization/OptimizationEngine";
import { OptimizationBuilder }      from "./optimization/OptimizationBuilder";
import { OptimizationValidator }    from "./optimization/OptimizationValidator";
import { OptimizationState }        from "./optimization/OptimizationState";
import { OptimizationTarget }       from "./optimization/OptimizationTarget";
import { OptimizationStrategy }     from "./optimization/OptimizationStrategy";
import { OptimizationPriority }     from "./optimization/OptimizationPriority";
import { OptimizationStatus }       from "./optimization/OptimizationStatus";
import { OptimizationSource }       from "./optimization/OptimizationSource";
import { OptimizationResult }       from "./optimization/OptimizationResult";
import {
  OptimizationValidationException,
  OptimizationException,
  RuleException,
  ImpactException,
  RollbackException,
} from "./optimization/types";
import type {
  OptimizationRequest,
  OptimizationResponse,
  OptimizationRule,
  OptimizationCandidate,
  OptimizationExecution,
  OptimizationReport,
  OptimizationSnapshot,
  OptimizationImpact,
} from "./optimization/models";
import { LearningEngine }           from "./learning/LearningEngine";
import { LearningSource }           from "./learning/LearningSource";

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

function makeOptRequest(overrides: Partial<OptimizationRequest> = {}): OptimizationRequest {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    source: OptimizationSource.LEARNING_ENGINE,
    strategy: OptimizationStrategy.HYBRID,
    targets: Object.values(OptimizationTarget),
    timestamp: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START SPRINT 16.2 OPTIMIZATION ENGINE TESTS ===\n");

  const mockInsights = [
    { id: "insight-01", title: "Slow Render Speed", description: "Rendering is taking too long due to codec bottlenecks", source: "RENDERING" },
  ];

  // ==========================================================================
  // 1. Builder Validation
  // ==========================================================================
  console.log("1. Builder Validation...");
  try {
    new OptimizationBuilder().build();
    throw new Error("Expected OptimizationValidationException");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Builder without context must throw OptimizationValidationException");
  }
  const builder = new OptimizationBuilder().withContext(makeContext()).withMetadata({ sprint: "16.2" });
  const eng1 = builder.build();
  assert(eng1 instanceof OptimizationEngine, "Builder must construct OptimizationEngine");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 2. Lifecycle Transitions
  // ==========================================================================
  console.log("2. Lifecycle Transitions...");
  const eng2 = new OptimizationEngine(makeContext());
  assert(eng2.state === OptimizationState.CREATED, "Initial state must be CREATED");
  await eng2.initialize();
  assert(eng2.state === OptimizationState.INITIALIZED, "State must transition to INITIALIZED");
  await eng2.start();
  assert(eng2.state === OptimizationState.RUNNING, "State must transition to RUNNING");
  await eng2.stop();
  assert(eng2.state === OptimizationState.FAILED, "State must transition to FAILED");

  // Invalid state transition
  try {
    OptimizationValidator.validateStateTransition("test", OptimizationState.CREATED, OptimizationState.COMPLETED);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Invalid transition must fail validation");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 3. Prompt Optimization
  // ==========================================================================
  console.log("3. Prompt Optimization...");
  const eng3 = new OptimizationEngine(makeContext());
  const promptOpt = eng3.getPromptOptimizer();
  const cands3 = promptOpt.optimizePrompts(mockInsights);
  assert(cands3.length === 1, "Should generate exactly 1 prompt optimization candidate");
  assert(cands3[0].target === OptimizationTarget.PROMPT, "Target type must match PROMPT");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 4. Workflow Optimization
  // ==========================================================================
  console.log("4. Workflow Optimization...");
  const eng4 = new OptimizationEngine(makeContext());
  const workflowOpt = eng4.getWorkflowOptimizer();
  const cands4 = workflowOpt.optimizeWorkflow(mockInsights);
  assert(cands4.length === 1, "Should generate exactly 1 workflow candidate");
  assert(cands4[0].target === OptimizationTarget.WORKFLOW, "Target type must match WORKFLOW");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 5. Decision Optimization
  // ==========================================================================
  console.log("5. Decision Optimization...");
  const eng5 = new OptimizationEngine(makeContext());
  const decisionOpt = eng5.getDecisionOptimizer();
  const cands5 = decisionOpt.optimizeDecision(mockInsights);
  assert(cands5.length === 1, "Should generate exactly 1 decision candidate");
  assert(cands5[0].target === OptimizationTarget.DECISION, "Target type must match DECISION");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 6. Planning Optimization
  // ==========================================================================
  console.log("6. Planning Optimization...");
  const eng6 = new OptimizationEngine(makeContext());
  const planningOpt = eng6.getPlanningOptimizer();
  const cands6 = planningOpt.optimizePlanning(mockInsights);
  assert(cands6.length === 1, "Should generate exactly 1 planning candidate");
  assert(cands6[0].target === OptimizationTarget.PLANNING, "Target type must match PLANNING");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 7. Generation Optimization
  // ==========================================================================
  console.log("7. Generation Optimization...");
  const eng7 = new OptimizationEngine(makeContext());
  const genOpt = eng7.getGenerationOptimizer();
  const cands7 = genOpt.optimizeGeneration(mockInsights);
  assert(cands7.length === 1, "Should generate exactly 1 generation candidate");
  assert(cands7[0].target === OptimizationTarget.GENERATION, "Target type must match GENERATION");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 8. Render Optimization
  // ==========================================================================
  console.log("8. Render Optimization...");
  const eng8 = new OptimizationEngine(makeContext());
  const renderOpt = eng8.getRenderOptimizer();
  const cands8 = renderOpt.optimizeRender(mockInsights);
  assert(cands8.length === 1, "Should generate exactly 1 render candidate");
  assert(cands8[0].target === OptimizationTarget.RENDERING, "Target type must match RENDERING");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 9. Provider Optimization
  // ==========================================================================
  console.log("9. Provider Optimization...");
  const eng9 = new OptimizationEngine(makeContext());
  const provOpt = eng9.getProviderOptimizer();
  const cands9 = provOpt.optimizeProvider(mockInsights);
  assert(cands9.length === 1, "Should generate exactly 1 provider candidate");
  assert(cands9[0].target === OptimizationTarget.PROVIDER, "Target type must match PROVIDER");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 10. Candidate Ranking
  // ==========================================================================
  console.log("10. Candidate Ranking...");
  const eng10 = new OptimizationEngine(makeContext());
  await eng10.initialize();
  await eng10.start();

  const req10 = makeOptRequest({ targets: [OptimizationTarget.PROMPT, OptimizationTarget.PROVIDER] });
  const resp10 = await eng10.optimize(req10, mockInsights);

  const snapshot10 = eng10.getSnapshot();
  // Rank 1 should be provider candidate because it has 30% expected improvement vs prompt's 15%
  assert(snapshot10.candidates[0].target === OptimizationTarget.PROVIDER, "Highest improvement target must rank first");
  assert(snapshot10.candidates[0].rank === 1, "Rank index must be assigned starting from 1");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 11. Learning Integration
  // ==========================================================================
  console.log("11. Learning Integration...");
  // Verifying that learning outputs flow cleanly into the optimization cycle
  const learningCtx = makeContext();
  const learnEng = new LearningEngine(learningCtx);
  await learnEng.initialize();
  await learnEng.start();

  const lRequest = { id: "req-learn", source: LearningSource.ANALYTICS, timestamp: new Date() };
  const lHistory = [{ id: "h-1", projectId: "p-1", source: LearningSource.ANALYTICS, success: true, durationMs: 1500, costUsd: 0.10, metrics: {}, timestamp: new Date() }];
  const lResponse = await learnEng.learn(lRequest, lHistory);

  const optEng11 = new OptimizationEngine(learningCtx);
  await optEng11.initialize();
  await optEng11.start();
  const oResponse = await optEng11.optimize(makeOptRequest(), lResponse.patterns);
  assert(oResponse.appliedCount > 0, "Should run optimization cycle over LearningEngine output patterns");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 12. Analytics Integration
  // ==========================================================================
  console.log("12. Analytics Integration...");
  const eng12 = new OptimizationEngine(makeContext());
  await eng12.initialize();
  await eng12.start();
  const resp12 = await eng12.optimize(makeOptRequest(), mockInsights);
  assert(resp12.results.length > 0, "Optimization results metrics should be produced");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 13. Decision Integration
  // ==========================================================================
  console.log("13. Decision Integration...");
  let decisionRecorded = false;
  const ctx13 = makeContext({
    decisionEngine: {
      record: async (data: any) => {
        decisionRecorded = true;
        assert(data.optimizationRequestId === "req-dec-01", "Decision record must contain optimization request ID");
        assert(data.appliedCount !== undefined, "Decision record must log applied count");
      },
    },
  });
  const eng13 = new OptimizationEngine(ctx13);
  await eng13.initialize();
  await eng13.start();
  await eng13.optimize(makeOptRequest({ id: "req-dec-01" }), mockInsights);
  assert(decisionRecorded, "Decision record must be logged after optimization cycle completes");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 14. Memory Integration
  // ==========================================================================
  console.log("14. Memory Integration...");
  const ctx14 = makeContext();
  const eng14 = new OptimizationEngine(ctx14);
  await eng14.initialize();
  await eng14.start();
  await eng14.optimize(makeOptRequest({ id: "req-mem-01" }), mockInsights);

  const memStore = ctx14.memoryStore._store as Map<string, any>;
  assert(memStore.has("optimization-history:history:req-mem-01"), "Must write history count to memory");
  assert(memStore.has("optimization-rules:rules:req-mem-01"), "Must write active rules count to memory");
  assert(memStore.has("optimization-impact:impact:req-mem-01"), "Must write applied candidates count to memory");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 15. Agent Integration
  // ==========================================================================
  console.log("15. Agent Integration...");
  const eng15 = new OptimizationEngine(makeContext());
  assert(typeof eng15.getPromptOptimizer     === "function", "Sub-optimizer prompt method exists");
  assert(typeof eng15.getWorkflowOptimizer   === "function", "Sub-optimizer workflow method exists");
  assert(typeof eng15.getDecisionOptimizer   === "function", "Sub-optimizer decision method exists");
  assert(typeof eng15.getPlanningOptimizer   === "function", "Sub-optimizer planning method exists");
  assert(typeof eng15.getGenerationOptimizer === "function", "Sub-optimizer generation method exists");
  assert(typeof eng15.getRenderOptimizer     === "function", "Sub-optimizer render method exists");
  assert(typeof eng15.getProviderOptimizer   === "function", "Sub-optimizer provider method exists");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 16. Event Publishing
  // ==========================================================================
  console.log("16. Event Publishing...");
  const ctx16 = makeContext();
  const eng16 = new OptimizationEngine(ctx16);
  await eng16.initialize();
  await eng16.start();
  await eng16.optimize(makeOptRequest(), mockInsights);

  const evtNames = (ctx16.eventBus._events as any[]).map(e => e.name);
  assert(evtNames.includes("OptimizationStarted"), "OptimizationStarted event must be published");
  assert(evtNames.includes("OptimizationCandidateFound"), "OptimizationCandidateFound event must be published");
  assert(evtNames.includes("OptimizationValidated"), "OptimizationValidated event must be published");
  assert(evtNames.includes("OptimizationApplied"), "OptimizationApplied event must be published");
  assert(evtNames.includes("OptimizationCompleted"), "OptimizationCompleted event must be published");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 17. Rollback Validation
  // ==========================================================================
  console.log("17. Rollback Validation...");
  const eng17 = new OptimizationEngine(makeContext());
  await eng17.initialize();
  await eng17.start();

  // Test rollback execution path
  const executor = eng17.getExecutor();
  const badCandidate: OptimizationCandidate = {
    id: "cand-bad-01", target: OptimizationTarget.RENDERING, strategy: OptimizationStrategy.SPEED,
    priority: OptimizationPriority.HIGH, currentValue: {}, proposedValue: { degraded: true },
    expectedImprovementPercent: -20, confidenceScore: 0.9,
  };
  const execObj = await executor.execute(badCandidate);
  assert(execObj.status === OptimizationStatus.ROLLED_BACK, "Executor must trigger rollback on degraded performance results");
  assert(execObj.rollbackPath !== undefined, "Rollback path must be registered");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 18. Snapshot Immutability
  // ==========================================================================
  console.log("18. Snapshot Immutability...");
  const eng18 = new OptimizationEngine(makeContext());
  await eng18.initialize();
  const snap18 = eng18.getSnapshot();
  assert(Object.isFrozen(snap18), "OptimizationSnapshot root must be frozen");

  let mutationFailed = false;
  try { (snap18 as any).id = "mutated"; } catch (_) { mutationFailed = true; }
  assert(snap18.id !== "mutated" || mutationFailed, "Snapshot ID must be immutable");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 19. Validator Rules
  // ==========================================================================
  console.log("19. Validator Rules...");

  // 19a. Empty request ID
  try {
    OptimizationValidator.validateRequest({ id: "", source: OptimizationSource.FOUNDER, strategy: OptimizationStrategy.HYBRID, targets: [OptimizationTarget.PROMPT], timestamp: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Empty request ID must fail validation");
  }

  // 19b. Invalid confidenceScore
  try {
    OptimizationValidator.validateScores({
      id: "c-1", target: OptimizationTarget.PROMPT, strategy: OptimizationStrategy.SPEED,
      priority: OptimizationPriority.NORMAL, currentValue: {}, proposedValue: {},
      expectedImprovementPercent: 20, confidenceScore: 1.5,
    });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "confidenceScore > 1 must fail validation");
  }

  // 19c. Circular dependency in rules
  const circularRules: OptimizationRule[] = [
    { id: "rule-a", name: "A", target: OptimizationTarget.PROMPT, priority: OptimizationPriority.HIGH, condition: "", parameterConfig: {}, active: true, dependencies: ["rule-b"] },
    { id: "rule-b", name: "B", target: OptimizationTarget.PROMPT, priority: OptimizationPriority.HIGH, condition: "", parameterConfig: {}, active: true, dependencies: ["rule-a"] },
  ];
  try {
    OptimizationValidator.validateNoCircularRules(circularRules);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Circular rule dependencies must fail validation");
  }

  // 19d. Conflicting optimizations
  const c1: OptimizationCandidate = { id: "c1", target: OptimizationTarget.PROMPT, strategy: OptimizationStrategy.SPEED, priority: OptimizationPriority.HIGH, currentValue: {}, proposedValue: { style: "bold" }, expectedImprovementPercent: 10, confidenceScore: 0.8 };
  const c2: OptimizationCandidate = { id: "c2", target: OptimizationTarget.PROMPT, strategy: OptimizationStrategy.SPEED, priority: OptimizationPriority.HIGH, currentValue: {}, proposedValue: { style: "minimalist" }, expectedImprovementPercent: 20, confidenceScore: 0.8 };
  try {
    OptimizationValidator.validateNoConflictingOptimizations([c1, c2]);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Conflicting target values must fail validation");
  }

  // 19e. Empty targets list
  try {
    OptimizationValidator.validateRequest({ id: "req-1", source: OptimizationSource.SYSTEM, strategy: OptimizationStrategy.SPEED, targets: [], timestamp: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof OptimizationValidationException, "Empty targets list must fail validation");
  }

  console.log("✓ Passed.\n");

  // ==========================================================================
  // 20. Full End-to-End Optimization
  // ==========================================================================
  console.log("20. Full End-to-End Optimization...");

  let e2eDecisionCalled = false;
  let e2ePlanningCalled = false;

  const ctxE2E = makeContext({
    decisionEngine: { record: async () => { e2eDecisionCalled = true; } },
    planningEngine: { createTask: async () => { e2ePlanningCalled = true; } },
  });

  const engE2E = new OptimizationBuilder()
    .withContext(ctxE2E)
    .withMetadata({ mode: "e2e-run" })
    .build();

  await engE2E.initialize();
  await engE2E.start();

  const reqE2E = makeOptRequest({ id: "req-e2e-opt-cycle" });
  const respE2E = await engE2E.optimize(reqE2E, mockInsights);

  assert(respE2E.state === OptimizationState.COMPLETED, "E2E: Engine must reach COMPLETED state");
  assert(respE2E.appliedCount > 0, "E2E: Must successfully apply candidates");
  assert(respE2E.results.length > 0, "E2E: Must log results of executions");

  const reportE2E = engE2E.getReport();
  assert(reportE2E.metrics.accuracy > 0, "E2E: Metrics reporting compiled");

  assert(e2eDecisionCalled, "E2E: Decision integration triggered");
  assert(e2ePlanningCalled, "E2E: Planning integration triggered");

  // Events emitted validation
  const evts = (ctxE2E.eventBus._events as any[]).map(e => e.name);
  assert(evts.includes("OptimizationStarted"), "E2E: OptimizationStarted published");
  assert(evts.includes("OptimizationApplied"), "E2E: OptimizationApplied published");
  assert(evts.includes("OptimizationCompleted"), "E2E: OptimizationCompleted published");

  console.log("✓ Passed.\n");

  console.log("=== ALL 20/20 OPTIMIZATION ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
