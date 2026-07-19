import { GatewayBuilder } from "./ai-gateway/GatewayBuilder";
import { GatewayState } from "./ai-gateway/GatewayState";
import { ProviderAdapterType } from "./ai-gateway/ProviderAdapterType";
import { RequestRoutingStrategy } from "./ai-gateway/RequestRoutingStrategy";
import { CircuitBreakerState } from "./ai-gateway/CircuitBreakerState";
import { AuthStrategy } from "./ai-gateway/AuthStrategy";
import { GatewayValidationException, GatewayException, CircuitOpenException } from "./ai-gateway/types";
import { GatewayValidator } from "./ai-gateway/GatewayValidator";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ FAILED:", message);
    process.exit(1);
  }
}

const mockContext = {
  logger: {
    info: (_m: string) => {},
    warn: (_m: string) => {},
    error: (_m: string) => {}
  },
  eventBus: { publish: async (_e: any) => {} }
};

let reqIdCounter = 1;
const nextReqId = () => `req-${reqIdCounter++}`;

async function runTests() {
  console.log("=== START SPRINT 24.1 AI PROVIDER GATEWAY TESTS ===\n");

  // ── 1. Builder requires context ───────────────────────────────────────────
  try {
    new GatewayBuilder().build();
    assert(false, "Builder should throw when context is missing.");
  } catch (err: any) {
    assert(err instanceof GatewayValidationException, "Expected GatewayValidationException.");
  }
  console.log("1. Builder requires context... ✓");

  // ── 2. Lifecycle transitions ──────────────────────────────────────────────
  const engine = new GatewayBuilder().withContext(mockContext).build();
  assert(engine.getState() === GatewayState.CREATED, "Initial state should be CREATED.");

  await engine.initialize();
  assert(engine.getState() === GatewayState.RUNNING, "State should be RUNNING after initialize.");

  await engine.stop();
  assert(engine.getState() === GatewayState.STOPPED, "State should be STOPPED after stop.");

  // Re-initialize for remaining tests
  await engine.initialize();
  console.log("2. Lifecycle transitions... ✓");

  // ── 3. Provider registration and discovery ────────────────────────────────
  const providers = engine.getRegistry().discoverProviders();
  assert(providers.length === 9, `Expected 9 built-in providers, got ${providers.length}.`);
  const ids = providers.map(p => p.providerId);
  assert(ids.includes("openai"),     "OpenAI provider not registered.");
  assert(ids.includes("gemini"),     "Gemini provider not registered.");
  assert(ids.includes("ollama"),     "Ollama provider not registered.");
  assert(ids.includes("huggingface"),"HuggingFace provider not registered.");
  assert(ids.includes("tavily"),     "Tavily provider not registered.");
  console.log("3. Provider registration and discovery... ✓");

  // ── 4. Provider health status ─────────────────────────────────────────────
  const health = engine.getRegistry().getProviderHealth("openai");
  assert(health.providerId === "openai", "Health status providerId mismatch.");
  assert(health.healthy === true, "OpenAI should start healthy.");
  assert(health.consecutiveFails === 0, "Consecutive fails should be 0.");
  console.log("4. Provider health status... ✓");

  // ── 5. Provider capabilities query ───────────────────────────────────────
  const caps = engine.getRegistry().getCapabilities("openai");
  assert(caps !== undefined, "OpenAI capabilities should be defined.");
  assert(caps!.supportsStreaming === true, "OpenAI should support streaming.");
  assert(caps!.supportsTools === true, "OpenAI should support tools.");
  assert(caps!.availableModels.includes("gpt-4o"), "gpt-4o should be in OpenAI models.");
  console.log("5. Provider capabilities query... ✓");

  // ── 6. Request routing — default strategy ─────────────────────────────────
  const routeReq = { requestId: nextReqId(), providerId: "openai", model: "gpt-4o", prompt: "Hello world", stream: false };
  const decision = engine.getRouter().route(routeReq);
  assert(decision.selectedProviderId === "openai", "Routing should select specified provider.");
  assert(decision.alternates.length > 0, "There should be alternate providers.");
  console.log("6. Request routing — default strategy... ✓");

  // ── 7. Request routing — fallback chain ───────────────────────────────────
  const fallback = engine.getRouter().applyFallback("openai", routeReq);
  assert(fallback !== undefined, "Fallback provider should be found.");
  assert(fallback !== "openai", "Fallback should be a different provider.");
  console.log("7. Request routing — fallback chain... ✓");

  // ── 8. OpenAI adapter execution ───────────────────────────────────────────
  const req8 = { requestId: nextReqId(), providerId: "openai", model: "gpt-4o", prompt: "Describe the Shaily Studio AI OS.", stream: false };
  const resp8 = await engine.execute(req8);
  assert(resp8.requestId === req8.requestId, "Response requestId mismatch.");
  assert(resp8.providerId === "openai", "Response provider mismatch.");
  assert(resp8.content.length > 0, "Response content should not be empty.");
  assert(resp8.totalTokens > 0, "Total tokens should be positive.");
  console.log("8. OpenAI adapter execution... ✓");

  // ── 9. Gemini adapter execution ───────────────────────────────────────────
  const req9 = { requestId: nextReqId(), providerId: "gemini", model: "gemini-2.0-flash", prompt: "What is a Knowledge Graph?", stream: false };
  const resp9 = await engine.execute(req9);
  assert(resp9.providerId === "gemini", "Response provider should be gemini.");
  assert(resp9.content.includes("GEMINI"), "Gemini response should contain adapter tag.");
  console.log("9. Gemini adapter execution... ✓");

  // ── 10. OpenRouter adapter execution ──────────────────────────────────────
  const req10 = { requestId: nextReqId(), providerId: "openrouter", model: "anthropic/claude-3.5-sonnet", prompt: "Summarize the news.", stream: false };
  const resp10 = await engine.execute(req10);
  assert(resp10.providerId === "openrouter", "Response provider should be openrouter.");
  console.log("10. OpenRouter adapter execution... ✓");

  // ── 11. HuggingFace adapter execution ─────────────────────────────────────
  const req11 = { requestId: nextReqId(), providerId: "huggingface", model: "mistralai/Mistral-7B-Instruct-v0.3", prompt: "Classify this text.", stream: false };
  const resp11 = await engine.execute(req11);
  assert(resp11.providerId === "huggingface", "Response provider should be huggingface.");
  console.log("11. HuggingFace adapter execution... ✓");

  // ── 12. Ollama adapter execution ──────────────────────────────────────────
  const req12 = { requestId: nextReqId(), providerId: "ollama", model: "llama3.2", prompt: "Explain quantum computing.", stream: false };
  const resp12 = await engine.execute(req12);
  assert(resp12.providerId === "ollama", "Response provider should be ollama.");
  console.log("12. Ollama adapter execution... ✓");

  // ── 13. Tavily adapter execution ──────────────────────────────────────────
  const req13 = { requestId: nextReqId(), providerId: "tavily", model: "tavily-search-basic", prompt: "Latest AI news", stream: false };
  const resp13 = await engine.execute(req13);
  assert(resp13.providerId === "tavily", "Response provider should be tavily.");
  console.log("13. Tavily adapter execution... ✓");

  // ── 14. Authentication credential loading and masking ─────────────────────
  engine.getAuthManager().injectSecret("openai", "sk-test-12345678abcdefgh");
  const cred = engine.getAuthManager().loadCredentials("openai");
  assert(cred !== undefined, "Credential should be stored.");
  assert(cred!.apiKey === "sk-test-12345678abcdefgh", "API key should match.");

  const validation = engine.getAuthManager().validateCredential(cred!);
  assert(validation.valid === true, "Credential should be valid.");
  assert(validation.maskedKey !== undefined, "Masked key should be returned.");
  assert(!validation.maskedKey!.includes("12345678"), "Middle portion should be masked.");
  console.log("14. Authentication credential loading and masking... ✓");

  // ── 15. Retry engine — exponential backoff ────────────────────────────────
  const retry = engine.getRetryEngine();
  const delay1 = retry.applyBackoff(1);
  const delay2 = retry.applyBackoff(2);
  const delay3 = retry.applyBackoff(3);
  assert(delay1 === 1000,  `Backoff at attempt 1 should be 1000ms, got ${delay1}.`);
  assert(delay2 === 2000,  `Backoff at attempt 2 should be 2000ms, got ${delay2}.`);
  assert(delay3 === 4000,  `Backoff at attempt 3 should be 4000ms, got ${delay3}.`);

  // Verify max cap at 60 seconds
  const delayMax = retry.applyBackoff(20);
  assert(delayMax === 60_000, `Max backoff should be 60000ms, got ${delayMax}.`);
  console.log("15. Retry engine — exponential backoff... ✓");

  // ── 16. Circuit breaker — open on threshold ───────────────────────────────
  retry.openCircuit("huggingface");
  const circuit = retry.getCircuitStatus("huggingface");
  assert(circuit.state === CircuitBreakerState.OPEN, "Circuit should be OPEN after openCircuit().");
  assert(circuit.failures >= engine.getSnapshot().configuration.circuitBreakerThreshold,
    "Failures should meet threshold.");

  // Verify requests to that provider are blocked
  try {
    const blockedEngine = new GatewayBuilder().withContext(mockContext).build();
    await blockedEngine.initialize();
    blockedEngine.getRetryEngine().openCircuit("openai");
    await blockedEngine.execute({ requestId: nextReqId(), providerId: "openai", model: "gpt-4o", prompt: "Test", stream: false });
    assert(false, "Should throw CircuitOpenException.");
  } catch (err: any) {
    assert(err instanceof CircuitOpenException, "Expected CircuitOpenException.");
  }
  console.log("16. Circuit breaker — open on threshold... ✓");

  // ── 17. Usage monitor — token and cost tracking ───────────────────────────
  const usage = engine.getUsageMonitor();
  const allRecords = usage.getTotalUsage();
  assert(allRecords.length > 0, "Usage records should be populated from previous executions.");
  const totalCost = usage.getTotalCostUsd();
  assert(totalCost >= 0, "Total cost should be non-negative.");
  console.log("17. Usage monitor — token and cost tracking... ✓");

  // ── 18. Daily quota enforcement ───────────────────────────────────────────
  const quota = usage.checkDailyQuota("openai");
  assert(quota.providerId === "openai", "Quota providerId mismatch.");
  assert(quota.requestLimit === 1_000, "Quota request limit mismatch.");
  assert(quota.tokenLimit === 1_000_000, "Quota token limit mismatch.");
  assert(quota.requestCount >= 0, "Request count should be non-negative.");

  const rateLimit = usage.checkRateLimit("openai");
  assert(rateLimit.requestsPerMinute === 60, "Rate limit RPM mismatch.");
  assert(rateLimit.remaining >= 0, "Remaining rate limit should be non-negative.");
  console.log("18. Daily quota enforcement... ✓");

  // ── 19. Snapshot immutability ─────────────────────────────────────────────
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "Snapshot should be frozen.");
  assert(Object.isFrozen(snap.configuration), "Snapshot configuration should be frozen.");
  assert(snap.state === GatewayState.RUNNING, "Snapshot state should be RUNNING.");
  console.log("19. Snapshot immutability... ✓");

  // ── 20. Complete end-to-end gateway pipeline ──────────────────────────────
  const e2eEngine = new GatewayBuilder().withContext(mockContext).build();
  await e2eEngine.initialize();

  // Register credential
  e2eEngine.getAuthManager().injectSecret("gemini", "gemini-api-key-test-9999");

  // Full request → route → execute → usage → report
  const e2eReq = { requestId: nextReqId(), providerId: "gemini", model: "gemini-2.0-flash", prompt: "End-to-end test: what is generative AI?", stream: false };
  const e2eResp = await e2eEngine.execute(e2eReq);
  assert(e2eResp.requestId === e2eReq.requestId, "E2E response requestId mismatch.");
  assert(e2eResp.totalTokens > 0, "E2E total tokens should be positive.");
  assert(e2eResp.costUsd >= 0, "E2E cost should be non-negative.");

  // Generate report
  const report = await e2eEngine.getReporter().generateReport();
  assert(report.totalRequests >= 1, "E2E report should have at least 1 request.");
  assert(report.totalCostUsd >= 0, "E2E report cost should be non-negative.");

  // Streaming
  const streamReq = { requestId: nextReqId(), providerId: "gemini", model: "gemini-2.0-flash", prompt: "Stream this.", stream: true };
  const chunks: string[] = [];
  for await (const chunk of e2eEngine.stream(streamReq)) {
    chunks.push(chunk.delta);
    if (chunk.done) break;
  }
  assert(chunks.length > 0, "Streaming should yield at least one chunk.");

  await e2eEngine.stop();
  assert(e2eEngine.getState() === GatewayState.STOPPED, "E2E engine should be STOPPED.");

  console.log("20. Complete end-to-end gateway pipeline... ✓\n");
  console.log("=== ALL 20/20 AI PROVIDER GATEWAY TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite threw an exception:", err);
  process.exit(1);
});
