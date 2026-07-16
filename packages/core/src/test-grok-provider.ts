import { GrokProvider } from "@shaily/provider-grok";
import { GrokBuilder } from "@shaily/provider-grok";
import { IProviderTransport, ProviderContext, ProviderState } from "@shaily/core";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class MockGrokTransport implements IProviderTransport {
  public readonly baseUrl = "https://api.x.ai/v1";

  public async execute(request: any): Promise<any> {
    return {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        id: "grok-resp-123",
        choices: [
          {
            message: { content: "Hello from mock Grok provider" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 18, total_tokens: 26 },
      },
      latency: 110,
    };
  }

  public async *stream(request: any): AsyncGenerator<any> {
    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        id: "grok-chunk-1",
        choices: [{ delta: { content: "Hello" }, finish_reason: null }],
      },
      latency: 10,
    };
    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        id: "grok-chunk-2",
        choices: [{ delta: { content: " Grok" }, finish_reason: "stop" }],
      },
      latency: 20,
    };
  }

  public async cancel(requestId: string): Promise<void> {}
  public async health(): Promise<any> {
    return { isHealthy: true, latency: 10 };
  }
  public snapshot(): any {
    return {};
  }
}

async function runTests() {
  console.log("=== START GROK PROVIDER TESTS ===");

  const context: ProviderContext = { env: "test", namespace: "default", metadata: {} };
  const config = { apiKey: "mock-grok-key", models: [], settings: {} };
  const transport = new MockGrokTransport();

  const provider = new GrokBuilder()
    .withId("grok-test-provider")
    .withName("Grok Test Provider")
    .withContext(context)
    .withConfiguration(config)
    .withTransport(transport)
    .build();

  await provider.initialize();
  await provider.start();

  // Test models registry
  assert(provider.models.length > 0, "Models registry should have entries");

  // Test Execute
  console.log("Testing execute completions...");
  const executeResult = await provider.execute({
    model: "grok-2",
    messages: [{ role: "user", content: "hello" }],
  });

  assert(executeResult.content === "Hello from mock Grok provider", "completions content mismatch");
  assert(executeResult.usage?.promptTokens === 8, "prompt tokens count mismatch");

  // Test Stream
  console.log("Testing stream completions...");
  const streamGen = provider.stream({
    model: "grok-2",
    messages: [{ role: "user", content: "hello" }],
  });

  let fullText = "";
  for await (const chunk of streamGen) {
    fullText += chunk.content;
  }
  assert(fullText === "Hello Grok", "streaming content mismatch");

  console.log("=== ALL GROK PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
