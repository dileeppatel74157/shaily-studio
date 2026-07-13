import { StudioBuilder } from "./studio/StudioBuilder";
import { StudioState } from "./studio/StudioState";
import { InvalidStudioStateException } from "./studio/types";
import {
  LOGGER_TOKEN,
  CONFIG_TOKEN,
  REGISTRY_TOKEN,
  EVENT_BUS_TOKEN,
  JOB_ENGINE_TOKEN,
  MEMORY_STORE_TOKEN,
  AGENT_REGISTRY_TOKEN,
  WORKFLOW_ENGINE_TOKEN,
  KERNEL_TOKEN,
} from "./studio/StudioServices";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START STUDIO BACKEND BOOTSTRAP TESTS ===");

  // 1. Build validation
  console.log("\n1. Running Studio Builder Tests...");
  const studio = await new StudioBuilder()
    .withEnvironment("production")
    .withVersion("2.0.0-rc1")
    .build();

  assert(studio.id !== undefined && studio.id.length === 36, "Studio ID should be generated");
  assert(studio.version === "2.0.0-rc1", "Studio version matches configuration");
  assert(studio.environment === "production", "Studio environment matches configuration");
  assert(studio.state === StudioState.CREATED, "Initial state is CREATED");
  console.log("   ✓ Builder generated valid instance.");

  // 2. Context immutability
  console.log("\n2. Running Context Immutability Tests...");
  assert(Object.isFrozen(studio.context), "Context wrapper is frozen");
  try {
    (studio as any).context = {} as any;
    throw new Error("Should not allow context replacement");
  } catch (err: any) {
    assert(
      err.message !== "Should not allow context replacement",
      "Runtime type error thrown on context reassignment"
    );
  }
  console.log("   ✓ Context immutability verified.");

  // 3. Service Registry content validation
  console.log("\n3. Running Service Registration Tests...");
  const registry = studio.context.registry;
  assert(registry.has(LOGGER_TOKEN), "Logger is registered in registry");
  assert(registry.has(CONFIG_TOKEN), "Config is registered in registry");
  assert(registry.has(REGISTRY_TOKEN), "Registry itself is registered in registry");
  assert(registry.has(EVENT_BUS_TOKEN), "EventBus is registered in registry");
  assert(registry.has(JOB_ENGINE_TOKEN), "JobEngine is registered in registry");
  assert(registry.has(MEMORY_STORE_TOKEN), "MemoryStore is registered in registry");
  assert(registry.has(AGENT_REGISTRY_TOKEN), "AgentRegistry is registered in registry");
  assert(registry.has(WORKFLOW_ENGINE_TOKEN), "WorkflowEngine is registered in registry");
  assert(registry.has(KERNEL_TOKEN), "Kernel is registered in registry");
  console.log("   ✓ All core services registered correctly with typed ServiceTokens.");

  // 4. Duplicate prevention tests (part 1)
  console.log("\n4. Running Lifecycle Duplicate Prevention Tests...");
  try {
    await studio.start();
    throw new Error("Should not allow starting before initialize");
  } catch (err) {
    assert(
      err instanceof InvalidStudioStateException,
      "Throws InvalidStudioStateException on invalid start"
    );
  }

  // 5. Initialize and state transition
  console.log("\n5. Running Studio Initialization...");
  await studio.initialize();
  assert(studio.state === StudioState.READY, "State is READY after initialization");

  try {
    await studio.initialize();
    throw new Error("Should not allow duplicate initialization");
  } catch (err) {
    assert(
      err instanceof InvalidStudioStateException,
      "Throws InvalidStudioStateException on double initialize"
    );
  }
  console.log("   ✓ Studio initialized and double initialize prevented.");

  // 6. Start and state transition
  console.log("\n6. Running Studio Startup...");
  await studio.start();
  assert(studio.state === StudioState.RUNNING, "State is RUNNING after startup");

  try {
    await studio.start();
    throw new Error("Should not allow duplicate start");
  } catch (err) {
    assert(
      err instanceof InvalidStudioStateException,
      "Throws InvalidStudioStateException on double start"
    );
  }
  console.log("   ✓ Studio started and double start prevented.");

  // 7. Snapshot immutability
  console.log("\n7. Running Snapshot Tests...");
  const snap = studio.snapshot();
  assert(snap.id === studio.id, "Snapshot ID matches");
  assert(snap.version === "2.0.0-rc1", "Snapshot version matches");
  assert(snap.environment === "production", "Snapshot environment matches");
  assert(snap.state === StudioState.RUNNING, "Snapshot state is RUNNING");
  assert(snap.registeredServicesCount === 9, "Registered service count is 9");

  assert(Object.isFrozen(snap), "Snapshot is frozen");
  try {
    (snap as any).environment = "development";
    throw new Error("Should not allow snapshot mutation");
  } catch (err) {
    // correctly threw error
  }
  console.log("   ✓ Snapshot data matches and is fully frozen.");

  // 8. Stop and state transition
  console.log("\n8. Running Studio Shutdown...");
  await studio.stop();
  assert(studio.state === StudioState.STOPPED, "State is STOPPED after shutdown");

  try {
    await studio.stop();
    throw new Error("Should not allow duplicate stop");
  } catch (err) {
    assert(
      err instanceof InvalidStudioStateException,
      "Throws InvalidStudioStateException on double stop"
    );
  }
  console.log("   ✓ Studio shutdown and double stop prevented.");

  console.log("\n=== ALL STUDIO BOOTSTRAP TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
