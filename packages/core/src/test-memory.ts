import { MemoryStore } from "./memory/MemoryStore";
import { MemorySerializer } from "./memory/MemorySerializer";
import { InvalidMemoryException } from "./memory/types";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START MEMORY LAYER VERIFICATION TESTS ===");

  const serializer = new MemorySerializer();
  const store = new MemoryStore(serializer);

  // ==================================================
  // Test 1: Set and Get works
  // ==================================================
  console.log("\n1. Running Set/Get Tests...");
  {
    const entry = await store.set("kernel", "port", 8080, { description: "API Port" });
    assert(entry.key === "port", "Key matches");
    assert(entry.namespace === "kernel", "Namespace matches");
    assert(entry.value === 8080, "Value matches");
    assert(entry.version === 1, "Initial version is 1");
    assert(entry.metadata.description === "API Port", "Metadata matches");

    const retrieved = await store.get("kernel", "port");
    assert(retrieved !== undefined, "Entry exists");
    assert(retrieved!.value === 8080, "Retrieved value matches");
    console.log("   ✓ Basic set and get verified.");
  }

  // ==================================================
  // Test 2: Namespace Isolation works
  // ==================================================
  console.log("\n2. Running Namespace Isolation Tests...");
  {
    // Same key "config" in "logger" and "workflow" namespaces
    await store.set("logger", "config", { level: "info" });
    await store.set("workflow", "config", { steps: 5 });

    const loggerConfig = await store.get("logger", "config");
    const workflowConfig = await store.get("workflow", "config");

    assert(loggerConfig !== undefined, "Logger config exists");
    assert(workflowConfig !== undefined, "Workflow config exists");
    assert(loggerConfig!.value.level === "info", "Logger value level matches");
    assert(workflowConfig!.value.steps === 5, "Workflow value steps matches");
    console.log("   ✓ Namespace isolation verified.");
  }

  // ==================================================
  // Test 3: Version increment works
  // ==================================================
  console.log("\n3. Running Version Increment Tests...");
  {
    const entryV1 = await store.set("system", "status", "starting");
    assert(entryV1.version === 1, "First write is version 1");

    const entryV2 = await store.set("system", "status", "running");
    assert(entryV2.version === 2, "Second write is version 2");
    assert(entryV2.createdAt.getTime() === entryV1.createdAt.getTime(), "createdAt is preserved");
    assert(entryV2.updatedAt.getTime() >= entryV1.updatedAt.getTime(), "updatedAt is updated");

    const retrieved = await store.get("system", "status");
    assert(retrieved!.version === 2, "Retrieved entry is version 2");
    assert(retrieved!.value === "running", "Retrieved value is updated");
    console.log("   ✓ Version increment verified.");
  }

  // ==================================================
  // Test 4: Validation works
  // ==================================================
  console.log("\n4. Running Validator Tests...");
  {
    // Empty key rejection
    try {
      await store.set("system", "  ", "value");
      throw new Error("Should reject empty key");
    } catch (err) {
      assert(err instanceof InvalidMemoryException, "Throws InvalidMemoryException for empty key");
    }

    // Empty namespace rejection
    try {
      await store.set("", "key", "value");
      throw new Error("Should reject empty namespace");
    } catch (err) {
      assert(
        err instanceof InvalidMemoryException,
        "Throws InvalidMemoryException for empty namespace"
      );
    }

    // Undefined value rejection
    try {
      await store.set("system", "key", undefined);
      throw new Error("Should reject undefined value");
    } catch (err) {
      assert(
        err instanceof InvalidMemoryException,
        "Throws InvalidMemoryException for undefined value"
      );
    }
    console.log("   ✓ Validator rejections verified.");
  }

  // ==================================================
  // Test 5: Serializer deep clone works
  // ==================================================
  console.log("\n5. Running Serializer Deep Clone Tests...");
  {
    const original = {
      nested: {
        array: [1, 2, 3],
        text: "hello",
      },
    };

    // Storing the object
    const entry = await store.set("user", "profile", original);

    // Mutate the original object
    original.nested.array.push(4);
    original.nested.text = "hacked";

    // Verify stored object remains unchanged
    const retrieved = await store.get("user", "profile");
    assert(retrieved!.value.nested.array.length === 3, "Stored array remains unchanged (length 3)");
    assert(retrieved!.value.nested.text === "hello", "Stored text remains unchanged ('hello')");
    console.log("   ✓ Serializer deep clone verified.");
  }

  // ==================================================
  // Test 6: Serializer deep freeze works (immutability)
  // ==================================================
  console.log("\n6. Running Serializer Deep Freeze Tests...");
  {
    const entry = await store.get("user", "profile");

    assert(Object.isFrozen(entry), "MemoryEntry object must be frozen");
    assert(Object.isFrozen(entry!.value), "Value object must be frozen");
    assert(Object.isFrozen(entry!.value.nested), "Nested value object must be frozen");
    assert(Object.isFrozen(entry!.value.nested.array), "Nested array must be frozen");

    try {
      entry!.value.nested.text = "mutate";
      throw new Error("Should not allow modifying frozen value properties");
    } catch (err) {
      // correctly caught mutation error in strict mode
    }
    console.log("   ✓ Serializer deep freeze verified.");
  }

  // ==================================================
  // Test 7: Snapshot works and is metadata-only
  // ==================================================
  console.log("\n7. Running Snapshot Tests...");
  {
    const snap = await store.snapshot();

    assert(Object.isFrozen(snap), "Snapshot object is frozen");
    assert(Object.isFrozen(snap.entries), "Snapshot entries list is frozen");
    assert(snap.totalEntriesCount > 0, "Snapshot contains entries");

    // Verify each snapshot entry does NOT contain a 'value' property
    for (const entrySnap of snap.entries) {
      assert(Object.isFrozen(entrySnap), "Individual entry snapshot is frozen");
      assert(!("value" in entrySnap), "Entry snapshot must NOT expose value");
    }
    console.log("   ✓ Metadata-only immutable snapshot verified.");
  }

  // ==================================================
  // Test 8: delete and clear works
  // ==================================================
  console.log("\n8. Running Delete and Clear Tests...");
  {
    const initialExists = await store.has("kernel", "port");
    assert(initialExists, "Entry exists initially");

    const deleteResult = await store.delete("kernel", "port");
    assert(deleteResult === true, "Delete returns true");

    const existsAfterDelete = await store.has("kernel", "port");
    assert(!existsAfterDelete, "Entry no longer exists");

    // Clear specific namespace "logger"
    const loggerExists = await store.has("logger", "config");
    assert(loggerExists, "Logger config exists");
    await store.clear("logger");
    const loggerExistsAfterClear = await store.has("logger", "config");
    assert(!loggerExistsAfterClear, "Logger config cleared");
    const workflowExists = await store.has("workflow", "config");
    assert(workflowExists, "Workflow config still exists (isolated namespace clear)");

    // Clear all namespaces
    await store.clear();
    const workflowExistsAfterFullClear = await store.has("workflow", "config");
    assert(!workflowExistsAfterFullClear, "Workflow config cleared on full clear");
    console.log("   ✓ Delete and Clear functions verified.");
  }

  // ==================================================
  // Test 9: keys and entries works
  // ==================================================
  console.log("\n9. Running Keys/Entries Retrieval Tests...");
  {
    await store.set("ns1", "k1", "v1");
    await store.set("ns1", "k2", "v2");
    await store.set("ns2", "k3", "v3");

    // Keys of specific namespace
    const ns1Keys = await store.keys("ns1");
    assert(ns1Keys.length === 2, "ns1 has 2 keys");
    assert(ns1Keys.includes("k1") && ns1Keys.includes("k2"), "ns1 keys match");

    // Keys of all namespaces
    const allKeys = await store.keys();
    assert(allKeys.length === 3, "All namespaces have 3 keys total");
    assert(allKeys.includes("ns1:k1"), "Includes ns1:k1");
    assert(allKeys.includes("ns2:k3"), "Includes ns2:k3");

    // Entries of specific namespace
    const ns1Entries = await store.entries("ns1");
    assert(ns1Entries.length === 2, "ns1 has 2 entries");
    assert(ns1Entries[0][0] === "k1" && ns1Entries[0][1].value === "v1", "ns1 entry 1 matches");

    // Entries of all namespaces
    const allEntries = await store.entries();
    assert(allEntries.length === 3, "3 entries total");
    assert(allEntries.find(([k]) => k === "ns2:k3")![1].value === "v3", "ns2 entry matches");
    console.log("   ✓ Keys and entries methods verified.");
  }

  console.log("\n=== ALL MEMORY LAYER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
