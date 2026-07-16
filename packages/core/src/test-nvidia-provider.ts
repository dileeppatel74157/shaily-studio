import { NvidiaProvider } from "@shaily/provider-nvidia";
import { NvidiaBuilder } from "@shaily/provider-nvidia";
import { IProviderTransport, ProviderContext } from "@shaily/core";
import { ProviderState } from "./providers/ProviderState";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class MockNvidiaTransport implements IProviderTransport {
  public readonly baseUrl = "https://integrate.api.nvidia.com/v1";

  public async execute(request: any): Promise<any> {
    return {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        id: "nvidia-resp-123",
        choices: [
          {
            message: { content: "Hello from mock NVIDIA provider" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
      latency: 100,
    };
  }

  public async *stream(request: any): AsyncGenerator<any> {
    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        id: "nvidia-chunk-1",
        choices: [{ delta: { content: "Hello" }, finish_reason: null }],
      },
      latency: 10,
    };
    yield {
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        id: "nvidia-chunk-2",
        choices: [{ delta: { content: " NVIDIA" }, finish_reason: "stop" }],
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
  console.log("=== START NVIDIA PROVIDER TESTS ===");

  const context: ProviderContext = { env: "test", namespace: "default", metadata: {} };
  const config = { apiKey: "mock-nvidia-key", models: [], settings: {} };
  const transport = new MockNvidiaTransport();

  const provider = new NvidiaBuilder()
    .withId("nvidia-test-provider")
    .withName("Nvidia Test Provider")
    .withContext(context)
    .withConfiguration(config)
    .withTransport(transport)
    .build();

  // Test initialization
  assert(provider.state === ProviderState.CREATED, "Should start in CREATED state");
  await provider.initialize();
  assert(provider.state === ProviderState.READY, "Should transition to READY state");
  await provider.start();
  assert(provider.state === ProviderState.RUNNING, "Should transition to RUNNING state");

  // Test models registry
  assert(provider.models.length > 0, "Models registry should have entries");
  assert(provider.models[0].id.includes("nvidia"), "Model ID should start with nvidia");

  // Test Execute
  console.log("Testing execute completions...");
  const executeResult = await provider.execute({
    model: "nvidia/llama-3.1-70b-instruct",
    messages: [{ role: "user", content: "hello" }],
  });

  assert(executeResult.content === "Hello from mock NVIDIA provider", "completions content mismatch");
  assert(executeResult.usage?.promptTokens === 10, "prompt tokens count mismatch");

  // Test Stream
  console.log("Testing stream completions...");
  const streamGen = provider.stream({
    model: "nvidia/llama-3.1-70b-instruct",
    messages: [{ role: "user", content: "hello" }],
  });

  let fullText = "";
  for await (const chunk of streamGen) {
    fullText += chunk.content;
  }
  assert(fullText === "Hello NVIDIA", "streaming content mismatch");

  console.log("=== ALL NVIDIA PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
