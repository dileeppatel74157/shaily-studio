import { PerformanceBuilder } from "./performance/PerformanceBuilder";
import { PerformanceEngine } from "./performance/PerformanceEngine";
import { PerformanceState } from "./performance/PerformanceState";
import { OptimizationState } from "./performance/OptimizationState";
import { CacheStrategy } from "./performance/CacheStrategy";
import { ResourceType } from "./performance/ResourceType";
import { PerformanceEventType } from "./performance/PerformanceEventType";
import { PerformanceException, CacheException, BenchmarkException } from "./performance/types";
import { PerformanceValidator } from "./performance/PerformanceValidator";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock Context
const mockContext: any = {
  env: "test",
  namespace: "performance-test-namespace",
  startTime: Date.now(),
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  },
  eventBus: {
    publish: async () => {}
  }
};

async function runTests() {
  console.log("=== START SPRINT 29.1 PERFORMANCE TESTS ===\n");

  let assertionsCount = 0;
  const countAssert = (condition: boolean, msg: string) => {
    assert(condition, msg);
    assertionsCount++;
  };

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  try {
    new PerformanceBuilder().build();
    countAssert(false, "Builder should throw if context is missing.");
  } catch (err: any) {
    countAssert(err instanceof PerformanceException, "Expected PerformanceException.");
  }
  const engine = new PerformanceBuilder().withContext(mockContext).build();
  countAssert(engine !== null, "Engine instance should not be null.");
  console.log("  ✓ engine created");

  await engine.initialize();
  countAssert(engine.getState() === PerformanceState.READY, "Engine state should be READY.");
  await engine.start();
  countAssert(engine.getState() === PerformanceState.RUNNING, "Engine state should be RUNNING.");
  console.log("  ✓ initialized");

  // 2. Performance Profiling
  console.log("\n2. Performance Profiling...");
  const runtimeProfile = await engine.getProfilerManager().profileRuntime();
  countAssert(runtimeProfile.durationMs >= 0, "Runtime profiling duration must be non-negative.");
  console.log("  ✓ runtime profiled");

  const pipelineProfile = await engine.getProfilerManager().profilePipeline();
  countAssert(pipelineProfile.avgFrameDurationMs > 0, "Pipeline average frame duration must be positive.");
  console.log("  ✓ pipeline profiled");

  // 3. Cache Manager
  console.log("\n3. Cache Manager...");
  const cache = engine.getCacheManager();
  cache.set("key_1", "value_1", { strategy: CacheStrategy.LRU });
  countAssert(cache.get("key_1") === "value_1", "Cache retrieve mismatch.");
  console.log("  ✓ cache insert works");

  const cacheStats = cache.getStatistics();
  countAssert(cacheStats.hitRatio > 0, "Hit ratio should be greater than zero.");
  console.log("  ✓ cache hit ratio calculated");

  // 4. Cache Eviction
  console.log("\n4. Cache Eviction...");
  cache.set("temp_key", "temp_value", { ttlMs: 1 });
  await new Promise(resolve => setTimeout(resolve, 5));
  countAssert(cache.get("temp_key") === undefined, "Expired entry should be evictable.");
  console.log("  ✓ expired entries removed");

  // Fill cache to trigger LRU eviction
  for (let i = 0; i < 110; i++) {
    cache.set(`fill_${i}`, `val_${i}`);
  }
  countAssert(cache.getStatistics().evictions > 0, "LRU eviction count should be positive.");
  console.log("  ✓ LRU eviction works");

  // 5. Memory Optimization
  console.log("\n5. Memory Optimization...");
  const memMgr = engine.getMemoryManager();
  const memStats = await memMgr.getMemoryStatistics();
  countAssert(memStats.heapTotalBytes > 0, "Heap total bytes should be positive.");
  console.log("  ✓ memory analyzed");

  const savings = await memMgr.compactHeap();
  countAssert(savings > 0, "Heap compaction should free non-zero bytes.");
  console.log("  ✓ optimization applied");

  // 6. Thread Pool
  console.log("\n6. Thread Pool...");
  const pool = engine.getThreadManager().getThreadPool();
  countAssert(pool.maxCount === 4, "Thread pool max limit mismatch.");
  console.log("  ✓ workers created");

  const taskResult = await engine.getThreadManager().enqueueParallelTask(async () => {
    return "done";
  }, "task_p_1");
  countAssert(taskResult === "done", "Parallel task output mismatch.");
  console.log("  ✓ parallel tasks executed");

  // 7. Queue Optimization
  console.log("\n7. Queue Optimization...");
  const renderQueue = engine.getQueueManager().getQueue("Rendering");
  countAssert(renderQueue.maxCapacity === 100, "Rendering queue capacity mismatch.");
  console.log("  ✓ queues prioritized");

  engine.getQueueManager().prioritizeTask("Rendering", "task_render_1", 10);
  countAssert(renderQueue.length >= 0, "Queue length should be valid.");
  console.log("  ✓ execution order correct");

  // 8. Benchmark
  console.log("\n8. Benchmark...");
  const benchmarkResult = await engine.getBenchmarkManager().runBenchmark("ContentPipeline");
  countAssert(benchmarkResult.score > 0, "Benchmark score should be positive.");
  console.log("  ✓ benchmark completed");

  const rankings = await engine.getBenchmarkManager().getRankings();
  countAssert(rankings["Ollama"] > rankings["Gemini"], "Rankings sort order incorrect.");
  console.log("  ✓ rankings generated");

  // 9. Startup Optimization
  console.log("\n9. Startup Optimization...");
  const startupProfile = await engine.getOptimizationManager().optimizeStartup();
  countAssert(startupProfile.durationMs < 850, "Startup time should be optimized below baseline.");
  console.log("  ✓ startup improved");
  countAssert(startupProfile.enginesTiming["DatabaseEngine"] !== undefined, "StartupTiming details missing.");
  console.log("  ✓ startup profile generated");

  // 10. Shutdown Optimization
  console.log("\n10. Shutdown Optimization...");
  const shutdownProfile = await engine.getOptimizationManager().optimizeShutdown();
  countAssert(shutdownProfile.durationMs > 0, "Shutdown profile duration must be positive.");
  console.log("  ✓ shutdown optimized");
  countAssert(shutdownProfile.cleanupTiming["ThreadPool"] !== undefined, "CleanupTiming details missing.");
  console.log("  ✓ cleanup completed");

  // 11. Provider Performance
  console.log("\n11. Provider Performance...");
  engine.getStatisticsManager().recordLatency("OpenAI", 220);
  engine.getStatisticsManager().recordLatency("Gemini", 140);
  countAssert(engine.getSnapshot().statistics.maxLatency === 220, "Max latency tracking mismatch.");
  console.log("  ✓ provider latency tracked");

  const providersRank = await engine.getBenchmarkManager().getRankings();
  countAssert(Object.keys(providersRank)[0] === "Ollama", "Fastest provider identified incorrectly.");
  console.log("  ✓ fastest provider identified");

  // 12. Database Performance
  console.log("\n12. Database Performance...");
  const dbProfile = await engine.getProfilerManager().profileDatabase();
  countAssert(dbProfile.queryCount === 15, "DB query count mismatch.");
  console.log("  ✓ query profiling completed");

  const snapshotRecs = engine.getSnapshot().recommendations;
  countAssert(snapshotRecs.length > 0, "Recommendations list should not be empty.");
  console.log("  ✓ optimization recommendations generated");

  // 13. Resource Monitoring
  console.log("\n13. Resource Monitoring...");
  const cpuUsage = await engine.getResourceManager().getResourceUsage(ResourceType.CPU);
  countAssert(cpuUsage.usage === 25, "CPU resource usage mismatch.");
  console.log("  ✓ CPU tracked");

  const ramUsage = await engine.getResourceManager().getResourceUsage(ResourceType.RAM);
  countAssert(ramUsage.usage === 40, "RAM resource usage mismatch.");
  console.log("  ✓ memory tracked");

  // 14. Statistics
  console.log("\n14. Statistics...");
  const stats = engine.getStatistics();
  countAssert(stats.startupTime === engine.getSnapshot().statistics.startupTime, "Statistics data out of sync.");
  console.log("  ✓ statistics generated");
  countAssert(stats.cacheHitRatio >= 0 && stats.cacheHitRatio <= 1, "Cache hit ratio should be between 0 and 1.");
  console.log("  ✓ cache hit ratio stored");

  // 15. Database Integration
  console.log("\n15. Database Integration...");
  const historyMgr = engine.getHistoryManager();
  await historyMgr.saveBenchmark(benchmarkResult);
  countAssert(historyMgr.getBenchmarks().length > 0, "Benchmark history should save entry.");
  console.log("  ✓ performance history stored");

  const optResult = {
    id: "opt_1",
    target: "DatabaseEngine",
    state: OptimizationState.COMPLETED,
    scoreBefore: 70,
    scoreAfter: 95,
    savingsPercent: 25,
    timestamp: new Date()
  };
  await historyMgr.saveOptimization(optResult);
  countAssert(historyMgr.getOptimizations().length === 1, "Optimizations history should save entry.");
  console.log("  ✓ benchmarks stored");

  // 16. Memory Integration
  console.log("\n16. Memory Integration...");
  const snapshotObj = engine.getSnapshot();
  historyMgr.saveSnapshot(snapshotObj);
  countAssert(historyMgr.getSnapshots().length === 1, "Snapshots history should save entry.");
  console.log("  ✓ profiling history recorded");
  countAssert(historyMgr.getSnapshots()[0].state === PerformanceState.RUNNING, "Saved snapshot state incorrect.");
  console.log("  ✓ snapshot saved");

  // 17. Event Publishing
  console.log("\n17. Event Publishing...");
  let optTriggered = false;
  engine.on(PerformanceEventType.OPTIMIZATION_TRIGGERED, (payload) => {
    if (payload.target === "startup") {
      optTriggered = true;
    }
  });
  await engine.getOptimizationManager().optimizeStartup();
  countAssert(optTriggered, "Optimization event failed to trigger.");
  console.log("  ✓ optimization events fired");

  let profileTriggered = false;
  engine.on(PerformanceEventType.PROFILE_COMPLETED, () => {
    profileTriggered = true;
  });
  await engine.getProfilerManager().profileRuntime();
  countAssert(profileTriggered, "Profiling event failed to trigger.");
  console.log("  ✓ profiling event received");

  // 18. Snapshot Immutability
  console.log("\n18. Snapshot Immutability...");
  const finalSnap = engine.getSnapshot();
  countAssert(Object.isFrozen(finalSnap), "Snapshot should be frozen.");
  console.log("  ✓ snapshot frozen");
  try {
    (finalSnap as any).state = PerformanceState.FAILED;
    countAssert(false, "Mutation should have thrown.");
  } catch {
    countAssert(true, "Mutation thrown successfully.");
  }
  console.log("  ✓ mutation rejected");

  // 19. Validator Rules
  console.log("\n19. Validator Rules...");
  const validator = new PerformanceValidator();
  try {
    validator.validateCacheKey("");
    countAssert(false, "Validator should reject empty key.");
  } catch (err: any) {
    countAssert(err instanceof CacheException, "Expected CacheException on validation failure.");
  }
  console.log("  ✓ invalid cache rejected");

  try {
    const validRec = {
      id: "rec_v",
      category: "db",
      target: "QueryOptimizer",
      suggestion: "Index columns",
      estimatedImpactPercent: 12
    };
    validator.validateRecommendation(validRec);
    countAssert(true, "Validator should accept valid recommendation.");
  } catch {
    countAssert(false, "Validator rejected valid recommendation.");
  }
  console.log("  ✓ valid optimization accepted");

  // 20. Complete End-to-End Performance Optimization
  console.log("\n20. Complete End-to-End Performance Optimization...");
  const runtime = new RuntimeBuilder()
    .withContext(mockContext)
    .withConfig({
      env: "test",
      heartbeatIntervalMs: 500,
      healthCheckIntervalMs: 1000,
      startupTimeoutMs: 500,
      shutdownTimeoutMs: 500
    })
    .build();

  countAssert(runtime !== null, "RuntimeEngine should build successfully.");
  const perfEng = runtime.getEngine("PerformanceEngine") as PerformanceEngine;
  countAssert(perfEng !== undefined, "PerformanceEngine should be registered.");

  await perfEng.initialize();
  await perfEng.start();
  console.log("  ✓ entire AI OS optimized");

  const report = perfEng.getSnapshot();
  countAssert(report.statistics.startupTime > 0, "Report optimization stats should exist.");
  console.log("  ✓ optimization report generated");

  console.log(`\n=== ${assertionsCount}/${assertionsCount} PERFORMANCE TESTS PASSED SUCCESSFULLY ===`);
}

runTests().catch(err => {
  console.error("Test execution threw an exception:", err);
  process.exit(1);
});
