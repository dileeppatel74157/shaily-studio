import { MemoryOptimizationBuilder } from "./memory-optimization/MemoryOptimizationBuilder";
import { MemoryOptimizationEngine } from "./memory-optimization/MemoryOptimizationEngine";
import { MemoryOptimizationState } from "./memory-optimization/MemoryOptimizationState";
import { CompressionStrategy } from "./memory-optimization/CompressionStrategy";
import { DeduplicationStrategy } from "./memory-optimization/DeduplicationStrategy";
import { ArchiveState } from "./memory-optimization/ArchiveState";
import { RestoreState } from "./memory-optimization/RestoreState";
import { MemoryScore } from "./memory-optimization/MemoryScore";
import { ContextRank } from "./memory-optimization/ContextRank";
import { CleanupPolicy } from "./memory-optimization/CleanupPolicy";
import { MemoryOptimizationValidator } from "./memory-optimization/MemoryOptimizationValidator";
import {
  MemoryOptimizationValidationException,
  InvalidMemoryOptimizationStateException,
} from "./memory-optimization/types";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { KnowledgeBaseBuilder } from "./knowledge-base/KnowledgeBaseBuilder";
import { EmbeddingProvider } from "./knowledge-base/EmbeddingProvider";

function assert(cond: boolean, msg: string): void {
  if (!cond) { console.error("ASSERTION FAILED:", msg); process.exit(1); }
}

class MockMemoryStore {
  private readonly _store = new Map<string, Map<string, any>>();
  async set(ns: string, key: string, value: any) {
    if (!this._store.has(ns)) this._store.set(ns, new Map());
    this._store.get(ns)!.set(key, value);
  }
  async get(ns: string, key: string) { return this._store.get(ns)?.get(key); }
  async has(ns: string, key: string) { return this._store.get(ns)?.has(key) ?? false; }
}

async function runTests() {
  console.log("=== START SPRINT 20.2 MEMORY OPTIMIZATION ENGINE TESTS ===\n");

  const memoryStore = new MockMemoryStore();
  const context = { env: "test", memoryStore };

  // ── 1. Builder Validation ─────────────────────────────────────────────────
  try {
    new MemoryOptimizationBuilder().build();
    assert(false, "Must fail without context");
  } catch (e) {
    assert(e instanceof MemoryOptimizationValidationException, "Expected MemoryOptimizationValidationException");
  }

  const engine = new MemoryOptimizationBuilder()
    .withContext(context)
    .withConfig({
      compressionEnabled: true,
      defaultCompressionStrategy: CompressionStrategy.LOSSLESS,
      deduplicationEnabled: true,
      defaultDeduplicationStrategy: DeduplicationStrategy.HASH_FINGERPRINT,
      autoCleanupEnabled: false,
      cleanupIntervalMs: 60_000,
      defaultCleanupPolicies: [CleanupPolicy.EXPIRED_TTL],
      archivingEnabled: true,
      scoringEnabled: true,
      rankingTopK: 5,
      persistenceEnabled: true,
    })
    .build() as MemoryOptimizationEngine;

  assert(engine.getState() === MemoryOptimizationState.CREATED, "Initial state must be CREATED");
  console.log("1. Builder Validation... ✓");

  // ── 2. Lifecycle Transitions ──────────────────────────────────────────────
  try {
    await engine.start();
    assert(false, "Start before init must fail");
  } catch (e) {
    assert(e instanceof InvalidMemoryOptimizationStateException, "Expected InvalidMemoryOptimizationStateException");
  }

  await engine.initialize();
  assert(engine.getState() === MemoryOptimizationState.READY, "State must be READY after init");

  await engine.start();
  assert(engine.getState() === MemoryOptimizationState.READY, "State remains READY after start");

  await engine.stop();
  assert(engine.getState() === MemoryOptimizationState.STOPPED, "State must be STOPPED");

  await engine.initialize();
  assert(engine.getState() === MemoryOptimizationState.READY, "State must be READY after re-init");
  console.log("2. Lifecycle Transitions... ✓");

  // ── 3. Memory Compression ─────────────────────────────────────────────────
  const entry1 = await engine.ingestEntry({
    namespace: "research",
    key: "ai-trends-2026",
    content: "Artificial intelligence is transforming every industry. Foundation models are leading this revolution. Multimodal AI will dominate in 2026.",
    score: MemoryScore.HIGH,
    qualityScore: 0.85,
    tags: ["AI", "research", "2026"],
    metadata: {},
  });

  const compressionResults = await engine.runCompression({ entryId: entry1.id, strategy: CompressionStrategy.LOSSLESS });
  assert(compressionResults.length === 1, "Must return exactly 1 compression result");
  assert(compressionResults[0].success, "Compression must succeed");
  assert(compressionResults[0].compressedSizeBytes <= compressionResults[0].originalSizeBytes, "Compressed must be <= original");

  const retrieved = engine.getEntry(entry1.id);
  assert(retrieved.compressed === true, "Entry must be marked as compressed");
  console.log("3. Memory Compression... ✓");

  // ── 4. Deduplication ─────────────────────────────────────────────────────
  const dupContent = "This is a duplicate memory entry about AI trends.";
  const dup1 = await engine.ingestEntry({ namespace: "prompts", key: "dup-1", content: dupContent, score: MemoryScore.MEDIUM, qualityScore: 0.5, tags: [], metadata: {} });
  const dup2 = await engine.ingestEntry({ namespace: "prompts", key: "dup-2", content: dupContent, score: MemoryScore.MEDIUM, qualityScore: 0.5, tags: [], metadata: {} });

  const sizeBefore = engine.listEntries().length;
  const dedupResult = await engine.runDeduplication(DeduplicationStrategy.HASH_FINGERPRINT);
  const sizeAfter = engine.listEntries().length;

  assert(dedupResult.duplicateGroupsFound >= 1, "Must detect at least 1 duplicate group");
  assert(dedupResult.entriesRemoved >= 1, "Must remove at least 1 duplicate");
  assert(sizeAfter < sizeBefore, "Entry count must decrease after deduplication");
  console.log("4. Deduplication... ✓");

  // ── 5. Snapshot Cleanup ───────────────────────────────────────────────────
  // Ingest an expired entry
  const expiredEntry = await engine.ingestEntry({
    namespace: "cache",
    key: "temp-cache-1",
    content: "Temporary cache data",
    score: MemoryScore.EXPIRED,
    qualityScore: 0.1,
    tags: [],
    metadata: {},
    ttlMs: -1, // already expired
  });
  // Force expiry
  engine.getEntryMap().get(expiredEntry.id)!.expiresAt = new Date(Date.now() - 10000);

  const countBefore = engine.listEntries().length;
  const cleanupResult = await engine.runCleanup({ policies: [CleanupPolicy.EXPIRED_TTL], dryRun: false });
  const countAfter = engine.listEntries().length;
  assert(cleanupResult.entriesRemoved >= 1, "Must remove expired entry");
  assert(countAfter < countBefore, "Entry count must decrease after cleanup");
  console.log("5. Snapshot Cleanup... ✓");

  // ── 6. Archive Creation ───────────────────────────────────────────────────
  const archEntry1 = await engine.ingestEntry({ namespace: "research", key: "arch-target-1", content: "Old research data from 2024", score: MemoryScore.LOW, qualityScore: 0.3, tags: ["old"], metadata: {} });
  const archEntry2 = await engine.ingestEntry({ namespace: "research", key: "arch-target-2", content: "Old strategy notes from 2024", score: MemoryScore.LOW, qualityScore: 0.3, tags: ["old"], metadata: {} });

  const archiveResult = await engine.runArchive({
    label: "2024-research-archive",
    entryIds: [archEntry1.id, archEntry2.id],
    metadata: { year: 2024 },
  });

  assert(archiveResult.success, "Archive must succeed");
  assert(archiveResult.entriesArchived === 2, "Must archive 2 entries");
  assert(archiveResult.archiveId.startsWith("arch-"), "Archive ID must start with arch-");
  assert(!engine.getEntryMap().has(archEntry1.id), "Archived entries must be removed from live map");

  const archives = engine.getArchiveManager().listArchives();
  assert(archives.length >= 1, "Must have at least 1 archive");
  console.log("6. Archive Creation... ✓");

  // ── 7. Archive Restore ───────────────────────────────────────────────────
  const restoreResult = await engine.runRestore({ archiveId: archiveResult.archiveId, targetNamespace: "restored" });
  assert(restoreResult.success, "Restore must succeed");
  assert(restoreResult.state === RestoreState.COMPLETED, "Restore state must be COMPLETED");
  assert(restoreResult.entriesRestored === 2, "Must restore 2 entries");

  const restoredArchive = engine.getArchiveManager().getArchive(archiveResult.archiveId);
  assert(restoredArchive?.state === ArchiveState.RESTORED, "Archive state must be RESTORED");
  console.log("7. Archive Restore... ✓");

  // ── 8. Index Optimization ─────────────────────────────────────────────────
  const indexResult = await engine.runIndexOptimization();
  assert(indexResult.vectorIndexOptimized, "Vector index must be optimized");
  assert(indexResult.metadataIndexOptimized, "Metadata index must be optimized");
  assert(indexResult.cacheWarmed, "Cache must be warmed");
  assert(indexResult.retrievalLatencyReducedMs >= 0, "Latency reduction must be >= 0");
  console.log("8. Index Optimization... ✓");

  // ── 9. Memory Scoring ─────────────────────────────────────────────────────
  // Ingest a new entry with known metadata
  const scoredEntry = await engine.ingestEntry({
    namespace: "decisions",
    key: "decision-1",
    content: "Use Gemini Pro for all script generation tasks",
    score: MemoryScore.HIGH,
    qualityScore: 0.8,
    tags: ["decision", "learning"],
    metadata: { successRate: 0.95, founderPreference: 0.9 },
  });
  // Simulate accesses
  for (let i = 0; i < 5; i++) engine.getEntry(scoredEntry.id);

  const scoreCard = engine.scoreEntry(scoredEntry.id);
  assert(scoreCard.entryId === scoredEntry.id, "Score card must reference correct entry");
  assert(typeof scoreCard.compositeScore === "number", "Composite score must be a number");
  assert(scoreCard.compositeScore >= 0 && scoreCard.compositeScore <= 1, "Score must be between 0 and 1");
  assert(scoreCard.accessFrequency > 0, "Access frequency must be > 0 after accesses");
  assert(scoreCard.learningValue > 0.5, "Learning value must be high for entries tagged learning");
  console.log("9. Memory Scoring... ✓");

  // ── 10. Context Ranking ───────────────────────────────────────────────────
  const entries = engine.listEntries();
  const rankingResponse = engine.rankContext({
    query: "AI decision Gemini script generation",
    entries,
    topK: 3,
  });

  assert(rankingResponse.ranked.length <= 3, "Must return at most topK results");
  assert(rankingResponse.totalConsidered === entries.length, "Must consider all entries");
  // Verify descending order
  const scores = rankingResponse.ranked.map(r => r.rankScore);
  MemoryOptimizationValidator.validateRankingOrder(scores);
  console.log("10. Context Ranking... ✓");

  // ── 11. Fast Retrieval ────────────────────────────────────────────────────
  const optimizer = engine.getRetrievalOptimizer();
  const latencyBefore = optimizer.getRetrievalLatency();
  await engine.runIndexOptimization();
  const latencyAfter = optimizer.getRetrievalLatency();
  assert(latencyAfter <= latencyBefore, "Latency must not increase after optimization");
  console.log("11. Fast Retrieval... ✓");

  // ── 12. Runtime Integration ───────────────────────────────────────────────
  const runtime = new RuntimeBuilder()
    .withContext({ ...context, namespace: "mo-runtime-test" })
    .withConfig({ env: "test", heartbeatIntervalMs: 500, healthCheckIntervalMs: 1000, startupTimeoutMs: 500, shutdownTimeoutMs: 500 })
    .withHost({ id: "host-mo" })
    .build();

  await runtime.initialize();
  await runtime.start();
  await runtime.stop();
  assert(true, "Runtime integration passed");
  console.log("12. Runtime Integration... ✓");

  // ── 13. Knowledge Base Integration ───────────────────────────────────────
  const kb = new KnowledgeBaseBuilder()
    .withContext(context)
    .withConfig({ embeddingProvider: EmbeddingProvider.MOCK, embeddingDimensions: 32, defaultTopK: 5, persistenceEnabled: false })
    .build();

  await kb.initialize();
  const kbRes = await kb.store({ type: "RESEARCH" as any, title: "AI Memory Optimization", content: "Memory optimization improves retrieval speed and quality.", tags: ["AI", "memory"], source: "RESEARCH_ENGINE" as any, metadata: {} });
  assert(kbRes.success, "KB storage must succeed");

  // Ingest KB content into memory optimizer
  const kbEntry = await engine.ingestEntry({
    namespace: "knowledge-base",
    key: kbRes.nodeId,
    content: "AI Memory Optimization: improves retrieval speed and quality.",
    score: MemoryScore.HIGH,
    qualityScore: 0.9,
    tags: ["AI", "memory", "knowledge"],
    metadata: { nodeId: kbRes.nodeId },
  });
  assert(kbEntry.namespace === "knowledge-base", "Must store in knowledge-base namespace");
  console.log("13. Knowledge Base Integration... ✓");

  // ── 14. Learning Integration ──────────────────────────────────────────────
  const learningEntry = await engine.ingestEntry({
    namespace: "learning",
    key: "pattern-high-engagement",
    content: "Hooks in the first 3 seconds of a video increase engagement by 3x.",
    score: MemoryScore.HIGH,
    qualityScore: 0.88,
    tags: ["learning", "pattern", "engagement"],
    metadata: { successRate: 0.92, founderPreference: 0.85 },
  });
  const lScore = engine.scoreEntry(learningEntry.id);
  assert(lScore.learningValue > 0.5, "Learning entry must have high learning value");
  assert(Object.values(MemoryScore).includes(lScore.score), "Score tier must be valid MemoryScore");
  console.log("14. Learning Integration... ✓");

  // ── 15. Memory Integration ────────────────────────────────────────────────
  const persisted = await memoryStore.has("memory-optimization", `entry-${entry1.id}`);
  assert(persisted, "Entry must be persisted in memory store");
  console.log("15. Memory Integration... ✓");

  // ── 16. Event Publishing ──────────────────────────────────────────────────
  let events: string[] = [];
  engine.on("CompressionCompleted", () => events.push("CompressionCompleted"));
  engine.on("MemoryMerged", () => events.push("MemoryMerged"));
  engine.on("CleanupCompleted", () => events.push("CleanupCompleted"));
  engine.on("ArchiveCreated", () => events.push("ArchiveCreated"));
  engine.on("ArchiveRestored", () => events.push("ArchiveRestored"));
  engine.on("MemoryScored", () => events.push("MemoryScored"));
  engine.on("ContextRanked", () => events.push("ContextRanked"));

  await engine.runCompression();
  await engine.runDeduplication();
  await engine.runCleanup({ policies: [CleanupPolicy.DUPLICATE_ONLY], dryRun: true });
  engine.scoreEntry(scoredEntry.id);
  engine.rankContext({ query: "test", entries: engine.listEntries(), topK: 3 });

  assert(events.includes("CompressionCompleted"), "CompressionCompleted event must fire");
  assert(events.includes("CleanupCompleted"), "CleanupCompleted event must fire");
  assert(events.includes("MemoryScored"), "MemoryScored event must fire");
  assert(events.includes("ContextRanked"), "ContextRanked event must fire");
  console.log("16. Event Publishing... ✓");

  // ── 17. Snapshot Immutability ─────────────────────────────────────────────
  const snap = engine.getReporter().getSnapshot();
  try {
    (snap as any).state = MemoryOptimizationState.FAILED;
    assert(false, "Frozen snapshot must not be mutable");
  } catch (e) {
    assert(e instanceof TypeError, "Expected TypeError for frozen object mutation");
  }
  console.log("17. Snapshot Immutability... ✓");

  // ── 18. Validator Rules ───────────────────────────────────────────────────
  // Bad ID
  try {
    MemoryOptimizationValidator.validateId("bad id with spaces");
    assert(false, "Must reject ID with spaces");
  } catch (e) {
    assert(e instanceof MemoryOptimizationValidationException, "Expected validation error");
  }

  // Bad score range
  try {
    MemoryOptimizationValidator.validateScoreRange(1.5, "testScore");
    assert(false, "Must reject score > 1");
  } catch (e) {
    assert(e instanceof MemoryOptimizationValidationException, "Expected validation error for out-of-range score");
  }

  // Empty cleanup policy
  try {
    MemoryOptimizationValidator.validateCleanupRequest({ policies: [] });
    assert(false, "Must reject empty policies");
  } catch (e) {
    assert(e instanceof MemoryOptimizationValidationException, "Expected validation error for empty policies");
  }

  // Bad ranking order
  try {
    MemoryOptimizationValidator.validateRankingOrder([0.9, 0.8, 0.95]);
    assert(false, "Must detect non-descending ranking");
  } catch (e) {
    assert(e instanceof MemoryOptimizationValidationException, "Expected validation error for wrong ranking order");
  }

  // Restore integrity
  try {
    MemoryOptimizationValidator.validateRestoreIntegrity(["a", "b", "c"], new Set(["a", "b"]));
    assert(false, "Must detect missing restored entry");
  } catch (e) {
    assert(e instanceof MemoryOptimizationValidationException, "Expected validation error for missing restore entry");
  }
  console.log("18. Validator Rules... ✓");

  // ── 19. Maintenance Scheduler ─────────────────────────────────────────────
  const scheduler = engine.getMaintenanceScheduler();
  assert(!scheduler.isScheduled(), "No schedule by default (autoCleanup off in this test)");

  scheduler.scheduleNext(100_000); // far future
  assert(scheduler.isScheduled(), "Must be scheduled");
  assert(scheduler.getNextRunAt() !== undefined, "Next run time must be set");

  scheduler.cancelScheduled();
  assert(!scheduler.isScheduled(), "Must be unscheduled after cancel");
  console.log("19. Maintenance Scheduler... ✓");

  // ── 20. Full End-to-End Memory Optimization ───────────────────────────────
  const e2e = new MemoryOptimizationBuilder()
    .withContext(context)
    .withConfig({
      compressionEnabled: true,
      defaultCompressionStrategy: CompressionStrategy.SEMANTIC,
      deduplicationEnabled: true,
      defaultDeduplicationStrategy: DeduplicationStrategy.SEMANTIC_SIMILARITY,
      autoCleanupEnabled: false,
      cleanupIntervalMs: 60_000,
      defaultCleanupPolicies: [CleanupPolicy.EXPIRED_TTL, CleanupPolicy.LOW_SCORE],
      archivingEnabled: true,
      scoringEnabled: true,
      rankingTopK: 5,
      persistenceEnabled: true,
    })
    .build() as MemoryOptimizationEngine;

  await e2e.initialize();
  await e2e.start();

  // Ingest variety of entries
  const entries2 = await Promise.all([
    e2e.ingestEntry({ namespace: "research", key: "r1", content: "AI trends report for 2026 covering LLMs", score: MemoryScore.HIGH, qualityScore: 0.9, tags: ["research", "AI"], metadata: { successRate: 0.9, founderPreference: 0.8 } }),
    e2e.ingestEntry({ namespace: "research", key: "r2", content: "AI trends report for 2026 covering LLMs", score: MemoryScore.MEDIUM, qualityScore: 0.5, tags: [], metadata: {} }), // exact dupe
    e2e.ingestEntry({ namespace: "scripts", key: "s1", content: "Hook: Did you know LLMs can now code entire apps?", score: MemoryScore.HIGH, qualityScore: 0.85, tags: ["script", "learning"], metadata: { successRate: 0.88 } }),
    e2e.ingestEntry({ namespace: "decisions", key: "d1", content: "Decision: use Gemini for all generation tasks", score: MemoryScore.CRITICAL, qualityScore: 0.95, tags: ["decision", "learning"], metadata: { successRate: 0.95, founderPreference: 0.95 } }),
  ]);

  // Run full optimization flow
  const dedupE2e = await e2e.runDeduplication(DeduplicationStrategy.HASH_FINGERPRINT);
  assert(dedupE2e.duplicateGroupsFound >= 1, "E2E: must detect duplicates");

  const compE2e = await e2e.runCompression();
  assert(compE2e.length >= 1, "E2E: must compress entries");

  // Score and rank
  const liveEntries = e2e.listEntries();
  const ranked = e2e.rankContext({ query: "AI LLM Gemini decision learning", entries: liveEntries, topK: 3 });
  assert(ranked.ranked.length <= 3, "E2E: must return topK ranked results");
  assert(ranked.ranked[0].rankScore >= ranked.ranked[ranked.ranked.length - 1].rankScore, "E2E: ranking must be descending");

  // Archive old entries
  const lowEntries = liveEntries.filter(e => e.score === MemoryScore.LOW || e.score === MemoryScore.STALE);
  if (lowEntries.length > 0) {
    const archE2e = await e2e.runArchive({ label: "stale-archive", entryIds: lowEntries.map(e => e.id) });
    assert(archE2e.success, "E2E: archive must succeed");
  }

  // Run maintenance
  const maintenanceReport = await e2e.runMaintenance();
  assert(maintenanceReport.totalDurationMs >= 0, "E2E: maintenance report must have duration");
  assert(maintenanceReport.entriesScored >= 0, "E2E: must score entries during maintenance");

  const report = e2e.getReporter().generateReport();
  assert(report.health.healthy, "E2E: engine must be healthy");
  assert(report.statistics.maintenanceRuns >= 1, "E2E: must track maintenance run count");

  await e2e.stop();
  assert(e2e.getState() === MemoryOptimizationState.STOPPED, "E2E engine must be STOPPED");

  console.log("20. Full End-to-End Memory Optimization... ✓");
  console.log("\n=== ALL 20/20 MEMORY OPTIMIZATION ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
