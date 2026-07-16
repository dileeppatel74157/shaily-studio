import { OpenAIProvider } from "@shaily/provider-openai";
import { OpenAIBuilder } from "@shaily/provider-openai";
import { IProviderTransport, ProviderContext, ProviderState } from "@shaily/core";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class MockOpenAITransport implements IProviderTransport {
  public readonly baseUrl = "https://api.openai.com/v1";

  public async execute(request: any): Promise<any> {
    if (request.url.includes("/embeddings")) {
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: {
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { total_tokens: 5 },
        },
        latency: 30,
      };
    }

    return {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        id: "openai-resp-123",
        choices: [
          {
            message: { content: "Hello from mock OpenAI provider" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
      },
      latency: 80,
    };
  }

  public async *stream(request: any): AsyncGenerator<any> {
    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        id: "openai-chunk-1",
        choices: [{ delta: { content: "Hello" }, finish_reason: null }],
      },
      latency: 10,
    };
    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        id: "openai-chunk-2",
        choices: [{ delta: { content: " OpenAI" }, finish_reason: "stop" }],
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
  console.log("=== START OPENAI PROVIDER TESTS ===");

  const context: ProviderContext = { env: "test", namespace: "default", metadata: {} };
  const config = { apiKey: "mock-openai-key", models: [], settings: {} };
  const transport = new MockOpenAITransport();

  const provider = new OpenAIBuilder()
    .withId("openai-test-provider")
    .withName("OpenAI Test Provider")
    .withContext(context)
    .withConfiguration(config)
    .withTransport(transport)
    .build();

  await provider.initialize();
  await provider.start();

  // Test models registry
  assert(provider.models.length > 0, "Models registry should have entries");

  // Test Execute Chat
  console.log("Testing execute chat completions...");
  const executeResult = await provider.execute({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "hello" }],
  });

  assert(executeResult.content === "Hello from mock OpenAI provider", "completions content mismatch");
  assert(executeResult.usage?.promptTokens === 15, "prompt tokens count mismatch");

  // Test Execute Embeddings
  console.log("Testing execute embeddings...");
  const embeddingResult = await provider.execute({
    model: "text-embedding-3-small",
    prompt: "embed this",
  });

  const embeddingValues = JSON.parse(embeddingResult.content || "[]");
  assert(Array.isArray(embeddingValues) && embeddingValues.length === 3, "embeddings format mismatch");
  assert(embeddingValues[0] === 0.1, "embedding values mismatch");

  // Test Stream Chat
  console.log("Testing stream chat completions...");
  const streamGen = provider.stream({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "hello" }],
  });

  let fullText = "";
  for await (const chunk of streamGen) {
    fullText += chunk.content;
  }
  assert(fullText === "Hello OpenAI", "streaming content mismatch");

  console.log("=== ALL OPENAI PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
