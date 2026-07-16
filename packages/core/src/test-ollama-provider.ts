import { OllamaProvider } from "@shaily/provider-ollama";
import { OllamaBuilder } from "@shaily/provider-ollama";
import { IProviderTransport, ProviderContext, ProviderState } from "@shaily/core";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class MockOllamaTransport implements IProviderTransport {
  public readonly baseUrl = "http://localhost:11434";

  public async execute(request: any): Promise<any> {
    if (request.url.includes("/api/embeddings")) {
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: {
          embedding: [0.9, 0.8, 0.7],
        },
        latency: 10,
      };
    }

    return {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        model: "llama3",
        message: { role: "assistant", content: "Hello from mock Ollama provider" },
        done: true,
        prompt_eval_count: 5,
        eval_count: 15,
      },
      latency: 60,
    };
  }

  public async *stream(request: any): AsyncGenerator<any> {
    if (request.url.includes("/api/pull")) {
      yield {
        status: 200,
        statusText: "OK",
        headers: {},
        body: { status: "downloading", completed: 100, total: 1000 },
        latency: 10,
      };
      yield {
        status: 200,
        statusText: "OK",
        headers: {},
        body: { status: "success" },
        latency: 20,
      };
      return;
    }

    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        message: { content: "Hello" },
        done: false,
      },
      latency: 10,
    };
    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        message: { content: " Ollama" },
        done: true,
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
  console.log("=== START OLLAMA PROVIDER TESTS ===");

  const context: ProviderContext = { env: "test", namespace: "default", metadata: {} };
  const config = { baseUrl: "http://localhost:11434", models: [], settings: {} };
  const transport = new MockOllamaTransport();

  const provider = new OllamaBuilder()
    .withId("ollama-test-provider")
    .withName("Ollama Test Provider")
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
    model: "llama3",
    messages: [{ role: "user", content: "hello" }],
  });

  assert(executeResult.content === "Hello from mock Ollama provider", "completions content mismatch");
  assert(executeResult.usage?.promptTokens === 5, "prompt tokens count mismatch");

  // Test Execute Embeddings
  console.log("Testing execute embeddings...");
  const embeddingResult = await provider.execute({
    model: "nomic-embed-text",
    prompt: "embed this",
  });

  const embeddingValues = JSON.parse(embeddingResult.content || "[]");
  assert(Array.isArray(embeddingValues) && embeddingValues.length === 3, "embeddings format mismatch");
  assert(embeddingValues[0] === 0.9, "embedding values mismatch");

  // Test Stream Chat
  console.log("Testing stream chat completions...");
  const streamGen = provider.stream({
    model: "llama3",
    messages: [{ role: "user", content: "hello" }],
  });

  let fullText = "";
  for await (const chunk of streamGen) {
    fullText += chunk.content;
  }
  assert(fullText === "Hello Ollama", "streaming content mismatch");

  // Test Model Pulling
  console.log("Testing model pulling progress stream...");
  const pullGen = provider.pullModel("llama3");
  const statuses: string[] = [];
  for await (const progress of pullGen) {
    statuses.push(progress.status);
  }
  assert(statuses.length === 2, "Should yield 2 progress status updates");
  assert(statuses[0] === "downloading" && statuses[1] === "success", "pull status mismatch");

  console.log("=== ALL OLLAMA PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
