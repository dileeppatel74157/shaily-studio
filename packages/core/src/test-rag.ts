import {
  KnowledgeBuilder,
  PromptBuilder,
  PromptRegistry,
  RAGBuilder,
  RetrievalStrategy,
  RAGValidationException,
  KnowledgeDocument,
} from "./index";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START RAG FRAMEWORK TESTS ===");

  // 1. Setup seeded Knowledge Base and Prompt Registry
  const doc1: KnowledgeDocument = {
    id: "doc-1",
    title: "TypeScript Guide",
    collection: "programming",
    metadata: { difficulty: "intermediate" },
    chunks: [
      { id: "chunk-1-1", documentId: "doc-1", text: "TypeScript is a strongly typed language.", index: 0 },
      { id: "chunk-1-2", documentId: "doc-1", text: "Interfaces define code structures.", index: 1 },
    ],
  };

  const doc2: KnowledgeDocument = {
    id: "doc-2",
    title: "React Guide",
    collection: "web-dev",
    metadata: { difficulty: "beginner" },
    chunks: [
      { id: "chunk-2-1", documentId: "doc-2", text: "React is a UI component framework.", index: 0 },
      { id: "chunk-2-2", documentId: "doc-2", text: "Components manage state and props.", index: 1 },
    ],
  };

  const kb = new KnowledgeBuilder()
    .withId("kb-1")
    .withName("Test Knowledge Base")
    .withDocument(doc1)
    .withDocument(doc2)
    .build();

  const prompt = new PromptBuilder()
    .withId("prompt-1")
    .withName("RAG Prompt")
    .withVersion("1.0.0")
    .withDescription("Answers user with retrieved context")
    .withTemplate("Given context: {{context}}, answer: {{userQuery}}")
    .withVariable("context", "Retrieved documents context", true)
    .withVariable("userQuery", "User question query", true)
    .build();

  const promptRegistry = new PromptRegistry();
  promptRegistry.register(prompt);

  // 2. RAG Builder
  console.log("\n1. Verifying RAG Builder...");
  const ragEngine = new RAGBuilder()
    .withKnowledgeBase(kb)
    .withPromptRegistry(promptRegistry)
    .withContextWindow({ maxChunks: 2, maxCharacters: 100 })
    .withStrategy(RetrievalStrategy.KEYWORD)
    .withMetadata({ env: "test" })
    .build();

  assert(ragEngine.context.knowledgeBase === kb, "Knowledge Base is configured");
  assert(ragEngine.context.promptRegistry === promptRegistry, "Prompt Registry is configured");
  assert(ragEngine.context.contextWindow.maxChunks === 2, "maxChunks is configured");
  assert(ragEngine.context.contextWindow.maxCharacters === 100, "maxCharacters is configured");
  assert(ragEngine.context.metadata.env === "test", "Metadata is configured");
  console.log("   ✓ RAG Builder verified successfully.");

  // 3. Retrieval Strategy KEYWORD
  console.log("\n2. Verifying KEYWORD Strategy...");
  const resKeyword = await ragEngine.retrieve({
    query: "TypeScript typed",
    strategy: RetrievalStrategy.KEYWORD,
  });

  assert(resKeyword.strategyUsed === RetrievalStrategy.KEYWORD, "Strategy used matches");
  assert(resKeyword.documents.length === 1, "Retrieved 1 matching document chunk");
  assert(resKeyword.documents[0].chunkId === "chunk-1-1", "Retrieved correct chunk");
  assert(resKeyword.context === "TypeScript is a strongly typed language.", "Context matches");
  console.log("   ✓ KEYWORD retrieval strategy verified.");

  // 4. Retrieval Strategy EXACT_MATCH
  console.log("\n3. Verifying EXACT_MATCH Strategy...");
  const resExact = await ragEngine.retrieve({
    query: "strongly typed",
    strategy: RetrievalStrategy.EXACT_MATCH,
  });
  assert(resExact.documents.length === 1, "Retrieved exact matching chunk");
  assert(resExact.documents[0].chunkId === "chunk-1-1", "Retrieved chunk matches");

  const resExactFail = await ragEngine.retrieve({
    query: "strongly language", // separated terms
    strategy: RetrievalStrategy.EXACT_MATCH,
  });
  assert(resExactFail.documents.length === 0, "No chunks match un-contiguous exact query");
  console.log("   ✓ EXACT_MATCH retrieval strategy verified.");

  // 5. Retrieval Strategy HYBRID
  console.log("\n4. Verifying HYBRID Strategy...");
  // Hybrid matches both and merges scores
  const resHybrid = await ragEngine.retrieve({
    query: "strongly typed",
    strategy: RetrievalStrategy.HYBRID,
  });
  // chunk-1-1 is both exact match and keyword term match, scoring highest.
  assert(resHybrid.documents.length > 0, "Hybrid search returns matches");
  assert(resHybrid.documents[0].chunkId === "chunk-1-1", "chunk-1-1 ranks first");
  console.log("   ✓ HYBRID retrieval strategy verified.");

  // 6. Context Window Limits (maxChunks & maxCharacters)
  console.log("\n5. Verifying Context Window Limits...");
  // Test maxChunks limit
  const resLimitChunks = await ragEngine.retrieve({
    query: "TypeScript Interfaces Component",
    strategy: RetrievalStrategy.KEYWORD,
    maxChunks: 1, // override context maxChunks = 2
  });
  assert(resLimitChunks.documents.length >= 2, "Returned matching document array is not truncated");
  // But context field should be truncated to only 1 chunk!
  // chunk-1-2 is "Interfaces define code structures."
  // chunk-2-1 is "React is a UI component framework."
  // Both match keywords. If maxChunks is 1, context contains only 1 chunk.
  assert(resLimitChunks.context.indexOf("\n\n") === -1, "Context text contains only 1 chunk");

  // Test maxCharacters limit
  const resLimitChars = await ragEngine.retrieve({
    query: "TypeScript strongly typed",
    strategy: RetrievalStrategy.KEYWORD,
    maxCharacters: 10,
  });
  assert(resLimitChars.context.length === 10, "Context string truncated to exactly 10 characters");
  console.log("   ✓ Context window chunk limits and character limits verified.");

  // 7. Prompt Rendering Integration
  console.log("\n6. Verifying Prompt Rendering Integration...");
  const resPrompt = await ragEngine.retrieve({
    query: "strongly typed",
    strategy: RetrievalStrategy.KEYWORD,
    promptId: "prompt-1",
    promptVariables: { userQuery: "Explain TypeScript" },
  });

  assert(resPrompt.promptText !== undefined, "Rendered prompt is included");
  assert(
    resPrompt.promptText ===
      "Given context: TypeScript is a strongly typed language., answer: Explain TypeScript",
    "Prompt variables and context replaced correctly"
  );
  console.log("   ✓ Prompt rendering and context injection verified.");

  // 8. RAG Validation
  console.log("\n7. Verifying RAG Validation Rules...");
  // Empty query
  try {
    await ragEngine.retrieve({ query: "", strategy: RetrievalStrategy.KEYWORD });
    assert(false, "Should reject empty query");
  } catch (err) {
    assert(err instanceof RAGValidationException, "Expected RAGValidationException");
  }

  // Negative maxChunks limit
  try {
    await ragEngine.retrieve({
      query: "test",
      strategy: RetrievalStrategy.KEYWORD,
      maxChunks: -5,
    });
    assert(false, "Should reject negative maxChunks");
  } catch (err) {
    assert(err instanceof RAGValidationException, "Expected RAGValidationException");
  }

  // Non-existent promptId
  try {
    await ragEngine.retrieve({
      query: "test",
      strategy: RetrievalStrategy.KEYWORD,
      promptId: "non-existent",
    });
    assert(false, "Should reject non-existent promptId");
  } catch (err) {
    assert(err instanceof RAGValidationException, "Expected RAGValidationException");
  }
  console.log("   ✓ Validation rules enforced correctly.");

  // 9. Snapshot Immutability
  console.log("\n8. Verifying Snapshot Immutability...");
  const snapshot = ragEngine.snapshot();
  assert(snapshot.knowledgeBaseId === "kb-1", "Snapshot knowledge base ID matches");
  assert(snapshot.promptsCount === 1, "Snapshot promptsCount matches");

  assert(Object.isFrozen(snapshot), "Snapshot is frozen");
  assert(Object.isFrozen(snapshot.contextWindow), "Snapshot contextWindow is frozen");

  try {
    (snapshot as any).promptsCount = 5;
    assert(false, "Should not allow mutating snapshot");
  } catch (err) {
    // correctly threw
  }
  console.log("   ✓ Snapshot properties are recursively deep-frozen.");

  // 10. Response Immutability
  console.log("\n9. Verifying Response Immutability...");
  const response = await ragEngine.retrieve({
    query: "typed",
    strategy: RetrievalStrategy.KEYWORD,
  });

  assert(Object.isFrozen(response), "Response is frozen");
  assert(Object.isFrozen(response.documents), "Response document list is frozen");
  assert(Object.isFrozen(response.documents[0]), "Response document items are frozen");
  console.log("   ✓ Retrieval responses are strictly immutable.");

  // 11. Deterministic Ordering
  console.log("\n10. Verifying Deterministic Ordering...");
  const orderReq = {
    query: "TypeScript Components React state",
    strategy: RetrievalStrategy.KEYWORD,
  };

  const o1 = await ragEngine.retrieve(orderReq);
  const o2 = await ragEngine.retrieve(orderReq);

  assert(o1.documents.length === o2.documents.length, "Result counts match");
  for (let i = 0; i < o1.documents.length; i++) {
    assert(o1.documents[i].chunkId === o2.documents[i].chunkId, `Ordering matches at index ${i}`);
    assert(o1.documents[i].score === o2.documents[i].score, `Scores match at index ${i}`);
  }
  console.log("   ✓ Deterministic ordering verified.");

  console.log("\n=== ALL RAG FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
