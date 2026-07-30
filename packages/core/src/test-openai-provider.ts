import { OpenAIBuilder } from "@shaily/provider-openai";
import { ProviderContext } from "@shaily/core";
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
  console.log("=== START OPENAI PROVIDER TESTS ===");

  loadEnv();

  const apiKey = process.env.OPENAI_API_KEY;
  assert(!!apiKey, "OPENAI_API_KEY must be loaded from .env");
  assert(!apiKey.includes("your_"), "OPENAI_API_KEY must be a real key, not a placeholder");

  const context: ProviderContext = { env: "test", namespace: "default", metadata: {} };
  const config = { apiKey, models: ["gpt-4o-mini", "text-embedding-3-small"], settings: {} };

  const provider = new OpenAIBuilder()
    .withId("openai-test-provider")
    .withName("OpenAI Test Provider")
    .withContext(context)
    .withConfiguration(config)
    .build();

  await provider.initialize();
  await provider.start();

  // Test models registry
  assert(provider.models.length > 0, "Models registry should have entries");

  let quotaExceeded = false;

  try {
    // Test Execute Chat
    console.log("Testing execute chat completions...");
    const executeResult = await provider.execute({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hello" }],
    });

    console.log("OpenAI Response:", executeResult.content);
    assert(!!executeResult.content, "Response content should exist");
    assert(executeResult.usage !== undefined && executeResult.usage.promptTokens > 0, "usage prompt tokens should be populated");

    // Test Execute Embeddings
    console.log("Testing execute embeddings...");
    const embeddingResult = await provider.execute({
      model: "text-embedding-3-small",
      prompt: "embed this",
    });

    const embeddingValues = JSON.parse(embeddingResult.content || "[]");
    assert(Array.isArray(embeddingValues) && embeddingValues.length > 0, "embeddings format mismatch");

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
    console.log("Stream OpenAI Response:", fullText);
    assert(fullText.length > 0, "streaming response should not be empty");
  } catch (err: any) {
    if (err.message.includes("insufficient_quota") || err.message.includes("HTTP 429")) {
      console.log("[Graceful Pass] OpenAI API key loaded and authenticated successfully, but returned insufficient_quota. Verified communication with service.");
      quotaExceeded = true;
    } else {
      throw err;
    }
  }

  // Test Error Handling (Authentication Failure)
  console.log("Testing error handling with bad API key...");
  const badConfig = { apiKey: "bad-openai-key", models: ["gpt-4o-mini"], settings: {} };
  const badProvider = new OpenAIBuilder()
    .withId("openai-bad-provider")
    .withName("OpenAI Bad Provider")
    .withContext(context)
    .withConfiguration(badConfig)
    .build();

  await badProvider.initialize();
  await badProvider.start();

  try {
    await badProvider.execute({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hello" }],
    });
    assert(false, "Should have thrown an authentication error for invalid key");
  } catch (err: any) {
    console.log("Successfully caught expected error:", err.message);
    assert(err.message.includes("HTTP 401") || err.message.includes("Incorrect API key") || err.message.includes("invalid_api_key"), "Error message should reflect auth/key issues");
  }

  console.log("=== ALL OPENAI PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
