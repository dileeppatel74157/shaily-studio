import { GeminiImageProvider, GeminiImageBuilder } from "@shaily/provider-google";
import { ProviderContext, IProviderTransport, ProviderResponse } from "@shaily/core";
import { StorageBuilder } from "./storage/StorageBuilder";
import { GatewayEngine } from "./ai-gateway/GatewayEngine";
import { GatewayRequest } from "./ai-gateway/models";
import * as assert from "assert";

class MockTransport implements IProviderTransport {
  public readonly id = "mock-transport";
  public readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  public lastRequest: any;
  public responseBody: any = {
    predictions: [
      {
        bytesBase64Encoded: Buffer.from("fake-image-bytes-base64").toString("base64"),
        mimeType: "image/png"
      }
    ]
  };

  public async execute(request: any): Promise<any> {
    this.lastRequest = request;
    return {
      body: this.responseBody,
      latency: 120
    };
  }

  public async *stream(request: any): AsyncGenerator<any> {
    yield { body: {} };
  }
}

async function runTests() {
  console.log("=== START GEMINI IMAGE GENERATION PROVIDER TESTS ===");

  const storage = new StorageBuilder()
    .withContext({ env: "test", namespace: "test-images" })
    .build();

  await storage.initialize();
  await storage.start();

  const context: ProviderContext = {
    env: "test",
    namespace: "default",
    metadata: {},
    storage
  } as any;

  const config = {
    apiKey: "AIzaSyFakeKey12345",
    settings: {}
  };

  // 1. Builder and Provider Verification
  console.log("Testing provider instantiation and execution...");
  const transport = new MockTransport();
  const provider = new GeminiImageBuilder()
    .withId("gemini-image-test")
    .withName("Google Gemini Image Test")
    .withContext(context)
    .withConfiguration(config)
    .withTransport(transport)
    .build();

  await provider.initialize();
  await provider.start();

  assert.strictEqual(provider.id, "gemini-image-test");
  assert.strictEqual(provider.capabilities.length, 1);
  assert.strictEqual(provider.capabilities[0], "Images");

  // 2. Request Formatting & Image Generation API parameters mapping
  const response = await provider.execute({
    model: "gemini-2.5-flash-image-preview",
    prompt: "a majestic golden retriever running in a park",
    negativePrompt: "extra legs, blurry",
    width: 1024,
    height: 1024,
    numberOfImages: 1,
    seed: 42,
    mimeType: "image/jpeg"
  } as any);

  assert.ok(transport.lastRequest, "Transport execute should have been called");
  const requestBody = transport.lastRequest.body;
  assert.strictEqual(requestBody.instances[0].prompt, "a majestic golden retriever running in a park");
  assert.strictEqual(requestBody.parameters.sampleCount, 1);
  assert.strictEqual(requestBody.parameters.aspectRatio, "1:1");
  assert.strictEqual(requestBody.parameters.negativePrompt, "extra legs, blurry");
  assert.strictEqual(requestBody.parameters.outputMimeType, "image/jpeg");
  assert.strictEqual(requestBody.parameters.seed, 42);

  // 3. Storage Integration verification
  console.log("Testing storage integration and saved metadata...");
  assert.ok(response.content.startsWith("images/image-"), "Response content should contain the stored image path");
  assert.strictEqual(response.storedImagePath, response.content);
  assert.strictEqual(response.storageBucket, "images");
  assert.strictEqual(response.mimeType, "image/jpeg");

  // Check if object exists in storage
  const objectId = response.storedImagePath.split("/")[1];
  const storedObject = storage.getObject("images", objectId);
  assert.ok(storedObject, "Object should be saved in the storage provider");
  assert.strictEqual(storedObject!.metadata.contentType, "image/jpeg");

  // 4. AI Gateway Integration verification
  console.log("Testing AI Gateway discovery and capability routing...");
  const gateway = new GatewayEngine({
    logger: {
      warn: () => {},
      info: () => {},
      error: () => {}
    },
    eventBus: { publish: async () => {} },
    resolve: (name: string) => {
      if (name === "IStorage") return storage;
      return null;
    }
  }, {
    environment: "test",
    defaultTimeoutMs: 5000,
    maxRetries: 1,
    routingStrategy: "PRIORITY" as any,
    retryPolicy: "LINEAR" as any,
    circuitBreakerThreshold: 3,
    enableCostTracking: true,
    enableUsageMonitor: true
  });

  await gateway.initialize();

  const registry = gateway.getRegistry();
  const allProviders = registry.discoverProviders();
  const geminiImageEntry = allProviders.find(p => p.providerId === "gemini-image");

  assert.ok(geminiImageEntry, "gemini-image should be registered in the gateway");
  assert.strictEqual(geminiImageEntry!.capabilities.supportsImages, true);
  assert.strictEqual(geminiImageEntry!.capabilities.supportsChat, false);
  assert.strictEqual(geminiImageEntry!.capabilities.supportsEmbeddings, false);

  // Set mock adapters in gateway
  (gateway as any)._adapters.set("gemini-image", {
    connect: async () => {},
    execute: async (req: any) => {
      return {
        requestId: req.requestId,
        providerId: "gemini-image",
        model: req.model,
        content: "images/fake-path.png",
        storedImagePath: "images/fake-path.png",
        storageBucket: "images",
        mimeType: "image/png",
        width: 1024,
        height: 1024,
        metadata: { seed: 42 }
      };
    }
  });

  const routeDecision = gateway.getRouter().route({
    requestId: "req-img-1",
    model: "gemini-2.5-flash-image-preview",
    prompt: "cat on a mat",
    requestType: "image",
    stream: false
  });

  assert.strictEqual(routeDecision.selectedProviderId, "gemini-image", "Gateway should route image request to gemini-image");
  assert.ok(routeDecision.alternates.includes("nvidia-image"), "Nvidia image should be a fallback");
  assert.ok(routeDecision.alternates.includes("openai-image"), "OpenAI image should be a fallback");

  // 5. Fallback Compatibility verification
  console.log("Testing fallback compatibility for image providers...");
  // Simulate gemini-image failing, falling back to nvidia-image
  (gateway as any)._adapters.set("gemini-image", {
    connect: async () => {},
    execute: async () => {
      throw new Error("Gemini Image generation failed (e.g. Rate Limit)");
    }
  });

  (gateway as any)._adapters.set("nvidia-image", {
    connect: async () => {},
    execute: async (req: any) => {
      return {
        requestId: req.requestId,
        providerId: "nvidia-image",
        model: req.model,
        content: "images/nvidia-fallback.png",
        storedImagePath: "images/nvidia-fallback.png",
        storageBucket: "images",
        mimeType: "image/png",
        width: 1024,
        height: 1024,
        metadata: { fallback: true }
      };
    }
  });

  const gatewayResponse = await gateway.execute({
    requestId: "req-img-2",
    model: "gemini-2.5-flash-image-preview",
    prompt: "scenic mountain",
    requestType: "image",
    stream: false
  });

  assert.strictEqual(gatewayResponse.providerId, "nvidia-image", "Should fallback to nvidia-image");
  assert.strictEqual(gatewayResponse.content, "images/nvidia-fallback.png");

  console.log("=== ALL GEMINI IMAGE GENERATION PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
