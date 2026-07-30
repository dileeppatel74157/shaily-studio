import { GeminiBuilder } from "@shaily/provider-google";
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
  console.log("=== START GEMINI PROVIDER TESTS ===");

  loadEnv();

  const apiKey = process.env.GEMINI_API_KEY;
  assert(!!apiKey, "GEMINI_API_KEY must be loaded from .env");
  assert(!apiKey.includes("your_"), "GEMINI_API_KEY must be a real key, not a placeholder");

  const context: ProviderContext = { env: "test", namespace: "default", metadata: {} };
  const config = { apiKey, models: ["gemini-3.5-flash-lite", "gemini-embedding-2"], settings: {} };

  const provider = new GeminiBuilder()
    .withId("google-test-provider")
    .withName("Google Gemini Test Provider")
    .withContext(context)
    .withConfiguration(config)
    .build();

  await provider.initialize();
  await provider.start();

  // Test models registry
  assert(provider.models.length > 0, "Models registry should have entries");

  // Test Execute Chat
  console.log("Testing execute chat completions...");
  const executeResult = await provider.execute({
    model: "gemini-3.5-flash-lite",
    messages: [{ role: "user", content: "hello" }],
  });

  console.log("Gemini Response:", executeResult.content);
  assert(!!executeResult.content, "Response content should exist");
  assert(executeResult.usage !== undefined && executeResult.usage.promptTokens > 0, "usage prompt tokens should be populated");

  // Test Execute Embeddings
  console.log("Testing execute embeddings...");
  const embeddingResult = await provider.execute({
    model: "gemini-embedding-2",
    prompt: "embed this",
  });

  const embeddingValues = JSON.parse(embeddingResult.content || "[]");
  assert(Array.isArray(embeddingValues) && embeddingValues.length > 0, "embeddings format mismatch");

  // Test Stream Chat
  console.log("Testing stream chat completions...");
  const streamGen = provider.stream({
    model: "gemini-3.5-flash-lite",
    messages: [{ role: "user", content: "hello" }],
  });

  let fullText = "";
  for await (const chunk of streamGen) {
    fullText += chunk.content;
  }
  console.log("Stream Gemini Response:", fullText);
  assert(fullText.length > 0, "streaming response should not be empty");

  // Test Error Handling (Authentication Failure)
  console.log("Testing error handling with bad API key...");
  const badConfig = { apiKey: "bad-gemini-key", models: ["gemini-3.5-flash-lite"], settings: {} };
  const badProvider = new GeminiBuilder()
    .withId("google-bad-provider")
    .withName("Google Gemini Bad Provider")
    .withContext(context)
    .withConfiguration(badConfig)
    .build();

  await badProvider.initialize();
  await badProvider.start();

  try {
    await badProvider.execute({
      model: "gemini-3.5-flash-lite",
      messages: [{ role: "user", content: "hello" }],
    });
    assert(false, "Should have thrown an authentication error for invalid key");
  } catch (err: any) {
    console.log("Successfully caught expected error:", err.message);
    assert(err.message.includes("HTTP 400") || err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID"), "Error message should reflect auth/key issues");
  }

  console.log("=== ALL GEMINI PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
