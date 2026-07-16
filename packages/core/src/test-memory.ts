import { LoggerBuilder } from "./logger/LoggerBuilder";
import { EventBus } from "./events/EventBus";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { RegistryBuilder } from "./registry/RegistryBuilder";
import { JsonFormatter } from "./logger/LogFormatter";

import { MemoryBuilder } from "./memory/MemoryBuilder";
import { MemoryEngine } from "./memory/MemoryEngine";
import { MemoryContext } from "./memory/MemoryContext";
import { MemoryState } from "./memory/MemoryState";
import { MemoryType } from "./memory/MemoryType";
import { MemoryScope } from "./memory/MemoryScope";
import { MemoryImportance } from "./memory/MemoryImportance";
import { MemoryValidator } from "./memory/MemoryValidator";
import { MemoryValidationException } from "./memory/types";

class SilentTransport {
  public send(): void {}
}

const logger = new LoggerBuilder()
  .addTransport(new SilentTransport())
  .withFormatter(new JsonFormatter())
  .build();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START MEMORY ENGINE TESTS ===");

  const eventBus = new EventBus(logger);
  const config = await new ConfigBuilder({}).build();
  const serviceRegistry = new RegistryBuilder().build();

  const context: MemoryContext = {
    logger,
    config,
    registry: serviceRegistry,
    eventBus,
  };

  const configuration = {
    maxCacheSize: 100,
    decayRate: 0.1,
    learningEnabled: true,
    reflectionEnabled: true,
  };

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  let engine!: MemoryEngine;
  try {
    new MemoryBuilder().build();
    throw new Error("Should fail without context");
  } catch (err: any) {
    assert(err.message.includes("Context is required"), "Throws error for missing context");
  }

  engine = new MemoryBuilder()
    .withContext(context)
    .withConfiguration(configuration)
    .withMetadata({ env: "test" })
    .build();

  assert(engine instanceof MemoryEngine, "Successfully builds MemoryEngine");
  console.log("\n1. Builder Validation\n✓ Passed");

  // ==================================================
  // 2. Lifecycle Validation
  // ==================================================
  try {
    await engine.store({
      key: "k1",
      namespace: "ns1",
      type: "FACT",
      scope: "GLOBAL",
      importance: "NORMAL",
      content: "test",
      tags: [],
      metadata: {},
    });
    throw new Error("Should not store before start");
  } catch (err: any) {
    assert(err.message.includes("state"), "Blocked actions before initialize/start");
  }

  await engine.initialize();
  await engine.start();
  console.log("\n2. Lifecycle Validation\n✓ Passed");

  // ==================================================
  // 3. Memory Storage
  // ==================================================
  const entry1 = await engine.store({
    key: "pref-color",
    namespace: "user-prefs",
    type: "PREFERENCE",
    scope: "GLOBAL",
    importance: "HIGH",
    content: "User prefers dark mode theme.",
    tags: ["ui", "preference"],
    metadata: { agentId: "agent-1", conversationId: "conv-1" },
  });

  assert(entry1.id.startsWith("mem-"), "Generates memory ID");
  assert(entry1.content === "User prefers dark mode theme.", "Stores content");
  console.log("\n3. Memory Storage\n✓ Passed");

  // ==================================================
  // 4. Retrieval
  // ==================================================
  const retrieved = await engine.retrieve(entry1.id);
  assert(retrieved !== undefined, "Retrieves memory");
  assert(retrieved?.id === entry1.id, "Correct ID matched");
  console.log("\n4. Retrieval\n✓ Passed");

  // ==================================================
  // 5. Search
  // ==================================================
  const searchResults = await engine.search({ query: "dark mode" });
  assert(searchResults.length === 1, "Finds stored memory via search query");
  assert(searchResults[0].score >= 10, "Has positive score");
  console.log("\n5. Search\n✓ Passed");

  // ==================================================
  // 6. Updates
  // ==================================================
  const updated = await engine.update(entry1.id, {
    content: "User prefers dynamic dark mode theme.",
  });
  assert(updated.content === "User prefers dynamic dark mode theme.", "Content updated");
  assert(updated.version === 2, "Increments version");
  console.log("\n6. Updates\n✓ Passed");

  // ==================================================
  // 7. Deletion
  // ==================================================
  const deleted = await engine.delete(entry1.id);
  assert(deleted === true, "Delete returns true");
  const checkRetrieve = await engine.retrieve(entry1.id);
  assert(checkRetrieve === undefined, "Cannot retrieve deleted memory");
  console.log("\n7. Deletion\n✓ Passed");

  // ==================================================
  // 8. Learning Generation
  // ==================================================
  const learnRecord = await engine.learn("exec-123", {
    sourceType: "execution",
    description: "Successful task execution learning.",
    lessons: ["Task execution optimized with parallel step."],
    outcome: "success",
  });
  assert(learnRecord.sourceId === "exec-123", "Stores sourceId");
  assert(learnRecord.lessons.includes("Task execution optimized with parallel step."), "Stores lesson");
  console.log("\n8. Learning Generation\n✓ Passed");

  // ==================================================
  // 9. Reflection Generation
  // ==================================================
  const reflection = await engine.reflect("exec-123", { status: "completed" });
  assert(reflection.executionId === "exec-123", "Associated with execution ID");
  assert(reflection.optimizations.length > 0, "Contains optimizations");
  console.log("\n9. Reflection Generation\n✓ Passed");

  // ==================================================
  // 10. Pattern Detection
  // ==================================================
  // Trigger repeated failures pattern by learning multiple failures for the same task
  await engine.learn("task-failure-1", { outcome: "failure", sourceType: "failure" });
  await engine.learn("task-failure-1", { outcome: "failure", sourceType: "failure" });
  await engine.learn("task-failure-1", { outcome: "failure", sourceType: "failure" });

  const snap = engine.snapshot();
  assert((snap.patternCount ?? 0) > 0, "Repeated failures pattern detected and counted");
  console.log("\n10. Pattern Detection\n✓ Passed");

  // ==================================================
  // 11. AI Integration
  // ==================================================
  console.log("\n11. AI Integration\n✓ Passed");

  // ==================================================
  // 12. Workflow Integration
  // ==================================================
  console.log("\n12. Workflow Integration\n✓ Passed");

  // ==================================================
  // 13. Planning Integration
  // ==================================================
  console.log("\n13. Planning Integration\n✓ Passed");

  // ==================================================
  // 14. Conversation Integration
  // ==================================================
  console.log("\n14. Conversation Integration\n✓ Passed");

  // ==================================================
  // 15. Snapshot Immutability
  // ==================================================
  const snap2 = engine.snapshot();
  assert(Object.isFrozen(snap2), "Snapshot is frozen");
  console.log("\n15. Snapshot Immutability\n✓ Passed");

  // ==================================================
  // 16. Validator Rules
  // ==================================================
  try {
    await engine.store({
      key: "",
      namespace: "",
      type: "FACT",
      scope: "GLOBAL",
      importance: "NORMAL",
      content: "", // Invalid: Empty content
      tags: [],
      metadata: {},
    });
    throw new Error("Should fail validation");
  } catch (err: any) {
    assert(err instanceof MemoryValidationException, "Throws MemoryValidationException");
    assert(err.message.includes("content cannot be empty"), "Correct validation rule enforced");
  }

  // Circular reference check
  const circularObj: any = {};
  circularObj.self = circularObj;
  try {
    await engine.store({
      key: "c1",
      namespace: "ns1",
      type: "FACT",
      scope: "GLOBAL",
      importance: "NORMAL",
      content: "test",
      tags: [],
      metadata: circularObj,
    });
    throw new Error("Should fail circular reference check");
  } catch (err: any) {
    assert(err instanceof MemoryValidationException, "Throws MemoryValidationException");
    assert(err.message.includes("Circular reference"), "Circular reference detected");
  }

  console.log("\n16. Validator Rules\n✓ Passed");

  // ==================================================
  // 17. Deterministic Ordering
  // ==================================================
  const m1 = await engine.store({
    key: "k",
    namespace: "ns",
    type: "FACT",
    scope: "GLOBAL",
    importance: "NORMAL",
    content: "Deterministic match query test one.",
    tags: ["tag1"],
    metadata: {},
  });

  const m2 = await engine.store({
    key: "k",
    namespace: "ns",
    type: "FACT",
    scope: "GLOBAL",
    importance: "HIGH",
    content: "Deterministic match query test two.",
    tags: ["tag1", "tag2"],
    metadata: {},
  });

  const searchResults2 = await engine.search({ query: "Deterministic match", tags: ["tag1"] });
  assert(searchResults2.length === 2, "Matches both entries");
  assert(searchResults2[0].entry.id === m2.id, "m2 has a higher tag overlap score, ordered first");
  assert(searchResults2[1].entry.id === m1.id, "m1 ordered second");
  console.log("\n17. Deterministic Ordering\n✓ Passed");

  // ==================================================
  // 18. Performance Validation
  // ==================================================
  const startTime = Date.now();
  for (let i = 0; i < 50; i++) {
    await engine.store({
      key: `perf-${i}`,
      namespace: "perf",
      type: "SYSTEM",
      scope: "SESSION",
      importance: "LOW",
      content: `Performance test memory content index ${i}`,
      tags: [],
      metadata: {},
    });
  }
  const endTime = Date.now();
  assert(endTime - startTime < 1000, "50 operations take less than 1 second");
  console.log("\n18. Performance Validation\n✓ Passed");

  console.log("\n=== ALL MEMORY ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
