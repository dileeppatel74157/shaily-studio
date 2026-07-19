import { ProviderExecutionBuilder } from "./provider-execution/ProviderExecutionBuilder";
import { ExecutionState } from "./provider-execution/ExecutionState";
import { ExecutionMode } from "./provider-execution/ExecutionMode";
import { SelectionStrategy } from "./provider-execution/SelectionStrategy";
import { CacheType } from "./provider-execution/CacheType";
import { BudgetAlert } from "./provider-execution/BudgetAlert";
import { QualityMetric } from "./provider-execution/QualityMetric";
import { ExecutionValidationException, BudgetExceededException, EmergencyStopException } from "./provider-execution/types";
import { ExecutionValidator } from "./provider-execution/ExecutionValidator";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ FAILED:", message);
    process.exit(1);
  }
}

const mockContext = {
  logger: { info: (_m: string) => {}, warn: (_m: string) => {}, error: (_m: string) => {} },
  eventBus: { publish: async (_e: any) => {} }
};

let idCounter = 1;
const nextId = () => `req-${idCounter++}`;

function makeReq(overrides?: Partial<any>): any {
  return {
    requestId: nextId(),
    prompt: "Tell me about the Shaily Studio AI operating system and its capabilities.",
    mode: ExecutionMode.SEQUENTIAL,
    strategy: SelectionStrategy.BALANCED,
    stream: false,
    ...overrides
  };
}

async function runTests() {
  console.log("=== START SPRINT 24.2 PROVIDER EXECUTION & COST OPTIMIZATION TESTS ===\n");

  // ── 1. Builder Validation ──────────────────────────────────────────────────
  try {
    new ProviderExecutionBuilder().build();
    assert(false, "Builder should throw when context is missing.");
  } catch (err: any) {
    assert(err instanceof ExecutionValidationException, "Expected ExecutionValidationException.");
  }
  console.log("1. Builder Validation... ✓");

  // ── 2. Lifecycle Transitions ───────────────────────────────────────────────
  const engine = new ProviderExecutionBuilder().withContext(mockContext).build();
  assert(engine.getState() === ExecutionState.CREATED, "State should be CREATED.");

  await engine.initialize();
  assert(engine.getState() === ExecutionState.RUNNING, "State should be RUNNING.");

  await engine.stop();
  assert(engine.getState() === ExecutionState.STOPPED, "State should be STOPPED.");

  // Re-initialize for remaining tests
  await engine.initialize();
  console.log("2. Lifecycle Transitions... ✓");

  // ── 3. Provider Selection ─────────────────────────────────────────────────
  const selector = engine.getProviderSelector();
  const req3 = makeReq({ strategy: SelectionStrategy.QUALITY_OPTIMIZED });
  const selection = selector.selectBest(req3);
  assert(selection.selectedProviderId !== "", "Provider should be selected.");
  assert(selection.strategy === SelectionStrategy.QUALITY_OPTIMIZED, "Strategy mismatch.");
  assert(selection.scores.length === 9, `Expected 9 provider scores, got ${selection.scores.length}.`);
  // Quality-optimized should select OpenAI (score 92)
  assert(selection.selectedProviderId === "openai", `Quality-optimized should select openai, got ${selection.selectedProviderId}.`);
  console.log("3. Provider Selection... ✓");

  // ── 4. Cost Optimization ──────────────────────────────────────────────────
  const costOpt = engine.getCostOptimizer();
  const cheapReq = makeReq({ strategy: SelectionStrategy.COST_OPTIMIZED });
  const cheapSelection = selector.selectBest(cheapReq);
  // Ollama (free) or HuggingFace (near free) should win for cost-optimized
  assert(["ollama", "huggingface", "youtube", "instagram", "facebook"].includes(cheapSelection.selectedProviderId),
    `Cost-optimized should pick a cheap provider, got ${cheapSelection.selectedProviderId}.`);

  const scores = selector.scoreProviders(makeReq());
  const cheapest = costOpt.selectCheapest(scores);
  assert(["ollama", "youtube", "instagram", "facebook"].includes(cheapest),
    `selectCheapest should return free provider, got ${cheapest}.`);

  // Quality vs cost balancing
  const balanced = costOpt.balanceQualityVsCost(scores, 0.7); // 70% weight on quality
  assert(balanced !== "", "Balanced selection should return a provider.");
  console.log("4. Cost Optimization... ✓");

  // ── 5. Budget Protection ──────────────────────────────────────────────────
  const budget = engine.getBudgetProtector();

  // Small request — should be INFO
  const alert1 = budget.checkBudget(0.001);
  assert(alert1 === BudgetAlert.INFO, `Expected INFO alert for $0.001, got ${alert1}.`);

  // Huge request should trigger EMERGENCY_STOP
  const alert2 = budget.checkBudget(1000);
  assert(alert2 === BudgetAlert.EMERGENCY_STOP, `Expected EMERGENCY_STOP for $1000, got ${alert2}.`);

  // Budget status
  const status = budget.getBudgetStatus();
  assert(status.dailyLimitUsd === 10, "Daily budget limit should be $10.");
  assert(status.monthlyLimitUsd === 100, "Monthly budget limit should be $100.");
  assert(status.emergencyStopActive === false, "Emergency stop should not be active initially.");
  console.log("5. Budget Protection... ✓");

  // ── 6. Token Estimation ───────────────────────────────────────────────────
  const prompt6 = "Explain quantum computing in simple terms.";
  const tokenEst = costOpt.estimateTokens(prompt6);
  assert(tokenEst.estimatedPromptTokens > 0, "Prompt tokens should be positive.");
  assert(tokenEst.estimatedCompletionTokens > 0, "Completion tokens should be positive.");
  assert(tokenEst.confidencePercent > 0 && tokenEst.confidencePercent <= 100, "Confidence should be 0-100.");
  // Basic accuracy check: ~4 chars per token
  const expectedTokens = Math.ceil(prompt6.length / 4);
  assert(tokenEst.estimatedPromptTokens === expectedTokens, `Token estimate mismatch: expected ${expectedTokens}, got ${tokenEst.estimatedPromptTokens}.`);
  console.log("6. Token Estimation... ✓");

  // ── 7. Cost Prediction ────────────────────────────────────────────────────
  // Run a few requests to seed history
  await engine.execute(makeReq({ providerId: "openai" }));
  await engine.execute(makeReq({ providerId: "gemini" }));

  const prediction = costOpt.predictCost(30);
  assert(prediction.periodDays === 30, "Prediction period should be 30 days.");
  assert(prediction.predictedDailyCostUsd >= 0, "Predicted daily cost should be non-negative.");
  assert(prediction.predictedMonthlyCostUsd >= prediction.predictedDailyCostUsd, "Monthly cost should be >= daily.");
  assert(prediction.confidencePercent > 0, "Confidence should be positive.");
  console.log("7. Cost Prediction... ✓");

  // ── 8. Smart Caching ──────────────────────────────────────────────────────
  const cache = engine.getSmartCache();
  const cacheKey = cache.buildCacheKey("test prompt", "openai", "gpt-4o");
  assert(cacheKey.length > 0, "Cache key should not be empty.");

  cache.set(cacheKey, CacheType.RESPONSE, { content: "cached response" }, 3600);
  const hit = cache.get(cacheKey, CacheType.RESPONSE);
  assert(hit !== undefined, "Cache should return the stored entry.");
  assert((hit!.value as any).content === "cached response", "Cached value mismatch.");

  const stats = cache.getStats();
  assert(stats.hitCount >= 1, "Hit count should be at least 1.");
  assert(stats.totalEntries > 0, "Total entries should be positive.");
  console.log("8. Smart Caching... ✓");

  // ── 9. Cache Invalidation ─────────────────────────────────────────────────
  const invKey = cache.buildCacheKey("to be invalidated", "gemini", "gemini-flash");
  cache.set(invKey, CacheType.RESPONSE, { data: "temp" }, 3600);
  const beforeInv = cache.get(invKey, CacheType.RESPONSE);
  assert(beforeInv !== undefined, "Entry should exist before invalidation.");

  const removed = cache.invalidate(invKey);
  assert(removed === true, "invalidate() should return true.");
  const afterInv = cache.get(invKey, CacheType.RESPONSE);
  assert(afterInv === undefined, "Entry should not exist after invalidation.");

  // Cache warming
  cache.warm([{ key: "warm-key-1", type: CacheType.PROMPT, value: "warmed prompt 1" }]);
  const warmed = cache.get("warm-key-1", CacheType.PROMPT);
  assert(warmed !== undefined, "Warmed cache entry should be accessible.");
  const finalStats = cache.getStats();
  assert(finalStats.lastWarmedAt !== undefined, "lastWarmedAt should be set after warming.");
  console.log("9. Cache Invalidation... ✓");

  // ── 10. Parallel Execution ────────────────────────────────────────────────
  const parallelReqs = [
    makeReq({ providerId: "openai",  prompt: "Parallel request 1" }),
    makeReq({ providerId: "gemini",  prompt: "Parallel request 2" }),
    makeReq({ providerId: "ollama",  prompt: "Parallel request 3" })
  ];
  const parallelResults = await engine.getExecutionManager().executeParallel(parallelReqs);
  assert(parallelResults.length === 3, `Parallel execution should return 3 results, got ${parallelResults.length}.`);
  assert(parallelResults.every(r => r.content.length > 0), "All parallel responses should have content.");
  console.log("10. Parallel Execution... ✓");

  // ── 11. Sequential Execution ──────────────────────────────────────────────
  const seqReqs = [
    makeReq({ providerId: "openai",  prompt: "Sequential request 1" }),
    makeReq({ providerId: "gemini",  prompt: "Sequential request 2" })
  ];
  const seqResults = await engine.getExecutionManager().executeSequential(seqReqs);
  assert(seqResults.length === 2, `Sequential execution should return 2 results, got ${seqResults.length}.`);
  console.log("11. Sequential Execution... ✓");

  // ── 12. Streaming Execution ───────────────────────────────────────────────
  const streamReq = makeReq({ stream: true, prompt: "Stream the response word by word." });
  const chunks: string[] = [];
  for await (const chunk of engine.stream(streamReq)) {
    chunks.push(chunk);
  }
  assert(chunks.length > 0, "Streaming should yield at least one chunk.");
  const reconstructed = chunks.join("").trim();
  assert(reconstructed.length > 0, "Reconstructed stream should not be empty.");
  console.log("12. Streaming Execution... ✓");

  // ── 13. Multi-Provider Execution ──────────────────────────────────────────
  const providers = ["openai", "gemini", "ollama"];
  const multiResults = await Promise.all(
    providers.map(pid => engine.execute(makeReq({ providerId: pid, prompt: "Multi-provider test." })))
  );
  assert(multiResults.length === 3, "Multi-provider execution should return 3 results.");
  const providerIds = multiResults.map(r => r.providerId);
  assert(providerIds.includes("openai"),  "OpenAI result missing.");
  assert(providerIds.includes("gemini"),  "Gemini result missing.");
  assert(providerIds.includes("ollama"),  "Ollama result missing.");
  console.log("13. Multi-Provider Execution... ✓");

  // ── 14. Quality Scoring ───────────────────────────────────────────────────
  const quality = engine.getQualityEvaluator();
  const sampleResponse = multiResults[0];
  const qs = quality.score(sampleResponse);
  assert(qs.overallScore >= 0 && qs.overallScore <= 100, `Quality score out of range: ${qs.overallScore}.`);
  assert(qs.confidence > 0 && qs.confidence <= 1, "Confidence should be 0-1.");
  assert(Object.keys(qs.metrics).length === 5, "Should have 5 quality metrics.");
  assert(QualityMetric.RELEVANCE in qs.metrics, "RELEVANCE metric missing.");
  assert(QualityMetric.COHERENCE in qs.metrics, "COHERENCE metric missing.");
  console.log("14. Quality Scoring... ✓");

  // ── 15. Response Ranking ──────────────────────────────────────────────────
  const ranked = quality.compareResponses(multiResults);
  assert(ranked.length === 3, `Expected 3 ranked responses, got ${ranked.length}.`);
  assert(ranked[0].rank === 1, "First ranked response should have rank 1.");
  assert(ranked[0].selected === true, "First ranked response should be selected.");
  assert(ranked[1].selected === false, "Second ranked response should not be selected.");
  // Quality score should be in descending order
  assert(ranked[0].qualityScore.overallScore >= ranked[1].qualityScore.overallScore, "Ranked responses should be in descending order.");

  const best = quality.selectBestResponse(ranked);
  assert(best.requestId === ranked[0].response.requestId, "selectBestResponse should return rank-1 response.");
  console.log("15. Response Ranking... ✓");

  // ── 16. Runtime Integration ───────────────────────────────────────────────
  const runtimeCtx = { env: "test", namespace: "runtime-execution-test", startTime: Date.now() };
  const runtimeCfg = { env: "test", heartbeatIntervalMs: 500, healthCheckIntervalMs: 1000, startupTimeoutMs: 500, shutdownTimeoutMs: 500 };
  const runtime = new RuntimeBuilder().withContext(runtimeCtx).withConfig(runtimeCfg).build();

  assert(runtime !== null, "RuntimeEngine should build.");
  const execSvc = runtime.getEngine("ProviderExecutionEngine");
  assert(execSvc !== undefined, "ProviderExecutionEngine must be registered in RuntimeEngine.");

  await runtime.initialize();
  console.log("16. Runtime Integration... ✓");

  // ── 17. Snapshot Immutability ─────────────────────────────────────────────
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "Snapshot should be frozen.");
  assert(Object.isFrozen(snap.configuration), "Configuration should be frozen.");
  assert(snap.state === ExecutionState.RUNNING, "Snapshot state should be RUNNING.");
  console.log("17. Snapshot Immutability... ✓");

  // ── 18. Validator Rules ───────────────────────────────────────────────────
  const validator = new ExecutionValidator();

  // Invalid config: monthly < daily
  try {
    validator.validate({
      state: ExecutionState.RUNNING,
      configuration: { ...engine.getSnapshot().configuration, monthlyBudgetUsd: 0.5, dailyBudgetUsd: 10 },
      timestamp: new Date()
    });
    assert(false, "Should throw for monthlyBudget < dailyBudget.");
  } catch (err: any) {
    assert(err instanceof ExecutionValidationException, "Expected ExecutionValidationException.");
  }

  // Invalid quality score
  try {
    validator.validateQualityScore(150);
    assert(false, "Should throw for score > 100.");
  } catch (err: any) {
    assert(err instanceof ExecutionValidationException, "Expected ExecutionValidationException.");
  }

  // Valid config should not throw
  validator.validate(engine.getSnapshot());
  console.log("18. Validator Rules... ✓");

  // ── 19. Budget Recovery ───────────────────────────────────────────────────
  const freshEngine = new ProviderExecutionBuilder().withContext(mockContext).build();
  await freshEngine.initialize();

  freshEngine.getBudgetProtector().triggerEmergencyStop("Test budget recovery.");
  assert(freshEngine.getBudgetProtector().isEmergencyStopActive() === true, "Emergency stop should be active.");

  try {
    await freshEngine.execute(makeReq());
    assert(false, "Should throw EmergencyStopException when stop is active.");
  } catch (err: any) {
    assert(err instanceof EmergencyStopException, "Expected EmergencyStopException.");
  }

  freshEngine.getBudgetProtector().resetEmergencyStop();
  assert(freshEngine.getBudgetProtector().isEmergencyStopActive() === false, "Emergency stop should be reset.");

  // Should work again after reset
  const recoveredResp = await freshEngine.execute(makeReq({ providerId: "ollama" }));
  assert(recoveredResp.content.length > 0, "Engine should work after budget recovery.");
  console.log("19. Budget Recovery... ✓");

  // ── 20. Complete End-to-End Provider Execution ────────────────────────────
  const e2eEngine = new ProviderExecutionBuilder()
    .withContext(mockContext)
    .withConfig({ founderPreferredProviders: ["gemini"], enableQualityEvaluation: true, enableSmartCache: true, enableBudgetProtection: true })
    .build();
  await e2eEngine.initialize();

  // 1. Token estimation
  const e2ePrompt = "Full end-to-end test: generate a detailed script for a YouTube video about AI.";
  const e2eTokens = e2eEngine.getCostOptimizer().estimateTokens(e2ePrompt);
  assert(e2eTokens.estimatedPromptTokens > 0, "E2E token estimate should be positive.");

  // 2. Provider selection with founder preference
  const e2eSelection = e2eEngine.getProviderSelector().selectBest(makeReq({
    prompt: e2ePrompt,
    strategy: SelectionStrategy.FOUNDER_PREFERRED
  }));
  // Founder-preferred should boost gemini/openai
  assert(["gemini", "openai"].includes(e2eSelection.selectedProviderId),
    `Founder preferred selection should be openai or gemini, got ${e2eSelection.selectedProviderId}.`);

  // 3. Full execution
  const e2eReq = makeReq({ prompt: e2ePrompt, providerId: e2eSelection.selectedProviderId, strategy: SelectionStrategy.FOUNDER_PREFERRED });
  const e2eResp = await e2eEngine.execute(e2eReq);
  assert(e2eResp.content.length > 0, "E2E response should have content.");
  assert(e2eResp.costUsd >= 0, "E2E cost should be non-negative.");
  assert(e2eResp.totalTokens > 0, "E2E total tokens should be positive.");
  assert(e2eResp.qualityScore !== undefined, "Quality score should be set.");

  // 4. Cache — second identical request should hit cache
  const e2eReq2 = { ...e2eReq, requestId: nextId() };
  const e2eResp2 = await e2eEngine.execute(e2eReq2);
  assert(e2eResp2.cacheHit === true, "Second identical request should hit cache.");

  // 5. Full report
  const e2eReport = await e2eEngine.getReporter().generateReport();
  assert(e2eReport.totalRequests >= 1, "E2E report should count at least 1 request.");
  assert(e2eReport.cacheHitRate >= 0 && e2eReport.cacheHitRate <= 1, "Cache hit rate should be 0-1.");
  assert(e2eReport.budgetStatus.dailyLimitUsd === 10, "Budget status should be in report.");
  assert(e2eReport.costPrediction.periodDays === 30, "Cost prediction should be in report.");

  // 6. Performance optimizer
  const benchmark = e2eEngine.getPerformanceOptimizer().getProviderBenchmark(e2eSelection.selectedProviderId);
  assert(benchmark.providerId === e2eSelection.selectedProviderId, "Benchmark providerId mismatch.");
  assert(benchmark.averageLatencyMs >= 0, "Benchmark average latency should be non-negative.");
  assert(benchmark.successRate > 0 && benchmark.successRate <= 1, "Success rate should be 0-1.");

  // 7. Queue optimization
  const queueReqs = [
    makeReq({ providerId: "openai",  prompt: "Expensive OpenAI request" }),
    makeReq({ providerId: "ollama",  prompt: "Free Ollama request" }),
    makeReq({ providerId: "gemini",  prompt: "Medium cost Gemini request" })
  ];
  const optimized = e2eEngine.getPerformanceOptimizer().optimizeQueue(queueReqs);
  assert(optimized.length === 3, "Optimized queue should have same count.");
  // Ollama (free) should be first in cost-optimized queue
  assert(optimized[0].providerId === "ollama", `Queue should start with cheapest (ollama), got ${optimized[0].providerId}.`);

  await e2eEngine.stop();
  assert(e2eEngine.getState() === ExecutionState.STOPPED, "E2E engine should be STOPPED.");

  console.log("20. Complete End-to-End Provider Execution... ✓\n");
  console.log("=== ALL 20/20 PROVIDER EXECUTION & COST OPTIMIZATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite threw an exception:", err);
  process.exit(1);
});
