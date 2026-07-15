import { ProviderBuilder } from "./providers/ProviderBuilder";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import { ProviderType } from "./providers/ProviderType";
import { ProviderFeature } from "./providers/ProviderFeature";
import { ProviderState } from "./providers/ProviderState";
import { ProviderHealth } from "./providers/ProviderHealth";
import { ProviderRequest } from "./providers/ProviderRequest";
import { ProviderResponse } from "./providers/ProviderResponse";
import { ProviderValidator } from "./providers/ProviderValidator";
import {
  ProviderValidationException,
  InvalidProviderStateException,
} from "./providers/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START PROVIDER FRAMEWORK TESTS ===");

  const context = {
    env: "test",
    namespace: "shaily.providers",
    metadata: {},
  };

  const configuration = {
    models: ["gpt-4", "gpt-3.5-turbo"],
    settings: {},
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Running Builder Validation...");
  try {
    new ProviderBuilder().build();
    throw new Error("Should have failed for missing properties");
  } catch (err: unknown) {
    assert(
      err instanceof ProviderValidationException,
      "Expected ProviderValidationException for missing builder configurations"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Builder Validation.");

  // ==========================================
  // 2. Provider Registration
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n2. Running Provider Registration...");
  const registry = new ProviderRegistry();
  const provider = new ProviderBuilder()
    .withId("test-openai")
    .withName("OpenAI Test Provider")
    .withType(ProviderType.CHAT)
    .withCapabilities([ProviderFeature.Streaming, ProviderFeature.Tools])
    .withContext(context)
    .withConfiguration(configuration)
    .withMetadata({ tier: "premium" })
    .build();

  assert(!registry.has(provider.id), "Provider should not be in registry initially");
  registry.register(provider);
  assert(registry.has(provider.id), "Provider registered successfully");
  assert(registry.get(provider.id) === provider, "Getter returns registered provider instance");
  assert(registry.list().length === 1, "Registered list length matches");

  // Default mappings
  registry.setDefault(ProviderType.CHAT, provider.id);
  assert(registry.default(ProviderType.CHAT) === provider, "Default mappings retrieve configured provider");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Provider Registration.");

  // ==========================================
  // 3. Duplicate Detection
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n3. Running Duplicate Detection...");
  try {
    registry.register(provider);
    throw new Error("Should have rejected duplicate registration");
  } catch (err: unknown) {
    assert(
      err instanceof ProviderValidationException,
      "Expected ProviderValidationException for duplicate registration"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Duplicate Detection.");

  // ==========================================
  // 4. Lifecycle Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n4. Running Lifecycle Validation...");
  // Fresh provider to test strictCREATED -> INITIALIZING -> READY -> RUNNING -> STOPPED transitions
  const lifeProvider = new ProviderBuilder()
    .withId("life-provider")
    .withName("Lifecycle Test Provider")
    .withType(ProviderType.EMBEDDING)
    .withCapabilities([ProviderFeature.Embeddings])
    .withContext(context)
    .withConfiguration({ models: ["text-embedding-ada-002"], settings: {} })
    .build();

  // Illegal: start before initialize
  try {
    await lifeProvider.start();
    throw new Error("Should have rejected start before initialize");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidProviderStateException,
      "Expected InvalidProviderStateException for early start"
    );
  }

  await lifeProvider.initialize();
  await lifeProvider.start();

  // Illegal: initialize while running
  try {
    await lifeProvider.initialize();
    throw new Error("Should have rejected initialize while running");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidProviderStateException,
      "Expected InvalidProviderStateException for duplicate initialize"
    );
  }

  await lifeProvider.stop();
  // eslint-disable-next-line no-console
  console.log("✓ Verified Lifecycle Validation.");

  // ==========================================
  // 5. Request Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n5. Running Request Validation (Capabilities check)...");
  await provider.initialize();
  await provider.start();

  const validRequest: ProviderRequest = {
    requestId: "req-1",
    providerId: provider.id,
    model: "gpt-4",
    messages: [{ role: "user", content: "hello" }],
    stream: true, // Supported since provider has Streaming capability
  };

  const invalidRequest: ProviderRequest = {
    requestId: "req-2",
    providerId: provider.id,
    model: "gpt-4",
    messages: [{ role: "user", content: "hello" }],
    stream: true,
  };

  // Build a provider WITHOUT streaming capability
  const nonStreamingProvider = new ProviderBuilder()
    .withId("non-stream")
    .withName("No Stream Provider")
    .withType(ProviderType.CHAT)
    .withCapabilities([ProviderFeature.JSONMode])
    .withContext(context)
    .withConfiguration(configuration)
    .build();

  await nonStreamingProvider.initialize();
  await nonStreamingProvider.start();

  try {
    ProviderValidator.validateRequest(invalidRequest, nonStreamingProvider);
    throw new Error("Should have rejected streaming request for non-streaming provider");
  } catch (err: unknown) {
    assert(
      err instanceof ProviderValidationException,
      "Expected ProviderValidationException for streaming capability mismatch"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Request Validation.");

  // ==========================================
  // 6. Response Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n6. Running Response Validation...");
  const validResponse: ProviderResponse = {
    responseId: "resp-1",
    providerId: provider.id,
    model: "gpt-4",
    content: "response text",
    latency: 120,
  };

  // Validates successfully
  ProviderValidator.validateResponse(validResponse, provider);

  const invalidResponse: ProviderResponse = {
    responseId: "resp-2",
    providerId: provider.id,
    model: "gpt-4",
    content: "response text",
    latency: -5, // Negative latency is invalid
  };

  try {
    ProviderValidator.validateResponse(invalidResponse, provider);
    throw new Error("Should have rejected negative latency response");
  } catch (err: unknown) {
    assert(
      err instanceof ProviderValidationException,
      "Expected ProviderValidationException for negative latency response"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Response Validation.");

  // ==========================================
  // 7. Health Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n7. Running Health Validation...");
  const healthInitial = provider.health();
  assert(healthInitial.status === "HEALTHY", "Initial health is healthy");
  assert(healthInitial.availability === 1, "Initial availability matches");

  // Execute request to update health metrics
  await provider.execute(validRequest);
  const healthAfter = provider.health();
  assert(healthAfter.lastSuccessfulRequest !== null, "Records last success time");
  assert(healthAfter.availability === 1, "Availability remains 100%");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Health Validation.");

  // ==========================================
  // 8. Snapshot Immutability
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n8. Running Snapshot Immutability checks...");
  const snapshot = provider.snapshot();
  try {
    (snapshot as any).lifecycle = ProviderState.STOPPED;
    throw new Error("Should have rejected snapshot lifecycle modification");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on snapshot property mutation");
  }

  try {
    (snapshot.descriptor as any).name = "Hacked Provider Name";
    throw new Error("Should have rejected descriptor mutation");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Expected TypeError on descriptor property mutation");
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Snapshot Immutability.");

  // ==========================================
  // 9. Validator Rules
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("\n9. Running Validator Rules checks...");
  try {
    ProviderValidator.validateIdentifier("invalid provider space id", "Provider ID");
    throw new Error("Should have rejected spaces in provider ID");
  } catch (err: unknown) {
    assert(
      err instanceof ProviderValidationException,
      "Expected ProviderValidationException for spaces in provider ID"
    );
  }

  try {
    ProviderValidator.validateModelName("invalid/model*name", "Model");
    throw new Error("Should have rejected invalid character in model name");
  } catch (err: unknown) {
    assert(
      err instanceof ProviderValidationException,
      "Expected ProviderValidationException for invalid characters in model name"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Validator Rules.");

  // Clean up
  await provider.stop();
  await nonStreamingProvider.stop();

  // eslint-disable-next-line no-console
  console.log("\n=== ALL PROVIDER FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
