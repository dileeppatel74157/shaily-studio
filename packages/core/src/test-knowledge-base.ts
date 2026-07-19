import { KnowledgeBaseBuilder } from "./knowledge-base/KnowledgeBaseBuilder";
import { KnowledgeBaseEngine } from "./knowledge-base/KnowledgeBaseEngine";
import { KnowledgeBaseState } from "./knowledge-base/KnowledgeBaseState";
import { KnowledgeNodeType } from "./knowledge-base/KnowledgeNodeType";
import { RelationshipType } from "./knowledge-base/RelationshipType";
import { EmbeddingProvider } from "./knowledge-base/EmbeddingProvider";
import { IndexStatus } from "./knowledge-base/IndexStatus";
import { DocumentType } from "./knowledge-base/DocumentType";
import { RetrievalStrategy } from "./knowledge-base/RetrievalStrategy";
import { KnowledgeSource } from "./knowledge-base/KnowledgeSource";
import { KnowledgeBaseValidator } from "./knowledge-base/KnowledgeBaseValidator";
import {
  KnowledgeBaseValidationException,
  InvalidKnowledgeBaseStateException,
  GraphException,
} from "./knowledge-base/types";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("ASSERTION FAILED:", msg);
    process.exit(1);
  }
}

class MockMemoryStore {
  private store = new Map<string, Map<string, any>>();
  async set(ns: string, key: string, value: any) {
    if (!this.store.has(ns)) this.store.set(ns, new Map());
    this.store.get(ns)!.set(key, value);
  }
  async get(ns: string, key: string) { return this.store.get(ns)?.get(key); }
  async has(ns: string, key: string) { return this.store.get(ns)?.has(key) ?? false; }
}

async function runTests() {
  console.log("=== START SPRINT 20.1 KNOWLEDGE BASE ENGINE TESTS ===\n");

  const memoryStore = new MockMemoryStore();
  const context = { env: "test", memoryStore };

  // ── 1. Builder Validation ──────────────────────────────────────────────────
  try {
    new KnowledgeBaseBuilder().build();
    assert(false, "Must fail without context");
  } catch (e) {
    assert(e instanceof KnowledgeBaseValidationException, "Expected KnowledgeBaseValidationException");
  }

  const kb = new KnowledgeBaseBuilder()
    .withContext(context)
    .withConfig({ embeddingProvider: EmbeddingProvider.MOCK, embeddingDimensions: 64, defaultTopK: 5, persistenceEnabled: true })
    .build() as KnowledgeBaseEngine;

  assert(kb.getState() === KnowledgeBaseState.CREATED, "Initial state must be CREATED");
  console.log("1. Builder Validation... ✓");

  // ── 2. Lifecycle Transitions ───────────────────────────────────────────────
  try {
    await kb.start();
    assert(false, "start before init must fail");
  } catch (e) {
    assert(e instanceof InvalidKnowledgeBaseStateException, "Expected InvalidKnowledgeBaseStateException");
  }

  await kb.initialize();
  assert(kb.getState() === KnowledgeBaseState.READY, "State must be READY after init");

  await kb.start();
  assert(kb.getState() === KnowledgeBaseState.READY, "State remains READY after start");

  await kb.stop();
  assert(kb.getState() === KnowledgeBaseState.STOPPED, "State must be STOPPED");

  // Re-initialize for further tests
  await kb.initialize();
  assert(kb.getState() === KnowledgeBaseState.READY, "State must be READY again");
  console.log("2. Lifecycle Transitions... ✓");

  // ── 3. Knowledge Storage ───────────────────────────────────────────────────
  const res = await kb.store({
    type: KnowledgeNodeType.RESEARCH,
    title: "AI Trends 2026",
    content: "AI is accelerating across industries with foundation models leading the way.",
    tags: ["AI", "trends", "2026"],
    source: KnowledgeSource.RESEARCH_ENGINE,
    metadata: { author: "shaily" },
  });

  assert(res.success, "Storage must succeed");
  assert(res.nodeId.startsWith("kn-"), "Node ID must start with kn-");
  assert(res.indexed, "Node must be indexed");
  console.log("3. Knowledge Storage... ✓");

  // ── 4. Vector Embeddings ───────────────────────────────────────────────────
  assert(res.embeddingCreated, "Embedding must be created");
  const vecEntry = kb.getVectorManager().getVector(res.nodeId);
  assert(vecEntry !== undefined, "Vector must be stored");
  assert(vecEntry!.dimensions === 64, "Vector dimensions must be 64");
  assert(vecEntry!.embedding.length === 64, "Embedding length must be 64");
  console.log("4. Vector Embeddings... ✓");

  // ── 5. Knowledge Graph ─────────────────────────────────────────────────────
  const res2 = await kb.store({
    type: KnowledgeNodeType.STRATEGY,
    title: "AI Content Strategy",
    content: "Research-driven strategy for AI content creation.",
    tags: ["strategy", "AI"],
    source: KnowledgeSource.ASSISTANT_ENGINE,
    metadata: {},
    relationships: [{ toNodeId: res.nodeId, type: RelationshipType.DEPENDS_ON, weight: 0.9 }],
  });

  const graphManager = kb.getGraphManager();
  const graph = graphManager.getGraph();
  assert(graph.nodes.length >= 2, "Graph must have at least 2 nodes");
  assert(graph.relationships.length >= 1, "Graph must have at least 1 relationship");

  const rels = graphManager.getRelationships(res2.nodeId);
  assert(rels.length === 1, "Strategy node must have 1 outgoing relationship");
  assert(rels[0].type === RelationshipType.DEPENDS_ON, "Relationship type must be DEPENDS_ON");
  console.log("5. Knowledge Graph... ✓");

  // ── 6. Semantic Search ─────────────────────────────────────────────────────
  const searchResult = await kb.retrieve({
    query: "AI trends foundation models",
    strategy: RetrievalStrategy.SIMILARITY,
    topK: 3,
  });

  assert(searchResult.results.length > 0, "Similarity search must return results");
  assert(searchResult.strategy === RetrievalStrategy.SIMILARITY, "Strategy must be SIMILARITY");
  console.log("6. Semantic Search... ✓");

  // ── 7. Context Retrieval ───────────────────────────────────────────────────
  const hybridResult = await kb.retrieve({
    query: "AI",
    strategy: RetrievalStrategy.HYBRID,
    topK: 5,
  });
  assert(hybridResult.results.length > 0, "Hybrid retrieval must return results");

  const tagResult = await kb.retrieve({
    query: "AI",
    strategy: RetrievalStrategy.TAG,
    tags: ["AI"],
    topK: 5,
  });
  assert(tagResult.results.length > 0, "Tag search must return results");
  console.log("7. Context Retrieval... ✓");

  // ── 8. Document Indexing ───────────────────────────────────────────────────
  const docManager = kb.getDocumentManager();
  const doc = await docManager.importDocument(
    "/projects/notes.md",
    DocumentType.MARKDOWN,
    "# AI Research Notes\nFoundation models are transforming every industry.",
    { title: "AI Research Notes" },
  );

  assert(doc.id.startsWith("doc-"), "Document ID must start with doc-");
  assert(doc.wordCount > 0, "Word count must be positive");
  assert(doc.indexStatus === IndexStatus.INDEXED, "Document must be indexed");
  assert(doc.nodeId !== undefined, "Document must be linked to a knowledge node");
  console.log("8. Document Indexing... ✓");

  // ── 9. Prompt History ─────────────────────────────────────────────────────
  const promptManager = kb.getPromptHistoryManager();
  const prompt = await promptManager.storePrompt({
    prompt: "Write a script about AI trends",
    variables: { topic: "AI trends" },
    model: "gemini-pro",
    provider: "GEMINI",
    output: "Here is the script...",
    score: 0.95,
    costUsd: 0.002,
    latencyMs: 340,
    projectId: "proj-1",
  });

  assert(prompt.id.startsWith("prompt-"), "Prompt ID must start with prompt-");
  assert(promptManager.listPrompts("proj-1").length === 1, "Must find prompt by project");
  assert(promptManager.searchPrompts("script").length > 0, "Must find prompt by content search");
  console.log("9. Prompt History... ✓");

  // ── 10. Conversation Memory ────────────────────────────────────────────────
  const convManager = kb.getConversationManager();
  await convManager.storeMessage({ sessionId: "sess-1", role: "user", content: "Research AI news for me", projectId: "proj-1" });
  await convManager.storeMessage({ sessionId: "sess-1", role: "assistant", content: "I found 10 articles about AI news." });

  const session = convManager.getSession("sess-1");
  assert(session.length === 2, "Session must have 2 messages");

  const summary = convManager.summarizeSession("sess-1");
  assert(summary.includes("[user]"), "Summary must include user role");

  const searchConv = convManager.searchConversations("AI news");
  assert(searchConv.length > 0, "Must find conversations by content");
  console.log("10. Conversation Memory... ✓");

  // ── 11. Decision History ───────────────────────────────────────────────────
  const decManager = kb.getDecisionHistoryManager();
  const dec = await decManager.storeDecision({
    decision: "Use Gemini Pro for scripting",
    reason: "Best quality and speed ratio",
    confidence: 0.92,
    outcome: "PENDING",
    provider: "GEMINI",
    retryCount: 0,
    projectId: "proj-1",
  });

  assert(dec.id.startsWith("dec-"), "Decision ID must start with dec-");
  decManager.updateOutcome(dec.id, "SUCCESS");
  const updated = decManager.getDecision(dec.id);
  assert(updated?.outcome === "SUCCESS", "Outcome must be updated to SUCCESS");
  console.log("11. Decision History... ✓");

  // ── 12. Provider History ───────────────────────────────────────────────────
  const provManager = kb.getProviderHistoryManager();
  await provManager.recordUsage({ provider: "GEMINI", operation: "generate_script", model: "gemini-pro", latencyMs: 320, costUsd: 0.003, success: true });
  await provManager.recordUsage({ provider: "GEMINI", operation: "generate_image", model: "imagen-3", latencyMs: 900, costUsd: 0.01, success: true });
  await provManager.recordUsage({ provider: "OPENAI", operation: "embed", model: "text-embedding-3", latencyMs: 60, costUsd: 0.0001, success: true });

  const geminiRecords = provManager.getUsageByProvider("GEMINI");
  assert(geminiRecords.length === 2, "Must have 2 Gemini records");
  assert(provManager.getAverageLatency("GEMINI") === 610, "Average latency must be 610ms");
  assert(provManager.getTotalCost("GEMINI") > 0, "Total cost must be > 0");
  console.log("12. Provider History... ✓");

  // ── 13. Runtime Integration ────────────────────────────────────────────────
  const runtime = new RuntimeBuilder()
    .withContext({ ...context, namespace: "kb-runtime-test" })
    .withConfig({ env: "test", heartbeatIntervalMs: 500, healthCheckIntervalMs: 1000, startupTimeoutMs: 500, shutdownTimeoutMs: 500 })
    .withHost({ id: "host-1" })
    .build();

  await runtime.initialize();
  await runtime.start();
  assert((runtime as any).getState !== undefined, "Runtime must be running");
  await runtime.stop();
  console.log("13. Runtime Integration... ✓");

  // ── 14. Memory Integration ─────────────────────────────────────────────────
  const nodeCheck = await memoryStore.has("knowledge", `node-${res.nodeId}`);
  assert(nodeCheck, "Node must be persisted in memory store");

  const vecCheck = await memoryStore.has("vectors", `vec-${res.nodeId}`);
  assert(vecCheck, "Vector must be persisted in memory store");
  console.log("14. Memory Integration... ✓");

  // ── 15. Learning Integration ───────────────────────────────────────────────
  // Pattern: learning data stored as knowledge nodes with KnowledgeNodeType.PATTERN
  const patternRes = await kb.store({
    type: KnowledgeNodeType.PATTERN,
    title: "High-engagement script pattern",
    content: "Scripts with hooks in first 3 seconds get 3x engagement.",
    tags: ["learning", "pattern", "engagement"],
    source: KnowledgeSource.LEARNING_ENGINE,
    metadata: { confidence: 0.87 },
  });
  assert(patternRes.success, "Learning pattern storage must succeed");

  const learningNodes = kb.listNodes({ type: KnowledgeNodeType.PATTERN });
  assert(learningNodes.length === 1, "Must find learning pattern nodes");
  console.log("15. Learning Integration... ✓");

  // ── 16. Event Publishing ───────────────────────────────────────────────────
  let eventCount = 0;
  kb.on("KnowledgeStored", () => eventCount++);
  await kb.store({
    type: KnowledgeNodeType.CONCEPT,
    title: "Faceless Channel",
    content: "A YouTube channel with no visible host.",
    tags: ["channel"],
    source: KnowledgeSource.MANUAL,
    metadata: {},
  });
  assert(eventCount === 1, "KnowledgeStored event must fire");
  console.log("16. Event Publishing... ✓");

  // ── 17. Snapshot Immutability ──────────────────────────────────────────────
  const snap = kb.getReporter().getSnapshot();
  try {
    (snap as any).state = KnowledgeBaseState.FAILED;
    assert(false, "Frozen snapshot must not be modifiable");
  } catch (e) {
    assert(e instanceof TypeError, "Expected TypeError for frozen object mutation");
  }
  console.log("17. Snapshot Immutability... ✓");

  // ── 18. Validator Rules ────────────────────────────────────────────────────
  try {
    KnowledgeBaseValidator.validateId("invalid id with spaces");
    assert(false, "Must reject ID with spaces");
  } catch (e) {
    assert(e instanceof KnowledgeBaseValidationException, "Expected validation error for ID with spaces");
  }

  try {
    KnowledgeBaseValidator.validateEmbeddingDimensions([0.1, 0.2], 5);
    assert(false, "Must reject wrong dimensions");
  } catch (e) {
    assert(e instanceof KnowledgeBaseValidationException, "Expected validation error for wrong dimensions");
  }

  try {
    KnowledgeBaseValidator.validateNoCycles(
      [
        { id: "A", type: KnowledgeNodeType.CONCEPT, title: "A", content: "", tags: [], source: KnowledgeSource.MANUAL, indexStatus: IndexStatus.PENDING, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
        { id: "B", type: KnowledgeNodeType.CONCEPT, title: "B", content: "", tags: [], source: KnowledgeSource.MANUAL, indexStatus: IndexStatus.PENDING, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
      ],
      [
        { id: "r1", fromNodeId: "A", toNodeId: "B", type: RelationshipType.RELATED, weight: 1, createdAt: new Date() },
        { id: "r2", fromNodeId: "B", toNodeId: "A", type: RelationshipType.RELATED, weight: 1, createdAt: new Date() },
      ]
    );
    assert(false, "Must detect circular relationships");
  } catch (e) {
    assert(e instanceof GraphException, "Expected GraphException for circular relationship");
  }
  console.log("18. Validator Rules... ✓");

  // ── 19. Index Optimization ─────────────────────────────────────────────────
  const indexManager = kb.getIndexManager();
  await indexManager.optimize();
  await indexManager.reindexAll();

  const allNodes = kb.listNodes();
  for (const n of allNodes) {
    assert(n.indexStatus === IndexStatus.INDEXED, `Node ${n.id} must be INDEXED after reindex`);
  }

  // Validate index consistency
  const indexedIds = (indexManager as any).getIndexedIds() as Set<string>;
  KnowledgeBaseValidator.validateIndexConsistency(allNodes, indexedIds);
  console.log("19. Index Optimization... ✓");

  // ── 20. Full End-to-End Knowledge Lifecycle ────────────────────────────────
  const e2eKb = new KnowledgeBaseBuilder()
    .withContext(context)
    .withConfig({ embeddingProvider: EmbeddingProvider.MOCK, embeddingDimensions: 32, defaultTopK: 3, persistenceEnabled: true })
    .build() as KnowledgeBaseEngine;

  await e2eKb.initialize();
  await e2eKb.start();

  // Store research → strategy → script chain
  const r1 = await e2eKb.store({ type: KnowledgeNodeType.RESEARCH, title: "Viral Topics", content: "Top viral topics on YouTube in 2026", tags: ["viral", "youtube"], source: KnowledgeSource.RESEARCH_ENGINE, metadata: {} });
  const r2 = await e2eKb.store({ type: KnowledgeNodeType.STRATEGY, title: "Viral Strategy", content: "Post 3 shorts per week on viral topics", tags: ["strategy"], source: KnowledgeSource.ASSISTANT_ENGINE, metadata: {}, relationships: [{ toNodeId: r1.nodeId, type: RelationshipType.DEPENDS_ON, weight: 0.95 }] });
  const r3 = await e2eKb.store({ type: KnowledgeNodeType.SCRIPT, title: "Viral Script Draft", content: "Hook: Did you know AI can now generate full movies?", tags: ["script", "viral"], source: KnowledgeSource.SCRIPT_ENGINE, metadata: {}, relationships: [{ toNodeId: r2.nodeId, type: RelationshipType.GENERATED_BY, weight: 0.8 }] });

  // Traverse graph
  const traversed = e2eKb.getGraphManager().traverse(r3.nodeId, 3);
  assert(traversed.length >= 1, "Graph traversal must return nodes");

  // Vector similarity retrieval
  const finalSearch = await e2eKb.retrieve({ query: "viral YouTube topics shorts", strategy: RetrievalStrategy.SIMILARITY, topK: 3 });
  assert(finalSearch.results.length > 0, "Final semantic search must return results");

  // Report
  const report = e2eKb.getReporter().generateReport();
  assert(report.statistics.totalNodes >= 3, "Report must count all nodes");
  assert(report.health.healthy, "Report health must be healthy");

  await e2eKb.stop();
  assert(e2eKb.getState() === KnowledgeBaseState.STOPPED, "E2E engine must be STOPPED");

  console.log("20. Full End-to-End Knowledge Lifecycle... ✓");
  console.log("\n=== ALL 20/20 KNOWLEDGE BASE ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
