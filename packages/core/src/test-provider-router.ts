import { LLMRouter } from "./router/LLMRouter";
import { RouterBuilder } from "./router/RouterBuilder";
import { ModelDescriptor } from "./router/ModelDescriptor";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import { Provider } from "./providers/Provider";
import { ProviderType } from "./providers/ProviderType";
import { ProviderFeature } from "./providers/ProviderFeature";
import { ProviderState } from "./providers/ProviderState";
import { ProviderHealth } from "./providers/ProviderHealth";
import { ProviderRequest } from "./providers/ProviderRequest";
import { ProviderResponse, ProviderResponseChunk } from "./providers/ProviderResponse";
import { RouterContext } from "./router/RouterContext";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

const mockLogger: any = {
  info: (msg: string) => {},
  warn: (msg: string) => {},
  error: (msg: string, meta?: any, err?: any) => {},
  debug: (msg: string) => {},
};

// Define mock provider classes
class MockCostProvider extends Provider {
  public get models(): readonly ModelDescriptor[] {
    return [
      {
        id: "cheap-model",
        providerId: this.id,
        capabilities: { chat: true, vision: false, imageGeneration: false, audioInput: false, audioOutput: false, toolCalling: false, jsonMode: false, streaming: false },
        contextWindow: 4096,
        maxOutput: 1000,
        costMetadata: { inputCostPer1K: 0.0001, outputCostPer1K: 0.0002 },
        latencyMetadata: { averageLatencyMs: 300 },
        enabled: true,
      },
    ];
  }
  protected async performExecute(request: ProviderRequest): Promise<ProviderResponse> {
    return {
      responseId: "cheap-resp",
      providerId: this.id,
      model: request.model,
      content: "Cheap execution response",
      latency: 300,
    };
  }
  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    yield { chunkId: "c1", content: "cheap" };
  }
}

class MockFastProvider extends Provider {
  public get models(): readonly ModelDescriptor[] {
    return [
      {
        id: "fast-model",
        providerId: this.id,
        capabilities: { chat: true, vision: false, imageGeneration: false, audioInput: false, audioOutput: false, toolCalling: false, jsonMode: false, streaming: false },
        contextWindow: 4096,
        maxOutput: 1000,
        costMetadata: { inputCostPer1K: 0.005, outputCostPer1K: 0.01 },
        latencyMetadata: { averageLatencyMs: 50 },
        enabled: true,
      },
    ];
  }
  protected async performExecute(request: ProviderRequest): Promise<ProviderResponse> {
    return {
      responseId: "fast-resp",
      providerId: this.id,
      model: request.model,
      content: "Fast execution response",
      latency: 50,
    };
  }
  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    yield { chunkId: "c1", content: "fast" };
  }
}

class MockFailingProvider extends Provider {
  private _attempts = 0;
  public get models(): readonly ModelDescriptor[] {
    return [
      {
        id: "failing-model",
        providerId: this.id,
        capabilities: { chat: true, vision: false, imageGeneration: false, audioInput: false, audioOutput: false, toolCalling: false, jsonMode: false, streaming: false },
        contextWindow: 4096,
        maxOutput: 1000,
        costMetadata: { inputCostPer1K: 0.001, outputCostPer1K: 0.002 },
        latencyMetadata: { averageLatencyMs: 100 },
        enabled: true,
      },
    ];
  }
  protected async performExecute(request: ProviderRequest): Promise<ProviderResponse> {
    this._attempts++;
    throw new Error("Simulated provider crash!");
  }
  protected async *performStream(request: ProviderRequest): AsyncGenerator<ProviderResponseChunk> {
    throw new Error("Simulated stream crash!");
  }
}

async function runTests() {
  console.log("=== START PROVIDER ROUTER TESTS ===");

  const registry = new ProviderRegistry();
  const context: RouterContext = {
    logger: mockLogger,
    providerRegistry: registry,
    config: {} as any,
  };

  const cheapProvider = new MockCostProvider(
    "cheap-prov",
    "Cheap Provider",
    ProviderType.CHAT,
    [ProviderFeature.Streaming],
    {} as any,
    { models: [], settings: {} },
    {}
  );

  const fastProvider = new MockFastProvider(
    "fast-prov",
    "Fast Provider",
    ProviderType.CHAT,
    [ProviderFeature.Streaming],
    {} as any,
    { models: [], settings: {} },
    {}
  );

  const failingProvider = new MockFailingProvider(
    "failing-prov",
    "Failing Provider",
    ProviderType.CHAT,
    [ProviderFeature.Streaming],
    {} as any,
    { models: [], settings: {} },
    {}
  );

  registry.register(cheapProvider);
  registry.register(fastProvider);
  registry.register(failingProvider);

  const router = new LLMRouter(context);

  // 1. Verify Lookups in Registry
  console.log("1. Testing Provider Registry Lookups...");
  const lookup1 = registry.modelLookup("cheap-model");
  assert(lookup1 !== undefined && lookup1.provider.id === "cheap-prov", "modelLookup cheap-model fail");
  const lookup2 = registry.modelLookup("non-existent");
  assert(lookup2 === undefined, "modelLookup non-existent should be undefined");

  const providersWithStream = registry.capabilityLookup(ProviderFeature.Streaming);
  assert(providersWithStream.length === 3, "capabilityLookup Streaming count mismatch");
  console.log("✓ Lookups verified.");

  // 2. Test LOWEST_COST Strategy
  console.log("\n2. Testing LOWEST_COST Strategy...");
  const costRes = await router.route({
    prompt: "hello",
    routingStrategy: "LOWEST_COST",
  });
  assert(costRes.modelId === "cheap-model", "Should select cheap-model");
  assert(costRes.providerResponse.content === "Cheap execution response", "Should return cheap content");
  console.log("✓ LOWEST_COST Strategy passed.");

  // 3. Test LOWEST_LATENCY Strategy
  console.log("\n3. Testing LOWEST_LATENCY Strategy...");
  const latencyRes = await router.route({
    prompt: "hello",
    routingStrategy: "LOWEST_LATENCY",
  });
  assert(latencyRes.modelId === "fast-model", "Should select fast-model");
  assert(latencyRes.providerResponse.content === "Fast execution response", "Should return fast content");
  console.log("✓ LOWEST_LATENCY Strategy passed.");

  // 4. Test ROUND_ROBIN Strategy
  console.log("\n4. Testing ROUND_ROBIN Strategy...");
  const rr1 = await router.route({ prompt: "hello", routingStrategy: "ROUND_ROBIN" });
  const rr2 = await router.route({ prompt: "hello", routingStrategy: "ROUND_ROBIN" });
  assert(rr1.modelId !== rr2.modelId, "Round robin should select different models sequentially");
  console.log("✓ ROUND_ROBIN Strategy passed.");

  // 5. Test STICKY Strategy
  console.log("\n5. Testing STICKY Strategy...");
  const stick1 = await router.route({ prompt: "hello", routingStrategy: "STICKY" });
  const stick2 = await router.route({ prompt: "hello", routingStrategy: "STICKY" });
  assert(stick1.modelId === stick2.modelId, "Sticky routing should remain on same model");
  console.log("✓ STICKY Strategy passed.");

  // 6. Test Automatic Failover & Fallback Chain
  console.log("\n6. Testing Automatic Failover & Fallback...");
  // Register failing model to the router registry first
  router.registerModel({
    id: "failing-model",
    providerId: "failing-prov",
    capabilities: { chat: true, vision: false, imageGeneration: false, audioInput: false, audioOutput: false, toolCalling: false, jsonMode: false, streaming: false },
    contextWindow: 4096,
    maxOutput: 1000,
    costMetadata: { inputCostPer1K: 0.0001, outputCostPer1K: 0.0001 },
    latencyMetadata: { averageLatencyMs: 1 },
    enabled: true,
  });

  // Since failing-model is low cost, LOWEST_COST strategy will try it first.
  // Because failing-model throws, it should fall back to cheap-model!
  const failoverRes = await router.route({
    prompt: "hello",
    routingStrategy: "LOWEST_COST",
  });

  assert(failoverRes.modelId === "cheap-model", "Should fall back to cheap-model after failing-model crashes");
  assert(failoverRes.providerResponse.content === "Cheap execution response", "Should return cheap content after failover");
  assert((failoverRes.metadata?.fallbackChain as string[]).includes("cheap-model"), "Fallback chain metadata mismatch");
  console.log("✓ Automatic Failover & Fallback passed.");

  // 7. Verify Cooldown / Blacklist excludes failing-prov from next route selection
  console.log("\n7. Testing Cooldown/Blacklist Exclusion...");
  // Since failing-prov just failed, it should be in cooldown.
  // Let's execute round robin or standard route. It should select fast-model or cheap-model and NOT failing-model!
  const nextRes = await router.route({
    prompt: "hello",
    routingStrategy: "PREFERRED_MODEL",
    preferredModel: "failing-model",
  });
  assert(nextRes.modelId !== "failing-model", "Should exclude failing-model because provider is in cooldown");
  console.log("✓ Cooldown/Blacklist Exclusion passed.");

  console.log("\n=== ALL PROVIDER ROUTER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
