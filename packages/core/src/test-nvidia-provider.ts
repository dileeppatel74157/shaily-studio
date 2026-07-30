import { NvidiaBuilder } from "@shaily/provider-nvidia";
import { ProviderContext, TransportBuilder } from "@shaily/core";
import { ProviderState } from "./providers/ProviderState";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        let val = trimmed.substring(index + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=== START NVIDIA PROVIDER TESTS ===");

  loadEnv();

  const apiKey = process.env.NVIDIA_API_KEY;
  assert(!!apiKey, "NVIDIA_API_KEY must be loaded from .env");
  assert(!apiKey.includes("your_"), "NVIDIA_API_KEY must be a real key, not a placeholder");

  const context: ProviderContext = {
    env: "test",
    namespace: "default",
    metadata: {},
  };

  const config = {
    apiKey: process.env.NVIDIA_API_KEY,
    models: [
      "meta/llama-3.1-70b-instruct",
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
    model: "meta/llama-3.1-70b-instruct",
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
    model: "meta/llama-3.1-70b-instruct",
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

  // Test Error Handling (Authentication Failure)
  console.log("Testing error handling with bad API key...");
  const badTransport = new TransportBuilder()
    .withId("nvidia-bad-transport")
    .withBaseUrl("https://integrate.api.nvidia.com/v1")
    .withHeader("Authorization", "Bearer bad-nvidia-key")
    .withHeader("Content-Type", "application/json")
    .withContext({ logger: console, metadata: {} })
    .build();

  const badProvider = new NvidiaBuilder()
    .withId("nvidia-bad-provider")
    .withName("Nvidia Bad Provider")
    .withContext(context)
    .withConfiguration({ apiKey: "bad-nvidia-key", models: ["meta/llama-3.1-70b-instruct"], settings: {} })
    .withTransport(badTransport)
    .build();

  await badProvider.initialize();
  await badProvider.start();

  try {
    await badProvider.execute({
      model: "meta/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: "hello" }],
    });
    assert(false, "Should have thrown an authentication error for invalid key");
  } catch (err: any) {
    console.log("Successfully caught expected error:", err.message);
    assert(err.message.includes("HTTP 401") || err.message.includes("Unauthorized") || err.message.includes("invalid"), "Error message should reflect auth issues");
  }

  console.log(
    "=== ALL NVIDIA PROVIDER TESTS PASSED SUCCESSFULLY ==="
  );
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});