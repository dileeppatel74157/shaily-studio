import { LoggerBuilder } from "./logger/LoggerBuilder";
import { EventBus } from "./events/EventBus";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { RegistryBuilder } from "./registry/RegistryBuilder";
import { JobEngine } from "./jobs/JobEngine";
import { MemoryStore } from "./memory/MemoryStore";
import { AgentBuilder } from "./agents/AgentBuilder";
import { AgentRegistry } from "./agents/AgentRegistry";
import { AgentState } from "./agents/AgentState";
import { InvalidAgentStateException } from "./agents/types";
import { AgentLifecycle } from "./agents/AgentLifecycle";
import { AgentContext } from "./agents/AgentContext";

import { JsonFormatter } from "./logger/LogFormatter";

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

// Composed lifecycle spy implementation
class TestLifecycle implements AgentLifecycle {
  public initialized = false;
  public executed = false;
  public shutdownCalled = false;
  public lastInput: unknown = null;

  public async initialize(context: AgentContext): Promise<void> {
    this.initialized = true;
    context.logger.info("Test lifecycle initialized");
  }

  public async execute(context: AgentContext, input?: unknown): Promise<unknown> {
    this.executed = true;
    this.lastInput = input;

    // Verify context services can be successfully invoked
    context.logger.info("Executing lifecycle task");
    await context.eventBus.publish({
      id: "agent-evt-123",
      name: "agent.custom.event",
      timestamp: new Date(),
      correlationId: "corr-123",
      source: "test-agent",
      payload: { done: true },
      metadata: {},
    });

    await context.memoryStore.set("agent", "run-state", "active");

    return { output: "test-lifecycle-result", receivedInput: input };
  }

  public async shutdown(context: AgentContext): Promise<void> {
    this.shutdownCalled = true;
    context.logger.info("Test lifecycle shut down");
  }
}

async function runTests() {
  console.log("=== START AGENT SDK VERIFICATION TESTS ===");

  // Build standard platform services to inject into AgentContext
  const eventBus = new EventBus(logger);
  const config = await new ConfigBuilder({}).build();
  const serviceRegistry = new RegistryBuilder().build();
  const jobEngine = new JobEngine(logger, eventBus);
  const memoryStore = new MemoryStore();

  const context: AgentContext = {
    logger,
    config,
    registry: serviceRegistry,
    eventBus,
    jobEngine,
    memoryStore,
  };

  // ==================================================
  // Test 1: Fluent Builder builds successfully
  // ==================================================
  console.log("\n1. Running Agent Builder Tests...");
  const lifecycle = new TestLifecycle();
  const agent = new AgentBuilder()
    .withName("IdeatorAgent")
    .withVersion("1.2.0")
    .withDescription("Generates content outlines")
    .withCapabilities(["ideate", "outline"])
    .withMetadata({ department: "creative" })
    .withContext(context)
    .withLifecycle(lifecycle)
    .build();

  assert(agent.id.length === 36, "ID is a valid UUID");
  assert(agent.name === "IdeatorAgent", "Name matches");
  assert(agent.version === "1.2.0", "Version matches");
  assert(agent.description === "Generates content outlines", "Description matches");
  assert(agent.capabilities.includes("ideate"), "Capabilities match");
  assert(agent.metadata.department === "creative", "Metadata matches");
  assert(agent.state === AgentState.CREATED, "Initial state is CREATED");
  console.log("   ✓ AgentBuilder builds valid instances.");

  // ==================================================
  // Test 2: Lifecycle hooks and transitions behave deterministically
  // ==================================================
  console.log("\n2. Running Lifecycle and State Transition Tests...");
  {
    // Execute before initialize should fail
    try {
      await agent.execute();
      throw new Error("Should not allow executing before initialize");
    } catch (err) {
      assert(err instanceof InvalidAgentStateException, "Throws InvalidAgentStateException");
    }

    // Initialize agent
    await agent.initialize();
    assert(lifecycle.initialized === true, "Initialize hook invoked");
    assert(agent.state === AgentState.READY, "State transitions to READY");

    // Double initialize should fail
    try {
      await agent.initialize();
      throw new Error("Should not allow double initialize");
    } catch (err) {
      assert(err instanceof InvalidAgentStateException, "Throws InvalidAgentStateException");
    }

    // Execute agent
    const result = (await agent.execute("input-data")) as any;
    assert(lifecycle.executed === true, "Execute hook invoked");
    assert(lifecycle.lastInput === "input-data", "Input passed successfully");
    assert(result.output === "test-lifecycle-result", "Result returned successfully");
    assert(agent.state === AgentState.COMPLETED, "State transitions to COMPLETED");

    // Verify context integrations inside execute hook
    const storedState = await memoryStore.get("agent", "run-state");
    assert(
      storedState !== undefined && storedState.value === "active",
      "Memory store set in execute worked"
    );

    // Shutdown agent
    await agent.shutdown();
    assert(lifecycle.shutdownCalled === true, "Shutdown hook invoked");
    assert(agent.state === AgentState.STOPPED, "State transitions to STOPPED");
    console.log("   ✓ Deterministic lifecycle and state transitions verified.");
  }

  // ==================================================
  // Test 3: Registry operations works
  // ==================================================
  console.log("\n3. Running Agent Registry Tests...");
  {
    const registry = new AgentRegistry();
    assert(registry.has(agent.id) === false, "Not registered initially");

    // Registration
    registry.register(agent);
    assert(registry.has(agent.id) === true, "Registered successfully");
    assert(registry.get(agent.id) === agent, "Lookup returns agent reference");

    // Snapshot
    const snap = registry.snapshot();
    assert(Object.isFrozen(snap), "Registry snapshot is frozen");
    assert(Object.isFrozen(snap.agents), "Registry snapshot agents list is frozen");
    assert(snap.count === 1, "Snapshot count is 1");
    assert(snap.agents[0].id === agent.id, "Snapshot contains agent properties");

    // Duplicate registration rejection
    try {
      registry.register(agent);
      throw new Error("Should not allow duplicate registration");
    } catch (err: any) {
      assert(err.message.includes("already registered"), "Rejects duplicate ID registration");
    }

    // Unregistration
    const removed = registry.unregister(agent.id);
    assert(removed === true, "Unregister returns true");
    assert(registry.has(agent.id) === false, "Agent removed from registry");
    console.log("   ✓ Registry registration, lookup, removal, and snapshot verified.");
  }

  // ==================================================
  // Test 4: Immutability of agent metadata snapshot
  // ==================================================
  console.log("\n4. Running Snapshot Immutability Tests...");
  {
    const agentSnap = agent.snapshot();
    assert(Object.isFrozen(agentSnap), "Agent snapshot is frozen");
    assert(Object.isFrozen(agentSnap.capabilities), "Capabilities in snapshot are frozen");
    assert(Object.isFrozen(agentSnap.metadata), "Metadata in snapshot is frozen");

    try {
      (agentSnap as any).name = "HackedName";
      throw new Error("Should not allow editing frozen snapshot properties");
    } catch (err) {
      // correctly caught mutation error in strict mode
    }
    console.log("   ✓ Snapshot immutability verified.");
  }

  console.log("\n=== ALL AGENT SDK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
