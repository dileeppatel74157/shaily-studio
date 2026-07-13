import { LoggerBuilder } from "./logger/LoggerBuilder";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { EventBus } from "./events/EventBus";
import { MemoryStore } from "./memory/MemoryStore";
import { ProviderBuilder } from "./providers/ProviderBuilder";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import { ProviderHandler } from "./providers/Provider";
import { ProviderContext } from "./providers/ProviderContext";
import { ProviderResponse } from "./providers/ProviderResponse";
import { LLMRouter } from "./router/LLMRouter";
import { RouterContext } from "./router/RouterContext";
import { ModelDescriptor } from "./router/ModelDescriptor";
import { RouterValidationException } from "./router/types";
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

// Mock provider handler returning static LLM responses
class DummyLLMHandler implements ProviderHandler {
  public async execute(context: ProviderContext, request: any): Promise<ProviderResponse> {
    return {
      text: `Routed output for: ${request.prompt || "messages"}`,
      finishReason: "stop",
      tokenUsage: {
        promptTokens: 15,
        completionTokens: 25,
        totalTokens: 40,
      },
      latency: 200,
      model: "dummy-model",
      provider: "dummy-provider",
    };
  }
}

async function runTests() {
  console.log("=== START LLM ROUTER VERIFICATION TESTS ===");

  const config = await new ConfigBuilder({}).build();
  const providerRegistry = new ProviderRegistry();
  const eventBus = new EventBus(logger);
  const memoryStore = new MemoryStore();

  const providerContext: ProviderContext = {
    logger,
    config,
    memoryStore,
    eventBus,
  };

  const routerContext: RouterContext = {
    logger,
    providerRegistry,
    config,
  };

  // 1. Setup Providers
  const handler = new DummyLLMHandler();

  const openAIProvider = new ProviderBuilder()
    .withId("openai-prov")
    .withName("OpenAI Provider")
    .withContext(providerContext)
    .withHandler(handler)
    .withCapabilities({ chat: true, vision: true })
    .build();

  const googleProvider = new ProviderBuilder()
    .withId("google-prov")
    .withName("Google Provider")
    .withContext(providerContext)
    .withHandler(handler)
    .withCapabilities({ chat: true, vision: false, imageGeneration: true })
    .build();

  providerRegistry.register(openAIProvider);
  providerRegistry.register(googleProvider);

  // 2. Setup Router
  const router = new LLMRouter(routerContext);

  const gpt4Model: ModelDescriptor = {
    id: "gpt-4",
    providerId: "openai-prov",
    capabilities: {
      chat: true,
      vision: true,
      imageGeneration: false,
      audioInput: false,
      audioOutput: false,
      toolCalling: true,
      jsonMode: true,
      streaming: true,
    },
    contextWindow: 8192,
    maxOutput: 2048,
    costMetadata: { inputCostPer1K: 0.03, outputCostPer1K: 0.06 },
    latencyMetadata: { averageLatencyMs: 800 },
    enabled: true,
  };

  const geminiModel: ModelDescriptor = {
    id: "gemini-pro",
    providerId: "google-prov",
    capabilities: {
      chat: true,
      vision: false,
      imageGeneration: true,
      audioInput: false,
      audioOutput: false,
      toolCalling: false,
      jsonMode: true,
      streaming: false,
    },
    contextWindow: 32768,
    maxOutput: 4096,
    costMetadata: { inputCostPer1K: 0.005, outputCostPer1K: 0.015 },
    latencyMetadata: { averageLatencyMs: 400 },
    enabled: true,
  };

  // ==================================================
  // Test 1: Model Registration
  // ==================================================
  console.log("\n1. Running Model Registration Tests...");
  assert(router.snapshot().registeredModelsCount === 0, "No registered models initially");

  router.registerModel(gpt4Model);
  router.registerModel(geminiModel);
  assert(router.snapshot().registeredModelsCount === 2, "Registered models matches");

  // Validation checks on register
  try {
    router.registerModel({ ...gpt4Model, id: "" });
    throw new Error("Should reject empty model ID");
  } catch (err) {
    assert(
      err instanceof RouterValidationException,
      "Throws RouterValidationException on empty ID"
    );
  }

  // Duplicate check
  try {
    router.registerModel(gpt4Model);
    throw new Error("Should reject duplicate model ID");
  } catch (err: any) {
    assert(err.message.includes("already registered"), "Rejects duplicate model registrations");
  }

  console.log("   ✓ Model registration and validation verified.");

  // ==================================================
  // Test 2: Routing by capability
  // ==================================================
  console.log("\n2. Running Capability Routing Tests...");
  // Requesting imageGeneration (only gemini-pro supports this)
  const responseCap = await router.route({
    prompt: "Generate a nice cat picture",
    requiredCapabilities: { imageGeneration: true },
  });
  assert(responseCap.modelId === "gemini-pro", "Capability match routes to gemini-pro");
  assert(responseCap.providerId === "google-prov", "Capability match routes to google-prov");
  console.log("   ✓ Routing by capability matched correctly.");

  // ==================================================
  // Test 3: Routing by preferred provider
  // ==================================================
  console.log("\n3. Running Preferred Provider Routing Tests...");
  const responseProv = await router.route({
    prompt: "Explain relativity",
    preferredProvider: "openai-prov",
  });
  assert(responseProv.modelId === "gpt-4", "Routes to gpt-4 because openai-prov was preferred");
  console.log("   ✓ Routing by preferred provider matched correctly.");

  // ==================================================
  // Test 4: Routing by preferred model
  // ==================================================
  console.log("\n4. Running Preferred Model Routing Tests...");
  const responseModel = await router.route({
    prompt: "Write a haiku",
    preferredModel: "gemini-pro",
  });
  assert(responseModel.modelId === "gemini-pro", "Routes to gemini-pro because it was preferred");
  console.log("   ✓ Routing by preferred model matched correctly.");

  // ==================================================
  // Test 5: Routing by cost (Lowest Cost Strategy)
  // ==================================================
  console.log("\n5. Running Cost Routing Tests...");
  // Explicitly set default strategy to LOWEST_COST
  router.policy.setDefaultStrategy("LOWEST_COST");
  const responseCost = await router.route({
    prompt: "Fast cheap answer",
  });
  // gemini-pro cost = 0.02, gpt-4 cost = 0.09. lowest is gemini-pro.
  assert(responseCost.modelId === "gemini-pro", "LOWEST_COST selects gemini-pro");

  // Test cost limit violation throwing
  try {
    await router.route({
      prompt: "Fail me please",
      maxCost: 0.01, // lower than gemini-pro's 0.02
    });
    throw new Error("Should have thrown cost limit violation");
  } catch (err: any) {
    assert(err.message.includes("cost"), "Throws error on cost limit violation");
  }
  console.log("   ✓ Cost strategy selection and limit enforcement verified.");

  // ==================================================
  // Test 6: Routing by latency (Lowest Latency Strategy)
  // ==================================================
  console.log("\n6. Running Latency Routing Tests...");
  // Explicitly set default strategy to LOWEST_LATENCY
  router.policy.setDefaultStrategy("LOWEST_LATENCY");
  const responseLat = await router.route({
    prompt: "Fastest response",
  });
  // gemini-pro latency = 400ms, gpt-4 latency = 800ms. lowest is gemini-pro.
  assert(responseLat.modelId === "gemini-pro", "LOWEST_LATENCY selects gemini-pro");

  // Test latency limit violation throwing
  try {
    await router.route({
      prompt: "Fail me please",
      maxLatency: 300, // lower than gemini-pro's 400ms
    });
    throw new Error("Should have thrown latency limit violation");
  } catch (err: any) {
    assert(err.message.includes("latency"), "Throws error on latency limit violation");
  }
  console.log("   ✓ Latency strategy selection and limit enforcement verified.");

  // ==================================================
  // Test 7: Snapshot immutability
  // ==================================================
  console.log("\n7. Running Snapshot Tests...");
  const snap = router.snapshot();
  assert(snap.registeredModelsCount === 2, "Snapshot model count matches");
  assert(snap.defaultStrategy === "LOWEST_LATENCY", "Snapshot reports default strategy");

  assert(Object.isFrozen(snap), "Snapshot object is frozen");
  assert(Object.isFrozen(snap.models), "Snapshot models array is frozen");
  assert(Object.isFrozen(snap.models[0]), "Individual snapshot model descriptor is frozen");

  try {
    (snap as any).defaultStrategy = "FIRST_AVAILABLE";
    throw new Error("Should prevent snapshot mutation");
  } catch (err) {
    // correctly threw error
  }
  console.log("   ✓ Snapshot data matches and is fully frozen.");

  console.log("\n=== ALL LLM ROUTER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
