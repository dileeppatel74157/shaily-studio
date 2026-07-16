import { GeminiProvider } from "@shaily/provider-google";
import { GeminiBuilder } from "@shaily/provider-google";
import { IProviderTransport, ProviderContext, ProviderState } from "@shaily/core";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class MockGeminiTransport implements IProviderTransport {
  public readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  public async execute(request: any): Promise<any> {
    if (request.url.includes(":embedContent")) {
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: {
          embedding: { values: [0.5, 0.6, 0.7] },
        },
        latency: 40,
      };
    }

    return {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        candidates: [
          {
            content: {
              parts: [{ text: "Hello from mock Gemini provider" }],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 22, totalTokenCount: 34 },
      },
      latency: 90,
    };
  }

  public async *stream(request: any): AsyncGenerator<any> {
    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        candidates: [{ content: { parts: [{ text: "Hello" }] }, finishReason: null }],
      },
      latency: 10,
    };
    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        candidates: [{ content: { parts: [{ text: " Gemini" }] }, finishReason: "STOP" }],
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
  console.log("=== START GEMINI PROVIDER TESTS ===");

  const context: ProviderContext = { env: "test", namespace: "default", metadata: {} };
  const config = { apiKey: "mock-gemini-key", models: [], settings: {} };
  const transport = new MockGeminiTransport();

  const provider = new GeminiBuilder()
    .withId("google-test-provider")
    .withName("Google Gemini Test Provider")
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
    model: "gemini-1.5-flash",
    messages: [{ role: "user", content: "hello" }],
  });

  assert(executeResult.content === "Hello from mock Gemini provider", "completions content mismatch");
  assert(executeResult.usage?.promptTokens === 12, "prompt tokens count mismatch");

  // Test Execute Embeddings
  console.log("Testing execute embeddings...");
  const embeddingResult = await provider.execute({
    model: "text-embedding-004",
    prompt: "embed this",
  });

  const embeddingValues = JSON.parse(embeddingResult.content || "[]");
  assert(Array.isArray(embeddingValues) && embeddingValues.length === 3, "embeddings format mismatch");
  assert(embeddingValues[0] === 0.5, "embedding values mismatch");

  // Test Stream Chat
  console.log("Testing stream chat completions...");
  const streamGen = provider.stream({
    model: "gemini-1.5-flash",
    messages: [{ role: "user", content: "hello" }],
  });

  let fullText = "";
  for await (const chunk of streamGen) {
    fullText += chunk.content;
  }
  assert(fullText === "Hello Gemini", "streaming content mismatch");

  console.log("=== ALL GEMINI PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
