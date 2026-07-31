import { GatewayEngine } from "./ai-gateway/GatewayEngine";
import { GatewayRequest } from "./ai-gateway/models";
import { CircuitBreakerState } from "./ai-gateway/CircuitBreakerState";
import { GatewayException } from "./ai-gateway/types";
import * as assert from "assert";

class MockAdapter {
  public executeCount = 0;
  public executeFn: any;
  constructor(public readonly providerId: string, public readonly adapterType: any) {}
  async connect() {}
  async execute(request: any): Promise<any> {
    this.executeCount++;
    if (this.executeFn) {
      return this.executeFn(request);
    }
    return {
      requestId: request.requestId,
      providerId: this.providerId,
      model: request.model,
      content: `Mock success from ${this.providerId}`,
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      costUsd: 0.00006,
      latencyMs: 15,
      finishReason: "stop"
    };
  }
  async *stream(request: any) {
    yield {
      requestId: request.requestId,
      chunkIndex: 0,
      delta: `Mock stream from ${this.providerId}`,
      done: true
    };
  }
}

async function runTests() {
  console.log("=== START ROUTING & FALLBACK SYSTEM TESTS ===");

  // Set test environment configuration
  process.env.PRIMARY_PROVIDER = "gemini";
  process.env.FALLBACK_PROVIDERS = "nvidia,openai,ollama";

  const context = {
    logger: {
      warn: (msg: string) => console.log(`[WARN LOG] ${msg}`),
      info: (msg: string) => console.log(`[INFO LOG] ${msg}`),
      error: (msg: string) => console.log(`[ERROR LOG] ${msg}`)
    },
    eventBus: {
      publish: async (event: any) => {
        console.log(`[EVENT] ${event.type}`, JSON.stringify(event.payload));
      }
    }
  };

  const gateway = new GatewayEngine(context, {
    environment: "test",
    defaultTimeoutMs: 100,
    maxRetries: 2,
    routingStrategy: "PRIORITY" as any,
    retryPolicy: "EXPONENTIAL" as any,
    circuitBreakerThreshold: 3,
    enableCostTracking: true,
    enableUsageMonitor: true
  });

  await gateway.initialize();

  // Inject mocks and isolate registry
  (gateway as any)._providers.clear();
  (gateway as any)._adapters.clear();

  // Create mock adapters
  const mockGemini = new MockAdapter("gemini", "GEMINI");
  const mockNvidia = new MockAdapter("nvidia", "NVIDIA");
  const mockOpenAI = new MockAdapter("openai", "OPENAI");
  const mockOllama = new MockAdapter("ollama", "OLLAMA");

  const builtIns = [
    { id: "gemini", type: "GEMINI", priority: 1000 },
    { id: "nvidia", type: "NVIDIA", priority: 900 },
    { id: "openai", type: "OPENAI", priority: 800 },
    { id: "ollama", type: "OLLAMA", priority: 700 }
  ];

  for (const bi of builtIns) {
    (gateway as any)._providers.set(bi.id, {
      providerId: bi.id,
      adapterType: bi.type,
      displayName: bi.id,
      capabilities: {
        supportsStreaming: true,
        supportsVision: true,
        supportsTools: true,
        supportsJsonMode: true,
        maxContextTokens: 128000,
        availableModels: ["gemini-2.0-flash", "nvidia/llama-3.1-70b-instruct", "gpt-4o", "llama3.2"],
        supportsChat: true,
        supportsImages: true,
        supportsEmbeddings: true
      },
      priority: bi.priority,
      enabled: true,
      version: "1.0.0"
    });
    (gateway as any)._circuits.set(bi.id, {
      providerId: bi.id,
      state: CircuitBreakerState.CLOSED,
      failures: 0,
      threshold: 3
    });
    (gateway as any)._health.set(bi.id, {
      providerId: bi.id,
      healthy: true,
      lastChecked: new Date(),
      failureCount: 0,
      consecutiveFails: 0,
      averageLatencyMs: 0
    });
  }

  (gateway as any)._adapters.set("gemini", mockGemini);
  (gateway as any)._adapters.set("nvidia", mockNvidia);
  (gateway as any)._adapters.set("openai", mockOpenAI);
  (gateway as any)._adapters.set("ollama", mockOllama);

  // 1. Verify provider priority configuration
  const geminiEntry = (gateway as any)._providers.get("gemini");
  const nvidiaEntry = (gateway as any)._providers.get("nvidia");
  const openaiEntry = (gateway as any)._providers.get("openai");
  
  assert.ok(geminiEntry.priority > nvidiaEntry.priority, "Gemini priority should be higher than Nvidia");
  assert.ok(nvidiaEntry.priority > openaiEntry.priority, "Nvidia priority should be higher than OpenAI");
  console.log("✅ Test: Provider priority respected");

  // Helper reset
  const resetCounts = () => {
    mockGemini.executeCount = 0;
    mockNvidia.executeCount = 0;
    mockOpenAI.executeCount = 0;
    mockOllama.executeCount = 0;
    mockGemini.executeFn = undefined;
    mockNvidia.executeFn = undefined;
    mockOpenAI.executeFn = undefined;
    mockOllama.executeFn = undefined;
    
    // Reset circuit breakers and health states
    for (const pid of ["gemini", "nvidia", "openai", "ollama"]) {
      const entry = (gateway as any)._circuits.get(pid);
      if (entry) {
        entry.state = CircuitBreakerState.CLOSED;
        entry.failures = 0;
      }
      const h = (gateway as any)._health.get(pid);
      if (h) {
        h.failureCount = 0;
        h.consecutiveFails = 0;
      }
    }
  };

  // 2. Successful fallback (Gemini fails with 429, Nvidia succeeds)
  resetCounts();
  mockGemini.executeFn = () => {
    const err = new Error("Rate limit exceeded");
    (err as any).statusCode = 429;
    throw err;
  };
  
  const req1: GatewayRequest = {
    requestId: "req-1",
    providerId: "gemini",
    model: "gemini-2.0-flash",
    prompt: "Hello fallback",
    stream: false
  };

  const resp1 = await gateway.execute(req1);
  assert.strictEqual(mockGemini.executeCount, 3, "Gemini should be retried 3 times (1 initial + 2 retries)");
  assert.strictEqual(mockNvidia.executeCount, 1, "Nvidia should execute once");
  assert.strictEqual(resp1.providerId, "nvidia", "Response should be from Nvidia");
  console.log("✅ Test: Successful fallback");
  console.log("✅ Test: Retry then fallback");

  // 3. Multiple fallback providers (Gemini 429 -> Nvidia 503 -> OpenAI succeeds)
  resetCounts();
  mockGemini.executeFn = () => {
    const err = new Error("Rate limit");
    (err as any).status = 429;
    throw err;
  };
  mockNvidia.executeFn = () => {
    const err = new Error("Service Temporarily Unavailable");
    (err as any).statusCode = 503;
    throw err;
  };
  const resp2 = await gateway.execute({
    requestId: "req-2",
    providerId: "gemini",
    model: "gemini-2.0-flash",
    prompt: "Hello multi-fallback",
    stream: false
  });
  assert.strictEqual(mockGemini.executeCount, 3, "Gemini retried 3 times");
  assert.strictEqual(mockNvidia.executeCount, 3, "Nvidia retried 3 times");
  assert.strictEqual(mockOpenAI.executeCount, 1, "OpenAI executed once");
  assert.strictEqual(resp2.providerId, "openai", "Response should be from OpenAI");
  console.log("✅ Test: Multiple fallback providers");

  // 4. Recoverable vs Unrecoverable Error Classification (Gemini fails with 401 Unauthorized -> fails immediately)
  resetCounts();
  mockGemini.executeFn = () => {
    const err = new Error("Unauthorized access key");
    (err as any).statusCode = 401;
    throw err;
  };
  try {
    await gateway.execute({
      requestId: "req-3",
      providerId: "gemini",
      model: "gemini-2.0-flash",
      prompt: "Hello unrecoverable",
      stream: false
    });
    assert.fail("Should have thrown error immediately");
  } catch (err: any) {
    assert.ok(err.message.includes("Unauthorized") || err.message.includes("unauthorized"), "Should contain original unauthorized error");
    assert.strictEqual(mockGemini.executeCount, 1, "Should not retry unrecoverable error");
    assert.strictEqual(mockNvidia.executeCount, 0, "Should not fallback on unrecoverable error");
    console.log("✅ Test: Unrecoverable error classification (401 Unauthorized)");
  }

  // 5. Recoverable validation errors vs other recoverable checks
  resetCounts();
  mockGemini.executeFn = () => {
    const err = new Error("connection reset");
    throw err;
  };
  const resp3 = await gateway.execute({
    requestId: "req-4",
    providerId: "gemini",
    model: "gemini-2.0-flash",
    prompt: "Hello connection reset",
    stream: false
  });
  assert.strictEqual(resp3.providerId, "nvidia", "Should fallback on connection reset");
  console.log("✅ Test: Recoverable error classification (Connection Reset)");

  // 6. Circuit Breaker skip (Nvidia circuit is open -> skipped during fallback)
  resetCounts();
  const nvidiaCircuit = (gateway as any)._circuits.get("nvidia");
  nvidiaCircuit.state = CircuitBreakerState.OPEN;

  mockGemini.executeFn = () => {
    const err = new Error("Quota exceeded");
    throw err;
  };
  
  const resp4 = await gateway.execute({
    requestId: "req-5",
    providerId: "gemini",
    model: "gemini-2.0-flash",
    prompt: "Hello circuit skip",
    stream: false
  });
  assert.strictEqual(mockGemini.executeCount, 3, "Gemini retried 3 times");
  assert.strictEqual(mockNvidia.executeCount, 0, "Nvidia should be skipped entirely");
  assert.strictEqual(mockOpenAI.executeCount, 1, "OpenAI executed once");
  assert.strictEqual(resp4.providerId, "openai", "Response should be from OpenAI");
  console.log("✅ Test: Circuit breaker skip");

  // Restore Nvidia's circuit
  nvidiaCircuit.state = CircuitBreakerState.CLOSED;

  // 7. All providers fail
  resetCounts();
  const failFn = () => {
    throw new Error("Temporary network error");
  };
  mockGemini.executeFn = failFn;
  mockNvidia.executeFn = failFn;
  mockOpenAI.executeFn = failFn;
  mockOllama.executeFn = failFn;

  try {
    await gateway.execute({
      requestId: "req-6",
      providerId: "gemini",
      model: "gemini-2.0-flash",
      prompt: "Hello all fail",
      stream: false
    });
    assert.fail("Should have failed when all providers are exhausted");
  } catch (err: any) {
    assert.ok(err instanceof GatewayException, "Should be a GatewayException");
    assert.ok(err.message.includes("All candidate providers failed"), "Should specify exhausted error");
    console.log("✅ Test: All providers fail");
  }

  // 8. Backward compatibility (normal chat execution works with default options)
  resetCounts();
  const resp5 = await gateway.execute({
    requestId: "req-7",
    providerId: "gemini",
    model: "gemini-2.0-flash",
    prompt: "Hello backward compatibility",
    stream: false
  });
  assert.strictEqual(resp5.providerId, "gemini", "Gemini should succeed normally when no error");
  assert.strictEqual(resp5.content, "Mock success from gemini", "Content should be returned");
  console.log("✅ Test: Backward compatibility");

  console.log("=== ALL FALLBACK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
