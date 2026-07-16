import {
  AIEngineBuilder,
  AITaskType,
  AIEngineState,
  AICapability,
  AIMessage,
  AIRequest,
  AIResponse,
  AIStreamChunk,
  AIEngineContext,
  AIEngineValidationException,
  InvalidAIEngineStateException,
} from "./index";
import { MetricType } from "./observability/MetricType";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock Security
class MockSecurity {
  public auditCalls: any[] = [];
  public async initialize() {}
  public async start() {}
  public async stop() {}
  public async authenticate() { return {} as any; }
  public async authorize() { return {} as any; }
  public async encrypt(plaintext: string) { return plaintext; }
  public async decrypt(ciphertext: string) { return ciphertext; }
  public audit(action: string, principalId: string | undefined, status: "SUCCESS" | "FAILURE", details: any) {
    this.auditCalls.push({ action, principalId, status, details });
  }
  public snapshot() { return {} as any; }
}

// Mock Observability
class MockObservability {
  public metrics: any[] = [];
  public spans: any[] = [];
  public async initialize() {}
  public async start() {}
  public async stop() {}
  public recordMetric(metric: any) {
    this.metrics.push(metric);
  }
  public startSpan(name: string, parentSpanId?: string, correlationId?: string, tags?: any) {
    const span = { id: "span-" + Math.random(), name, parentSpanId, correlationId, tags };
    this.spans.push(span);
    return span;
  }
  public endSpan(spanId: string) {}
  public health() { return {} as any; }
  public snapshot() { return {} as any; }
}

// Mock MessageBus
class MockMessageBus {
  public published: any[] = [];
  public async publish(message: any, options?: any) {
    this.published.push({ message, options });
  }
  public async send() {}
  public async request() { return {} as any; }
  public async reply() {}
  public subscribe() { return ""; }
  public unsubscribe() { return true; }
  public snapshot() { return {} as any; }
}

// Mock LLMRouter
class MockLLMRouter {
  public routeCalls: any[] = [];
  public streamCalls: any[] = [];
  public context: any = {
    providerRegistry: {
      list: () => [
        {
          models: [
            { id: "mock-chat-model", providerId: "mock-provider", enabled: true }
          ]
        }
      ]
    }
  };

  public registerModel() {}
  public unregisterModel() { return true; }

  public async route(request: any): Promise<any> {
    this.routeCalls.push(request);

    let content = "Mock response content";
    let toolCalls: any[] | undefined = undefined;

    if (request.taskType === AITaskType.EMBEDDINGS) {
      content = JSON.stringify([0.1, 0.2, 0.3]);
    } else if (request.taskType === AITaskType.STRUCTURED_OUTPUT) {
      content = JSON.stringify({ name: "AI Engine", version: "1.0.0" });
    } else if (request.taskType === AITaskType.TOOL_CALLING || request.metadata.tools) {
      toolCalls = [{ id: "call-1", name: "test_tool", arguments: { arg: "val" } }];
      content = "";
    }

    return {
      providerId: "mock-provider",
      modelId: request.preferredModel || "mock-chat-model",
      providerResponse: {
        responseId: "resp-123",
        providerId: "mock-provider",
        model: request.preferredModel || "mock-chat-model",
        content,
        toolCalls,
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        latency: 150,
        finishReason: "stop",
      },
      latency: 160,
    };
  }

  public async *routeStream(request: any): AsyncGenerator<any> {
    this.streamCalls.push(request);
    yield {
      chunkId: "chunk-1",
      content: "Hello",
    };
    yield {
      chunkId: "chunk-2",
      content: " streaming world",
      finishReason: "stop",
      usage: {
        promptTokens: 5,
        completionTokens: 15,
        totalTokens: 20,
      },
    };
  }

  public snapshot() { return {} as any; }
}

async function runTests() {
  console.log("=== START AI ENGINE TESTS ===");

  const router = new MockLLMRouter();
  const security = new MockSecurity();
  const observability = new MockObservability();
  const messageBus = new MockMessageBus();

  const context: AIEngineContext = {
    env: "test",
    namespace: "shaily.ai",
    router,
    security: security as any,
    observability: observability as any,
    messageBus: messageBus as any,
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  console.log("1. Running Builder Validation...");
  try {
    new AIEngineBuilder().build();
    throw new Error("Should have thrown for missing properties");
  } catch (err: unknown) {
    assert(
      err instanceof AIEngineValidationException,
      "Expected AIEngineValidationException for missing builder configurations"
    );
  }
  console.log("✓ Verified Builder Validation.");

  // ==========================================
  // 2. Lifecycle Validation
  // ==========================================
  console.log("\n2. Running Lifecycle Validation...");
  const builder = new AIEngineBuilder()
    .withContext(context)
    .withMetadata({ tier: "enterprise" });

  const engine = builder.build() as any;

  assert(engine.state === AIEngineState.CREATED, "Should start in CREATED state");

  // Illegal run before initialization
  try {
    await engine.execute({ taskType: AITaskType.CHAT, prompt: "hello" });
    throw new Error("Should have blocked execute before initialize");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidAIEngineStateException,
      "Expected InvalidAIEngineStateException on early execute"
    );
  }

  await engine.initialize();
  assert(engine.state === AIEngineState.READY, "Should transition to READY");

  await engine.start();
  assert(engine.state === AIEngineState.RUNNING, "Should transition to RUNNING");

  // Illegal double initialize
  try {
    await engine.initialize();
    throw new Error("Should have blocked initialize while running");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidAIEngineStateException,
      "Expected InvalidAIEngineStateException on double initialize"
    );
  }
  console.log("✓ Verified Lifecycle Validation.");

  // ==========================================
  // 3. Chat Execution
  // ==========================================
  console.log("\n3. Testing Chat Execution...");
  const chatRes = await engine.execute({
    taskType: AITaskType.CHAT,
    prompt: "Hello AIEngine",
  });

  assert(chatRes.success === true, "Execute should succeed");
  assert(chatRes.results[0].content === "Mock response content", "Should match mock content");
  assert(chatRes.results[0].usage.inputTokens === 10, "Input tokens should match");
  assert(chatRes.results[0].usage.outputTokens === 20, "Output tokens should match");
  assert(chatRes.results[0].usage.totalTokens === 30, "Total tokens should match");

  // Verify Observability Spans & Metrics
  assert(observability.spans.some(s => s.name === "AIEngine.execute"), "Should start execute span");
  assert(observability.metrics.some(m => m.name === "ai_engine.requests" && m.tags.status === "success"), "Should record request metric");

  // Verify MessageBus events
  assert(messageBus.published.some(evt => evt.message.type === "ai.execution.started"), "Started event published");
  assert(messageBus.published.some(evt => evt.message.type === "ai.execution.completed"), "Completed event published");

  // Verify Security audits
  assert(security.auditCalls.some(c => c.action === "ai.execute"), "Audit recorded");
  console.log("✓ Chat Execution verified.");

  // ==========================================
  // 4. Vision Execution
  // ==========================================
  console.log("\n4. Testing Vision Execution...");
  await engine.execute({
    taskType: AITaskType.VISION,
    prompt: "Analyze this image",
    attachments: [{ type: "image/jpeg", data: "base64data" }],
  });

  const visionRoute = router.routeCalls[router.routeCalls.length - 1];
  assert(visionRoute.requiredCapabilities.vision === true, "Should require vision capability");
  console.log("✓ Vision Execution verified.");

  // ==========================================
  // 5. Embedding Execution
  // ==========================================
  console.log("\n5. Testing Embedding Execution...");
  const embedRes = await engine.execute({
    taskType: AITaskType.EMBEDDINGS,
    prompt: "Calculate vector",
  });

  const embedValues = JSON.parse(embedRes.results[0].content);
  assert(Array.isArray(embedValues) && embedValues.length === 3 && embedValues[0] === 0.1, "Embedding format matches");
  console.log("✓ Embedding Execution verified.");

  // ==========================================
  // 6. JSON Mode
  // ==========================================
  console.log("\n6. Testing JSON Mode Execution...");
  await engine.execute({
    taskType: AITaskType.JSON_MODE,
    prompt: "Return JSON details",
  });

  const jsonRoute = router.routeCalls[router.routeCalls.length - 1];
  assert(jsonRoute.requiredCapabilities.jsonMode === true, "Should require jsonMode capability");
  console.log("✓ JSON Mode verified.");

  // ==========================================
  // 7. Structured Outputs
  // ==========================================
  console.log("\n7. Testing Structured Outputs...");
  const structRes = await engine.execute({
    taskType: AITaskType.STRUCTURED_OUTPUT,
    prompt: "Get struct details",
    responseSchema: {
      type: "object",
      properties: { name: { type: "string" }, version: { type: "string" } },
    },
  });

  const structValues = JSON.parse(structRes.results[0].content);
  assert(structValues.name === "AI Engine", "Structured response matches schema");
  console.log("✓ Structured Outputs verified.");

  // ==========================================
  // 8. Tool Calling
  // ==========================================
  console.log("\n8. Testing Tool Calling...");
  const toolRes = await engine.execute({
    taskType: AITaskType.TOOL_CALLING,
    prompt: "Trigger tool",
    tools: [{ name: "test_tool", description: "a test tool" }],
  });

  assert(toolRes.results[0].toolCalls?.length === 1, "Tool calls array present");
  assert(toolRes.results[0].toolCalls[0].name === "test_tool", "Tool call name matches");
  console.log("✓ Tool Calling verified.");

  // ==========================================
  // 9. Streaming
  // ==========================================
  console.log("\n9. Testing Streaming Generator...");
  const streamGen = engine.stream({
    taskType: AITaskType.CHAT,
    prompt: "Stream output",
  });

  let fullText = "";
  let finalUsageReport: any = undefined;
  for await (const chunk of streamGen) {
    fullText += chunk.content;
    if (chunk.usage) {
      finalUsageReport = chunk.usage;
    }
  }

  assert(fullText === "Hello streaming world", "Stream content reconstructed");
  assert(finalUsageReport !== undefined && finalUsageReport.totalTokens === 20, "Streaming usage matches");
  console.log("✓ Streaming verified.");

  // ==========================================
  // 10. Snapshot and Immutability
  // ==========================================
  console.log("\n10. Testing Snapshot and Immutability...");
  const snap = engine.snapshot();
  assert(snap.state === AIEngineState.RUNNING, "Snapshot state running");
  assert(snap.requestCount > 0, "Snapshot logs requests");

  assert(Object.isFrozen(snap), "Snapshot is frozen");
  assert(Object.isFrozen(snap.metadata), "Snapshot metadata frozen");

  try {
    (snap as any).requestCount = 999;
    throw new Error("Should block snapshot modification");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on mutation of frozen object");
  }

  // Verify response frozenness
  assert(Object.isFrozen(chatRes), "Response object frozen");
  assert(Object.isFrozen(chatRes.results), "Results list frozen");
  assert(Object.isFrozen(chatRes.results[0].usage), "Result usage frozen");
  console.log("✓ Snapshot and Immutability verified.");

  // ==========================================
  // 11. Validator Rule Checks
  // ==========================================
  console.log("\n11. Testing Validator Rule Checks...");
  try {
    await engine.execute({
      taskType: AITaskType.CHAT,
      prompt: "  ", // Empty prompt
    });
    throw new Error("Should have thrown for empty prompt");
  } catch (err: unknown) {
    assert(
      err instanceof AIEngineValidationException,
      "Expected AIEngineValidationException for empty prompt"
    );
  }

  try {
    await engine.execute({
      taskType: "UNKNOWN" as any,
      prompt: "hi",
    });
    throw new Error("Should have thrown for invalid task type");
  } catch (err: unknown) {
    assert(
      err instanceof AIEngineValidationException,
      "Expected AIEngineValidationException for invalid task type"
    );
  }
  console.log("✓ Validator Rule Checks verified.");

  // Clean up lifecycle
  await engine.stop();
  assert(engine.state === AIEngineState.STOPPED, "Should transition to STOPPED");

  console.log("\n=== ALL AI ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
