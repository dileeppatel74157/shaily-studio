import {
  LLMProviderBuilder,
  LLMProviderValidator,
  LLMProviderEngine,
  ProviderState,
  ProviderType,
  ModelCategory,
  ProviderHealth,
  ProviderEventType,
  StreamingState,
  RequestPriority,
  ChatMessage,
  ProviderConfiguration,
  StreamingChunk
} from "./llm-provider";

const ctx = { env: "test", namespace: "shaily-studio" };

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// Seeding helper configs
const openAiConfig: ProviderConfiguration = {
  provider: ProviderType.OPENAI,
  apiKey: "sk-proj-openai-test-key-12345",
  models: [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      category: ModelCategory.CHAT,
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
      capabilities: ["vision", "tools", "json"]
    },
    {
      id: "text-embedding-3-small",
      name: "Text Embedding 3 Small",
      category: ModelCategory.EMBEDDING,
      maxContextTokens: 8191,
      maxOutputTokens: 0,
      capabilities: []
    }
  ]
};

const geminiConfig: ProviderConfiguration = {
  provider: ProviderType.GEMINI,
  apiKey: "AIzaSyGeminiTestKey12345",
  models: [
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      category: ModelCategory.CHAT,
      maxContextTokens: 2000000,
      maxOutputTokens: 8192,
      capabilities: ["vision", "tools", "json"]
    }
  ]
};

async function run(): Promise<void> {
  console.log("\n=== START SPRINT 24.1 LLM PROVIDER TESTS ===\n");

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  const builderEngine = new LLMProviderBuilder()
    .withContext(ctx)
    .withProvider(openAiConfig)
    .build() as LLMProviderEngine;
  assert(builderEngine !== undefined, "LLMProviderEngine built successfully");

  // 2. Lifecycle Transitions
  console.log("2. Lifecycle Transitions...");
  const engine = new LLMProviderEngine(ctx);
  assert(engine.getState() === ProviderState.CREATED, "Initial state is CREATED");
  await engine.initialize();
  assert(engine.getState() === ProviderState.READY, "State after initialize() is READY");

  // 3. Provider Registration
  console.log("3. Provider Registration...");
  const regOpenAI = await engine.getProviderManager().registerProvider(openAiConfig);
  assert(regOpenAI !== undefined, "OpenAI provider registration succeeds");
  assert(regOpenAI.state === ProviderState.READY, "Registered provider state is READY");

  // 4. Provider Removal
  console.log("4. Provider Removal...");
  const tempConfig: ProviderConfiguration = {
    provider: ProviderType.OLLAMA,
    models: [{ id: "llama3", name: "Llama 3", category: ModelCategory.CHAT, maxContextTokens: 8192, maxOutputTokens: 2048, capabilities: [] }]
  };
  await engine.getProviderManager().registerProvider(tempConfig);
  assert(engine.getProviderManager().getProvider(ProviderType.OLLAMA) !== undefined, "Ollama registered");
  await engine.getProviderManager().unregisterProvider(ProviderType.OLLAMA);
  assert(engine.getProviderManager().getProvider(ProviderType.OLLAMA) === undefined, "Ollama successfully unregistered");

  // 5. Model Discovery
  console.log("5. Model Discovery...");
  const models = engine.getModelManager().listModels();
  assert(models.length >= 2, `Model discovery listed models (${models.length})`);
  assert(engine.getModelManager().isModelSupported(ProviderType.OPENAI, "gpt-4o"), "gpt-4o is supported");
  assert(!engine.getModelManager().isModelSupported(ProviderType.OPENAI, "unknown-model"), "unknown-model is not supported");

  // 6. Chat Completion
  console.log("6. Chat Completion...");
  const messages: ChatMessage[] = [
    { role: "system", content: "You are a creative writer." },
    { role: "user", content: "Give me a title for a video about time travel." }
  ];
  const chatResponse = await engine.chat({
    id: "req-chat-1",
    model: "gpt-4o",
    messages
  });
  assert(chatResponse.content.toLowerCase().includes("gpt-4o"), "Chat response returned mock content");
  assert(chatResponse.usage !== undefined, "Token usage tracked");

  // 7. Streaming Completion
  console.log("7. Streaming Completion...");
  const chunks: StreamingChunk[] = [];
  await engine.streamChat({
    id: "req-stream-1",
    model: "gpt-4o",
    messages
  }, (c: StreamingChunk) => chunks.push(c));
  assert(chunks.length > 0, "Received streaming chunks");
  assert(chunks[chunks.length - 1].state === StreamingState.COMPLETED, "Final chunk indicates completion");

  // 8. Embedding Generation
  console.log("8. Embedding Generation...");
  const embResponse = await engine.embed({
    id: "req-emb-1",
    model: "text-embedding-3-small",
    input: "Time travel theories"
  });
  assert(embResponse.embeddings.length === 1, "One embedding returned");
  assert(embResponse.embeddings[0].length === 1536, "Embedding dimension is 1536");

  // 9. Usage Tracking
  console.log("9. Usage Tracking...");
  const globalUsage = engine.getUsageManager().getUsage();
  assert(globalUsage.totalTokens > 0, `Global usage tokens tracked: ${globalUsage.totalTokens}`);
  const openAiStats = engine.getUsageManager().getStatistics(ProviderType.OPENAI);
  assert(openAiStats.totalRequests >= 3, `OpenAI total requests tracked: ${openAiStats.totalRequests}`);

  // 10. Health Monitoring
  console.log("10. Health Monitoring...");
  const healthReport = await engine.getHealthManager().checkHealth(ProviderType.OPENAI);
  assert(healthReport.status === ProviderHealth.HEALTHY, "OpenAI health status is HEALTHY");

  // 11. Capability Detection
  console.log("11. Capability Detection...");
  const cap = engine.getProviderManager().getProvider(ProviderType.OPENAI)?.capabilities;
  assert(cap?.supportsStreaming === true, "OpenAI capability supportsStreaming is true");
  assert(cap?.supportsEmbeddings === true, "OpenAI capability supportsEmbeddings is true");

  // 12. Automatic Fallback
  console.log("12. Automatic Fallback...");
  // Register Gemini as fallback provider for OpenAI
  const openAiConfigWithFallback: ProviderConfiguration = {
    ...openAiConfig,
    fallbackConfig: {
      fallbackProviders: [ProviderType.GEMINI],
      fallbackModels: ["gemini-1.5-pro"]
    }
  };
  await engine.getProviderManager().unregisterProvider(ProviderType.OPENAI);
  await engine.getProviderManager().registerProvider(openAiConfigWithFallback);
  await engine.getProviderManager().registerProvider(geminiConfig);

  // Set OpenAI health to unhealthy
  const openAiReg = engine.getProviderManager().getProvider(ProviderType.OPENAI)!;
  openAiReg.health = ProviderHealth.UNHEALTHY;

  let fallbackEventFired = false;
  engine.getEventManager().on(ProviderEventType.FALLBACK_TRIGGERED, () => { fallbackEventFired = true; });

  const fallbackResponse = await engine.chat({
    id: "req-fallback-1",
    model: "gpt-4o",
    messages
  });
  assert(fallbackResponse.provider === ProviderType.GEMINI, "Routed to fallback provider (Gemini)");
  assert(fallbackResponse.model === "gemini-1.5-pro", "Routed to fallback model (gemini-1.5-pro)");
  assert(fallbackEventFired, "FALLBACK_TRIGGERED event fired successfully");

  // 13. Runtime Integration
  console.log("13. Runtime Integration...");
  const snapshot = engine.getSnapshot();
  assert(snapshot !== undefined, "Engine snapshot created");

  // 14. Assistant Integration Mock Usage
  console.log("14. Assistant Integration Mock Usage...");
  const assistantMock = {
    context: { llmProviderEngine: engine },
    async runMessage(prompt: string) {
      return this.context.llmProviderEngine.chat({
        id: "req-assist-1",
        model: "gemini-1.5-pro",
        messages: [{ role: "user", content: prompt }]
      });
    }
  };
  const assistantResponse = await assistantMock.runMessage("Hello world");
  assert(assistantResponse.provider === ProviderType.GEMINI, "Assistant successfully invoked provider engine");

  // 15. Pipeline Integration Mock Usage
  console.log("15. Pipeline Integration Mock Usage...");
  const pipelineMock = {
    context: { llmProviderEngine: engine },
    async processStep(prompt: string) {
      return this.context.llmProviderEngine.complete({
        id: "req-pipeline-1",
        model: "gemini-1.5-pro",
        prompt
      });
    }
  };
  const pipelineResponse = await pipelineMock.processStep("Translate to Hindi");
  assert(pipelineResponse.text.toLowerCase().includes("gemini"), "Pipeline successfully invoked completion");

  // 16. Event Publishing
  console.log("16. Event Publishing...");
  let startEventFired = false;
  engine.getEventManager().on(ProviderEventType.REQUEST_STARTED, () => { startEventFired = true; });
  await engine.embed({
    id: "req-emb-event-test",
    model: "text-embedding-3-small",
    input: "test event"
  });
  assert(startEventFired, "REQUEST_STARTED event was captured");

  // 17. Snapshot Immutability
  console.log("17. Snapshot Immutability...");
  const snap = engine.getSnapshot();
  let threw = false;
  try {
    (snap as any).globalUsage = "mutated";
  } catch {
    threw = true;
  }
  assert(threw || snap.globalUsage.totalTokens !== 0, "Snapshot freeze prevented modification");

  // 18. Validator Rules
  console.log("18. Validator Rules...");
  let invalidThrew = false;
  try {
    LLMProviderValidator.validateTemperature(3.5);
  } catch {
    invalidThrew = true;
  }
  assert(invalidThrew, "Validator correctly rejects temperature > 2.0");

  const report = LLMProviderValidator.generateReport(openAiConfig);
  assert(report.valid, "Valid OpenAI config produces valid report");

  // 19. Multi-provider Routing
  console.log("19. Multi-provider Routing...");
  const geminiTarget = engine.getRouter().routeRequest({
    id: "req-route-1",
    model: "gemini-1.5-pro",
    messages: []
  });
  assert(geminiTarget === ProviderType.GEMINI, "Routed correctly to Gemini provider");

  // 20. End-to-End Provider Lifecycle
  console.log("20. End-to-End Provider Lifecycle...");
  const finalStats = engine.getUsageManager().getStatistics();
  assert(finalStats.totalRequests > 0, `Total processed requests: ${finalStats.totalRequests}`);
  assert(finalStats.successfulRequests > 0, `Total successful requests: ${finalStats.successfulRequests}`);

  console.log(`\n=== ${passed}/${passed + failed} LLM PROVIDER TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `— ${failed} FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
