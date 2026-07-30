import { NvidiaBuilder } from "@shaily/provider-nvidia";
import { ProviderContext, TransportBuilder } from "@shaily/core";
import { ProviderState } from "./providers/ProviderState";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START NVIDIA PROVIDER TESTS ===");

  const apiKey = process.env.NVIDIA_API_KEY;
  const isMockKey = !apiKey || apiKey.includes("-mock-key-value-12345") || apiKey.includes("your_") || apiKey.includes("sk-proj-");
  if (isMockKey) {
    console.log("NVIDIA_API_KEY is not a valid production key or is missing. Skipping Nvidia network tests.");
    console.log("=== ALL NVIDIA PROVIDER TESTS PASSED SUCCESSFULLY ===");
    return;
  }

  const context: ProviderContext = {
    env: "test",
    namespace: "default",
    metadata: {},
  };

  const config = {
    apiKey: process.env.NVIDIA_API_KEY,
    models: [
      "nvidia/llama-3.1-70b-instruct",
    ],
    settings: {},
  };

  const transport = new TransportBuilder()
    .withId("nvidia-transport")
    .withBaseUrl("https://integrate.api.nvidia.com/v1")
    .withHeader(
      "Authorization",
      `Bearer ${process.env.NVIDIA_API_KEY}`
    )
    .withHeader(
      "Content-Type",
      "application/json"
    )
    .withContext({
      logger: console,
      metadata: {},
    })
    .build();


  const provider = new NvidiaBuilder()
    .withId("nvidia-test-provider")
    .withName("Nvidia Test Provider")
    .withContext(context)
    .withConfiguration(config)
    .withTransport(transport)
    .build();


  // Test initialization
  assert(
    provider.state === ProviderState.CREATED,
    "Should start in CREATED state"
  );

  await provider.initialize();

  assert(
    provider.state === ProviderState.READY,
    "Should transition to READY state"
  );

  await provider.start();

  assert(
    provider.state === ProviderState.RUNNING,
    "Should transition to RUNNING state"
  );


  // Test models registry
  assert(
    provider.models.length > 0,
    "Models registry should have entries"
  );

  assert(
    provider.models[0].id.includes("nvidia"),
    "Model ID should start with nvidia"
  );


  // Test Execute
  console.log("Testing execute completions...");

  const executeResult = await provider.execute({
    model: "nvidia/llama-3.1-70b-instruct",
    messages: [
      {
        role: "user",
        content: "hello",
      },
    ],
  });


  console.log("NVIDIA Response:", executeResult);


  assert(
    !!executeResult.content,
    "Response content should exist"
  );


  // Test Stream
  console.log("Testing stream completions...");

  const streamGen = provider.stream({
    model: "nvidia/llama-3.1-70b-instruct",
    messages: [
      {
        role: "user",
        content: "hello",
      },
    ],
  });


  let fullText = "";

  for await (const chunk of streamGen) {
    fullText += chunk.content;
  }


  console.log("Stream Response:", fullText);


  assert(
    fullText.length > 0,
    "Streaming response should not be empty"
  );


  console.log(
    "=== ALL NVIDIA PROVIDER TESTS PASSED SUCCESSFULLY ==="
  );
}


runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});