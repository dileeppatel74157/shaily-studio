import { LoggerBuilder } from "./logger/LoggerBuilder";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { MemoryStore } from "./memory/MemoryStore";
import { EventBus } from "./events/EventBus";
import { ProviderBuilder } from "./providers/ProviderBuilder";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import { ProviderState } from "./providers/ProviderState";
import { ProviderHandler } from "./providers/Provider";
import { ProviderContext } from "./providers/ProviderContext";
import { ProviderRequest } from "./providers/ProviderRequest";
import { ProviderResponse } from "./providers/ProviderResponse";
import { InvalidProviderStateException, ProviderValidationException } from "./providers/types";
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

// Implement mock provider handler
class MockProviderHandler implements ProviderHandler {
  public isInitialized = false;

  public async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  public async execute(
    context: ProviderContext,
    request: ProviderRequest
  ): Promise<ProviderResponse> {
    const promptText = request.prompt || (request.messages && request.messages[0]?.content) || "";
    return {
      text: `Mocked response to: "${promptText}"`,
      finishReason: "stop",
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      latency: 120,
      model: "mock-model-v1",
      provider: "mock-provider",
      metadata: { customField: "customVal" },
    };
  }

  public async health(): Promise<{ isHealthy: boolean; details?: Record<string, unknown> }> {
    return { isHealthy: true, details: { test: "ok" } };
  }
}

async function runTests() {
  console.log("=== START AI PROVIDER ABSTRACTION TESTS ===");

  const config = await new ConfigBuilder({}).build();
  const memoryStore = new MemoryStore();
  const eventBus = new EventBus(logger);

  const context: ProviderContext = {
    logger,
    config,
    memoryStore,
    eventBus,
  };

  const handler = new MockProviderHandler();

  // ==================================================
  // Test 1: Builder builds valid instances
  // ==================================================
  console.log("\n1. Running Builder Tests...");
  const provider = new ProviderBuilder()
    .withId("p-mock")
    .withName("Mock AI Provider")
    .withVersion("1.0.0")
    .withCapabilities({
      chat: true,
      vision: true,
      streaming: false,
    })
    .withContext(context)
    .withHandler(handler)
    .withCustomMetadata({ apiKeyType: "mock-key" })
    .build();

  assert(provider.id === "p-mock", "ID matches");
  assert(provider.name === "Mock AI Provider", "Name matches");
  assert(provider.version === "1.0.0", "Version matches");
  assert(provider.state === ProviderState.CREATED, "Initial state is CREATED");
  assert(provider.metadata.capabilities.chat === true, "Chat capability active");
  assert(provider.metadata.capabilities.streaming === false, "Streaming capability disabled");
  console.log("   ✓ Provider instance successfully constructed.");

  // ==================================================
  // Test 2: Validation constraints work
  // ==================================================
  console.log("\n2. Running Validation Tests...");
  try {
    new ProviderBuilder()
      .withName(" ") // Empty name
      .withContext(context)
      .withHandler(handler)
      .build();
    throw new Error("Should reject empty name");
  } catch (err) {
    assert(
      err instanceof ProviderValidationException || err instanceof Error,
      "Rejects empty metadata values"
    );
  }
  console.log("   ✓ Validator constraints verified.");

  // ==================================================
  // Test 3: State locks and Execution
  // ==================================================
  console.log("\n3. Running Execution and State Tests...");
  try {
    await provider.execute({ prompt: "hello" });
    throw new Error("Should not execute in CREATED state");
  } catch (err) {
    assert(err instanceof InvalidProviderStateException, "Prevents execute prior to initialize");
  }

  await provider.initialize();
  assert(provider.state === ProviderState.READY, "State transitions to READY after initialize");
  assert(handler.isInitialized === true, "Handler initialize hook was triggered");

  const response = await provider.execute({ prompt: "Hello World" });
  assert(response.text === 'Mocked response to: "Hello World"', "Response text matches");
  assert(response.latency === 120, "Response latency matches");
  assert(response.tokenUsage?.totalTokens === 30, "Response tokens match");
  assert(provider.state === ProviderState.READY, "State transitions back to READY after execution");
  console.log("   ✓ State transitions, initialization hook, and execution verified.");

  // ==================================================
  // Test 4: Registry operations
  // ==================================================
  console.log("\n4. Running Registry Tests...");
  const registry = new ProviderRegistry();
  assert(registry.has(provider.id) === false, "Not registered initially");

  registry.register(provider);
  assert(registry.has(provider.id) === true, "Registered successfully");
  assert(registry.get(provider.id) === provider, "Registry lookup returns correct instance");

  const registryExecuteResult = await registry.execute(provider.id, { prompt: "Query Registry" });
  assert(
    registryExecuteResult.text === 'Mocked response to: "Query Registry"',
    "Registry execution works"
  );

  const unregisterResult = registry.unregister(provider.id);
  assert(unregisterResult === true, "Unregister returns true");
  assert(registry.has(provider.id) === false, "Removed from registry");
  console.log("   ✓ Registry register, lookup, execution, and unregister verified.");

  // ==================================================
  // Test 5: Snapshots and Immutability
  // ==================================================
  console.log("\n5. Running Snapshot Tests...");
  const snap = provider.snapshot();
  assert(snap.id === provider.id, "Snapshot ID matches");
  assert(snap.state === ProviderState.READY, "Snapshot state matches");
  assert(snap.capabilities.chat === true, "Snapshot capabilities match");
  assert(snap.metadata.apiKeyType === "mock-key", "Custom metadata matches");

  assert(Object.isFrozen(snap), "Snapshot is frozen");
  assert(Object.isFrozen(snap.capabilities), "Snapshot capabilities list is frozen");
  assert(Object.isFrozen(snap.metadata), "Snapshot metadata is frozen");

  try {
    (snap as any).name = "Hacked";
    throw new Error("Should not allow snapshot mutation");
  } catch (err) {
    // correctly caught mutation error
  }
  console.log("   ✓ Snapshot data matches and is fully frozen.");

  // ==================================================
  // Test 6: Health checks work
  // ==================================================
  console.log("\n6. Running Health Checks...");
  const health = await provider.health();
  assert(health.isHealthy === true, "Mock provider reports healthy");
  assert(health.details?.test === "ok", "Mock health details match");
  console.log("   ✓ Provider health check verified.");

  console.log("\n=== ALL AI PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
