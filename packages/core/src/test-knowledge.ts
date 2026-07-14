import {
  KnowledgeBuilder,
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeQuery,
  KnowledgeResult,
  KnowledgeValidationException,
  KnowledgeBase,
} from "./index";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START KNOWLEDGE BASE FRAMEWORK TESTS ===");

  // Sample Documents and Chunks
  const doc1: KnowledgeDocument = {
    id: "doc-1",
    title: "TypeScript Guide",
    collection: "programming",
    metadata: { author: "John Doe", difficulty: "intermediate" },
    chunks: [
      { id: "chunk-1-1", documentId: "doc-1", text: "TypeScript is a strongly typed superset of JavaScript.", index: 0 },
      { id: "chunk-1-2", documentId: "doc-1", text: "Interfaces in TypeScript define contracts for objects.", index: 1 },
    ],
  };

  const doc2: KnowledgeDocument = {
    id: "doc-2",
    title: "React Basics",
    collection: "web-dev",
    metadata: { author: "Alice Smith", difficulty: "beginner" },
    chunks: [
      { id: "chunk-2-1", documentId: "doc-2", text: "React is a JavaScript library for building user interfaces.", index: 0 },
      { id: "chunk-2-2", documentId: "doc-2", text: "Components are the core building blocks of React applications.", index: 1 },
    ],
  };

  // 1. Knowledge Builder
  console.log("\n1. Verifying Knowledge Builder...");
  const kb = new KnowledgeBuilder()
    .withId("kb-1")
    .withName("Shaily Documentation Base")
    .withCollection("programming")
    .withCollection("web-dev")
    .withMetadata({ department: "engineering" })
    .withDocument(doc1)
    .build();

  assert(kb.id === "kb-1", "KB ID matches");
  assert(kb.name === "Shaily Documentation Base", "KB Name matches");
  assert(kb.metadata.department === "engineering", "KB Metadata matches");
  assert(kb.hasDocument("doc-1"), "Seeded document is registered");
  console.log("   ✓ Knowledge builder verified successfully.");

  // 2. Document Registration
  console.log("\n2. Verifying Document Registration...");
  kb.addDocument(doc2);
  assert(kb.hasDocument("doc-2"), "Newly added document is registered");
  assert(kb.getDocument("doc-2")?.title === "React Basics", "Can lookup registered document");
  console.log("   ✓ Document registration verified.");

  // 3. Duplicate Prevention
  console.log("\n3. Verifying Duplicate Prevention...");
  try {
    kb.addDocument(doc1); // duplicate ID
    assert(false, "Should have thrown on duplicate document ID");
  } catch (err) {
    assert(err instanceof KnowledgeValidationException, "Expected KnowledgeValidationException on duplicate ID");
  }
  console.log("   ✓ Duplicate document ID registration prevented.");

  // 4. Chunk Validation
  console.log("\n4. Verifying Chunk Validation...");
  // Empty text in chunk
  try {
    const invalidDoc: KnowledgeDocument = {
      id: "doc-invalid-chunk",
      title: "Invalid",
      collection: "test",
      metadata: {},
      chunks: [
        { id: "c-1", documentId: "doc-invalid-chunk", text: "", index: 0 }, // empty text
      ],
    };
    kb.addDocument(invalidDoc);
    assert(false, "Should have rejected empty text chunk");
  } catch (err) {
    assert(err instanceof KnowledgeValidationException, "Expected KnowledgeValidationException on empty chunk text");
  }

  // Duplicate chunk IDs in same doc
  try {
    const invalidDoc: KnowledgeDocument = {
      id: "doc-invalid-chunk-2",
      title: "Invalid Chunks",
      collection: "test",
      metadata: {},
      chunks: [
        { id: "c-dup", documentId: "doc-invalid-chunk-2", text: "Text 1", index: 0 },
        { id: "c-dup", documentId: "doc-invalid-chunk-2", text: "Text 2", index: 1 }, // duplicate ID
      ],
    };
    kb.addDocument(invalidDoc);
    assert(false, "Should have rejected duplicate chunk ID in document");
  } catch (err) {
    assert(err instanceof KnowledgeValidationException, "Expected KnowledgeValidationException on duplicate chunk ID");
  }
  console.log("   ✓ Invalid chunk texts and duplicate chunk IDs correctly rejected.");

  // 5. Keyword Search & Ranking
  console.log("\n5. Verifying Keyword Search & Ranking...");
  // Query matches "TypeScript" and "superset"
  const searchResult = kb.search({ keyword: "TypeScript superset", exact: false });
  assert(searchResult.length > 0, "Keyword search returns results");
  // The first result should be chunk-1-1 because it matches both terms. chunk-1-2 only matches "TypeScript".
  assert(searchResult[0].chunkId === "chunk-1-1", "Ranks chunk matching most terms highest");
  assert(searchResult[0].score > 0, "Relevance score is positive");
  console.log("   ✓ Keyword search and token-based relevance ranking verified.");

  // Exact match search
  console.log("5b. Verifying Exact Match Search...");
  const exactResult = kb.search({ keyword: "typed superset", exact: true });
  assert(exactResult.length === 1 && exactResult[0].chunkId === "chunk-1-1", "Exact matching retrieves correct chunk");
  const exactNoResult = kb.search({ keyword: "typescript interfaces", exact: true });
  assert(exactNoResult.length === 0, "Exact match fails when terms are separated");
  console.log("   ✓ Exact match search verified.");

  // 6. Collection Filtering
  console.log("\n6. Verifying Collection Filtering...");
  const collectionResult = kb.search({ keyword: "JavaScript", collection: "web-dev" });
  // "doc-1" has "JavaScript" but collection is "programming".
  // "doc-2" has "JavaScript" and collection is "web-dev".
  assert(collectionResult.length === 1, "Returns only 1 match");
  assert(collectionResult[0].documentId === "doc-2", "Filters out other collections");
  console.log("   ✓ Collection filter correctly limits search pool.");

  // 7. Metadata Filtering
  console.log("\n7. Verifying Metadata Filtering...");
  const metadataResult = kb.search({
    keyword: "JavaScript",
    metadata: { difficulty: "intermediate" },
  });
  // doc-1 (difficulty: intermediate) contains JavaScript. doc-2 (difficulty: beginner) contains JavaScript.
  assert(metadataResult.length === 1, "Returns only matching metadata documents");
  assert(metadataResult[0].documentId === "doc-1", "Metadata filter filters correctly");
  console.log("   ✓ Metadata filter correctly limits search pool.");

  // 8. Snapshot Immutability
  console.log("\n8. Verifying Snapshot Immutability...");
  const snapshot = kb.snapshot();
  assert(snapshot.id === "kb-1", "Snapshot matches ID");
  assert(snapshot.collectionsCount === 2, "Collections count is correct");
  assert(snapshot.documentsCount === 2, "Documents count is correct");
  assert(snapshot.chunksCount === 4, "Total chunks count is correct");

  assert(Object.isFrozen(snapshot), "Snapshot is frozen");
  assert(Object.isFrozen(snapshot.metadata), "Snapshot metadata is frozen");

  try {
    (snapshot as any).name = "New Name";
    assert(false, "Should not allow mutating snapshot properties");
  } catch (err) {
    // correctly threw error
  }
  console.log("   ✓ Snapshot properties are recursively deep-frozen.");

  // 9. Search Result Immutability
  console.log("\n9. Verifying Search Result Immutability...");
  const results = kb.search({ keyword: "Components" });
  assert(results.length > 0, "Search returns results");
  assert(Object.isFrozen(results), "Search results array is frozen");
  assert(Object.isFrozen(results[0]), "Search result object is frozen");
  assert(Object.isFrozen(results[0].metadata), "Search result metadata is frozen");
  console.log("   ✓ Search results are strictly immutable.");

  // 10. Document Removal
  console.log("\n10. Verifying Document Removal...");
  const removed = kb.removeDocument("doc-1");
  assert(removed === true, "removeDocument returns true");
  assert(!kb.hasDocument("doc-1"), "Document is no longer registered");

  const searchAfterRemove = kb.search({ keyword: "TypeScript" });
  assert(searchAfterRemove.length === 0, "Chunks of removed document are not searchable");

  const removeNonExist = kb.removeDocument("not-existing");
  assert(removeNonExist === false, "Removing non-existent document returns false");
  console.log("   ✓ Document removal cleans up document registry and indices.");

  console.log("\n=== ALL KNOWLEDGE BASE FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
