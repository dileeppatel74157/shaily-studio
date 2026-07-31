import { GeminiVideoProvider, GeminiVideoBuilder } from "@shaily/provider-google";
import { ProviderContext, IProviderTransport, ProviderResponse } from "@shaily/core";
import { StorageBuilder } from "./storage/StorageBuilder";
import { GatewayEngine } from "./ai-gateway/GatewayEngine";
import { GatewayRequest } from "./ai-gateway/models";
import * as assert from "assert";

class MockVideoTransport implements IProviderTransport {
  public readonly id = "mock-video-transport";
  public readonly baseUrl = "https://generativelanguage.googleapis.com";
  public lastRequest: any;
  public lastSubmitRequest: any;
  public submitCount = 0;
  public pollCount = 0;
  public downloadCount = 0;

  // Behavior flags for testing various states
  public pollBehavior: "success" | "pending-once-then-success" | "failed" | "cancelled" | "timeout" = "success";
  public submitBehavior: "success" | "invalid-key" | "rate-limit" = "success";

  public async execute(request: any): Promise<any> {
    this.lastRequest = request;

    // 1. Submission
    if (request.url.includes(":predictLongRunning")) {
      this.lastSubmitRequest = request;
      this.submitCount++;
      if (this.submitBehavior === "invalid-key") {
        return {
          body: {
            error: {
              code: 400,
              message: "API key not valid. Please pass a valid API key.",
              status: "INVALID_ARGUMENT"
            }
          },
          latency: 40
        };
      }
      if (this.submitBehavior === "rate-limit") {
        return {
          body: {
            error: {
              code: 429,
              message: "Resource has been exhausted (e.g. queries per minute limit).",
              status: "RESOURCE_EXHAUSTED"
            }
          },
          latency: 35
        };
      }
      return {
        body: {
          name: "operations/veo-test-op-123"
        },
        latency: 150
      };
    }

    // 2. Polling
    if (request.url.includes("/operations/")) {
      this.pollCount++;
      if (this.pollBehavior === "success") {
        return {
          body: {
            name: "operations/veo-test-op-123",
            done: true,
            response: {
              generatedVideos: [
                {
                  video: {
                    uri: "https://generativelanguage.googleapis.com/v1beta/files/veo-video-file-456"
                  }
                }
              ]
            }
          },
          latency: 80
        };
      }

      if (this.pollBehavior === "pending-once-then-success") {
        if (this.pollCount === 1) {
          return {
            body: {
              name: "operations/veo-test-op-123",
              done: false
            },
            latency: 70
          };
        } else {
          return {
            body: {
              name: "operations/veo-test-op-123",
              done: true,
              response: {
                generatedVideos: [
                  {
                    video: {
                      uri: "https://generativelanguage.googleapis.com/v1beta/files/veo-video-file-456"
                    }
                  }
                ]
              }
            },
            latency: 85
          };
        }
      }

      if (this.pollBehavior === "failed") {
        return {
          body: {
            name: "operations/veo-test-op-123",
            done: true,
            error: {
              code: 500,
              message: "Veo internal renderer failed.",
              status: "INTERNAL"
            }
          },
          latency: 90
        };
      }

      if (this.pollBehavior === "cancelled") {
        return {
          body: {
            name: "operations/veo-test-op-123",
            done: true,
            error: {
              code: 499,
              message: "Operation was cancelled by user.",
              status: "CANCELLED"
            }
          },
          latency: 45
        };
      }
    }

    // 3. Download
    if (request.url.includes("/files/")) {
      this.downloadCount++;
      return {
        body: Buffer.from("mock-binary-mp4-video-bytes-here"),
        latency: 120
      };
    }

    throw new Error(`Unexpected mock transport URL: ${request.url}`);
  }

  public async *stream(request: any): AsyncGenerator<any> {
    yield { body: {} };
  }
}

async function runTests() {
  console.log("=== START GEMINI VEO VIDEO GENERATION PROVIDER TESTS ===");

  const storage = new StorageBuilder()
    .withContext({ env: "test", namespace: "test-videos" })
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
    apiKey: "AIzaSyFakeKeyVeo123",
    settings: {}
  };

  // Helper to reset transport counters
  const resetTransport = (transport: MockVideoTransport) => {
    transport.submitCount = 0;
    transport.pollCount = 0;
    transport.downloadCount = 0;
    transport.pollBehavior = "success";
    transport.submitBehavior = "success";
  };

  // Test 1: Provider Creation and Capabilities Discovery
  console.log("Testing provider instantiation and capability registration...");
  const transport = new MockVideoTransport();
  const provider = new GeminiVideoBuilder()
    .withId("gemini-video-test")
    .withName("Google Gemini Veo Test")
    .withContext(context)
    .withConfiguration(config)
    .withTransport(transport)
    .build();

  await provider.initialize();
  await provider.start();

  assert.strictEqual(provider.id, "gemini-video-test");
  assert.strictEqual(provider.capabilities.length, 1);
  assert.strictEqual(provider.capabilities[0], "Video");

  // Test 2: Submission and Successful Polling/Download/Storage Flow
  console.log("Testing video generation submit, poll, download, and storage flow...");
  resetTransport(transport);
  
  const response = await provider.execute({
    model: "veo-3",
    prompt: "a futuristic city at sunset with flying cars",
    negativePrompt: "low resolution, static",
    duration: 8,
    aspectRatio: "16:9",
    resolution: "1080p",
    seed: 99,
    fps: 30,
    mimeType: "video/mp4"
  } as any);

  assert.strictEqual(transport.submitCount, 1);
  assert.strictEqual(transport.pollCount, 1);
  assert.strictEqual(transport.downloadCount, 1);

  // Validate submitted body parameters
  const submitBody = transport.lastSubmitRequest.body;
  assert.strictEqual(submitBody.instances[0].prompt, "a futuristic city at sunset with flying cars");
  assert.strictEqual(submitBody.parameters.sampleCount, 1);
  assert.strictEqual(submitBody.parameters.durationSeconds, 8);
  assert.strictEqual(submitBody.parameters.aspectRatio, "16:9");
  assert.strictEqual(submitBody.parameters.resolution, "1080p");
  assert.strictEqual(submitBody.parameters.fps, 30);
  assert.strictEqual(submitBody.parameters.seed, 99);
  assert.strictEqual(submitBody.parameters.outputMimeType, "video/mp4");

  // Validate return response properties
  assert.strictEqual(response.providerId, "gemini-video-test");
  assert.strictEqual(response.model, "veo-3");
  assert.strictEqual(response.metadata.operationId, "operations/veo-test-op-123");
  assert.strictEqual(response.metadata.status, "completed");
  assert.strictEqual(response.mimeType, "video/mp4");
  assert.strictEqual(response.duration, 8);
  assert.strictEqual(response.resolution, "1080p");
  assert.ok(response.content.startsWith("videos/video-"), "Should return path under videos bucket");

  // Validate Storage upload
  const videoId = response.storedVideoPath.split("/")[1];
  const storedObj = storage.getObject("videos", videoId);
  assert.ok(storedObj, "Video object must be stored in IStorage videos bucket");
  assert.strictEqual(storedObj!.metadata.contentType, "video/mp4");
  assert.strictEqual(storedObj!.content.toString(), "mock-binary-mp4-video-bytes-here");

  // Test 3: Polling Workflow (Pending status)
  console.log("Testing polling workflow with initial pending status...");
  resetTransport(transport);
  transport.pollBehavior = "pending-once-then-success";
  
  const originalSetTimeout = global.setTimeout;
  (global as any).setTimeout = (fn: any, ms: number) => originalSetTimeout(fn, 1); // execute immediately

  try {
    const resPending = await provider.execute({
      model: "veo-3",
      prompt: "beach wave timelapse",
    } as any);

    assert.strictEqual(transport.pollCount, 2, "Should poll twice due to done: false first time");
    assert.strictEqual(resPending.metadata.status, "completed");
  } finally {
    global.setTimeout = originalSetTimeout; // restore
  }

  // Test 4: Polling failures (failed and cancelled operation)
  console.log("Testing failed and cancelled operation handling...");
  
  // Failed Operation
  resetTransport(transport);
  transport.pollBehavior = "failed";
  const originalSetTimeout2 = global.setTimeout;
  (global as any).setTimeout = (fn: any, ms: number) => originalSetTimeout2(fn, 1);
  try {
    await provider.execute({ prompt: "bad video" } as any);
    assert.fail("Should have thrown error on failed operation");
  } catch (err: any) {
    if (err.constructor.name === "AssertionError") throw err;
    assert.ok(err.message.includes("Veo internal renderer failed"));
    assert.strictEqual(err.status, 500);
  } finally {
    global.setTimeout = originalSetTimeout2;
  }

  // Cancelled Operation
  resetTransport(transport);
  transport.pollBehavior = "cancelled";
  const originalSetTimeout3 = global.setTimeout;
  (global as any).setTimeout = (fn: any, ms: number) => originalSetTimeout3(fn, 1);
  try {
    await provider.execute({ prompt: "cancel me" } as any);
    assert.fail("Should have thrown error on cancelled operation");
  } catch (err: any) {
    if (err.constructor.name === "AssertionError") throw err;
    assert.ok(err.message.includes("cancelled by user"));
    assert.strictEqual(err.status, 499);
  } finally {
    global.setTimeout = originalSetTimeout3;
  }

  // Test 5: Submit Errors (invalid API key & rate limit)
  console.log("Testing invalid API key and rate limit errors...");
  
  // Invalid API key (Unrecoverable)
  resetTransport(transport);
  transport.submitBehavior = "invalid-key";
  try {
    await provider.execute({ prompt: "run with bad key" } as any);
    assert.fail("Should have thrown error on bad API key");
  } catch (err: any) {
    if (err.constructor.name === "AssertionError") throw err;
    assert.ok(err.message.includes("API key not valid"));
    assert.strictEqual(err.status, 401);
  }

  // Rate Limit (Recoverable)
  resetTransport(transport);
  transport.submitBehavior = "rate-limit";
  try {
    await provider.execute({ prompt: "rate limited prompt" } as any);
    assert.fail("Should have thrown error on rate limit");
  } catch (err: any) {
    if (err.constructor.name === "AssertionError") throw err;
    assert.ok(err.message.includes("exhausted"));
    assert.strictEqual(err.status, 429);
  }

  // Test 6: Gateway Registration and Discovery
  console.log("Testing AI Gateway discovery, capability routing, and fallback...");
  const gateway = new GatewayEngine({
    logger: { warn: () => {}, info: () => {}, error: () => {} },
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
  
  const geminiVideoEntry = allProviders.find(p => p.providerId === "gemini-video");
  assert.ok(geminiVideoEntry, "gemini-video should be registered");
  assert.strictEqual(geminiVideoEntry!.capabilities.supportsVideo, true);
  assert.strictEqual(geminiVideoEntry!.capabilities.supportsChat, false);
  assert.strictEqual(geminiVideoEntry!.capabilities.supportsImages, false);

  // Router capability routing
  const routeDecision = gateway.getRouter().route({
    requestId: "req-vid-1",
    model: "veo-3",
    prompt: "city flyover",
    requestType: "video",
    stream: false
  });

  assert.strictEqual(routeDecision.selectedProviderId, "gemini-video", "Gateway should route requestType=video to gemini-video");
  assert.ok(routeDecision.alternates.includes("runway-video"), "Runway should be a fallback alternate");
  assert.ok(routeDecision.alternates.includes("pika-video"), "Pika should be a fallback alternate");

  // Gateway Fallback execution check
  (gateway as any)._adapters.set("gemini-video", {
    connect: async () => {},
    execute: async () => {
      // Simulate rate limit recoverable error
      const err = new Error("Rate limit hit");
      (err as any).status = 429;
      throw err;
    }
  });

  (gateway as any)._adapters.set("runway-video", {
    connect: async () => {},
    execute: async (req: any) => {
      return {
        requestId: req.requestId,
        providerId: "runway-video",
        model: req.model,
        content: "videos/runway-fallback.mp4",
        storedVideoPath: "videos/runway-fallback.mp4",
        storageBucket: "videos",
        mimeType: "video/mp4",
        duration: 8,
        resolution: "720p",
        metadata: { fallback: true }
      };
    }
  });

  const gatewayResponse = await gateway.execute({
    requestId: "req-vid-2",
    model: "veo-3",
    prompt: "city flyover",
    requestType: "video",
    stream: false
  });

  assert.strictEqual(gatewayResponse.providerId, "runway-video", "Should fallback to runway-video");
  assert.strictEqual(gatewayResponse.content, "videos/runway-fallback.mp4");

  console.log("=== ALL GEMINI VEO VIDEO GENERATION PROVIDER TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
