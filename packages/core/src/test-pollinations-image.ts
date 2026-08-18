import { MediaProviderEngine } from "./media-provider/MediaProviderEngine";
import { MediaType } from "./media-provider/MediaType";
import { MediaProviderType } from "./media-provider/MediaProviderType";
import { GenerationMode } from "./media-provider/GenerationMode";
import { MediaQuality } from "./media-provider/MediaQuality";
import { GenerationException } from "./media-provider/types";
import { ContentPipelineBuilder } from "./content-pipeline/ContentPipelineBuilder";
import { ContentPipelineEngine } from "./content-pipeline/ContentPipelineEngine";
import { ContentStage } from "./content-pipeline/ContentStage";
import * as fs from "node:fs";
import * as path from "node:path";
import * as assert from "node:assert";

// Save the original fetch to restore it later
const originalFetch = globalThis.fetch;

const openAiConfig = {
  provider: MediaProviderType.OPENAI,
  apiKey: "sk-openai-media-key-123",
  capabilities: {
    provider: MediaProviderType.OPENAI,
    supportedTypes: [MediaType.IMAGE],
    supportedModes: [GenerationMode.TEXT_TO_IMAGE],
    supportedQualities: [MediaQuality.HIGH],
    supportsStreaming: false
  }
};

// Helper to convert Node Buffer to clean ArrayBuffer (avoiding pool sharing issues)
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function cleanMediaDir() {
  const dir = path.join(process.cwd(), "storage", "media");
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith("pollinations-test-")) {
        fs.rmSync(path.join(dir, f), { force: true });
      }
    }
  }
}

async function runTests() {
  console.log("\n=== START POLLINATIONS IMAGE FLOW REGRESSION TESTS ===\n");
  cleanMediaDir();

  try {
    // -------------------------------------------------------------------------
    // Test A & F: Pollinations successful image generation -> real asset returned
    // -------------------------------------------------------------------------
    console.log("Test A & F: Verify successful Pollinations image generation...");
    process.env.NODE_ENV = "production";
    const prodCtx = { env: "production", namespace: "prod-test-ns" };
    const provider = new MediaProviderEngine(prodCtx);
    await provider.initialize();
    await provider.getProviderManager().registerProvider(openAiConfig);

    // Mock fetch for success
    const fakeImageBuffer = Buffer.from("fake-png-data-bytes-here-non-empty");
    globalThis.fetch = async (url: any, options: any): Promise<any> => {
      return {
        ok: true,
        headers: {
          get: (name: string) => name.toLowerCase() === "content-type" ? "image/png" : null
        },
        arrayBuffer: async () => toArrayBuffer(fakeImageBuffer)
      };
    };

    const imageResp = await provider.getImageManager().generateImage({
      id: "pollinations-test-success",
      mode: GenerationMode.TEXT_TO_IMAGE,
      prompt: "A beautiful space landscape",
      size: "512x512",
      metadata: { taskId: "task-1234", sceneId: "scene-1" }
    });

    assert.ok(imageResp.assets.length > 0, "Should return assets");
    const asset = imageResp.assets[0];
    assert.strictEqual(asset.type, MediaType.IMAGE, "Asset type should be IMAGE");
    assert.ok(asset.id, "Asset ID should be defined");
    assert.ok(asset.url.startsWith("file:///"), "URL should be a local file path");

    const resolvedPath = path.normalize(asset.url.substring(8)); // file:/// is 8 chars
    assert.ok(fs.existsSync(resolvedPath), `Generated file should exist at path: ${resolvedPath}`);
    assert.strictEqual(fs.readFileSync(resolvedPath).toString(), "fake-png-data-bytes-here-non-empty", "Content on disk should match mocked response");

    // Stub/mock protection check (production never creates fallback strings/paths)
    assert.ok(!asset.url.includes("mockmedia.ai") && !asset.url.includes("mock.ai") && !asset.url.includes("stub-img.png"), "Asset URL must not contain stub strings in production");

    console.log("  ✓ Test A & F passed.");

    // -------------------------------------------------------------------------
    // Test B: Pollinations request timeout -> production error -> no mock asset
    // -------------------------------------------------------------------------
    console.log("Test B: Verify Pollinations timeout throws correct GenerationException...");
    process.env.POLLINATIONS_TIMEOUT_MS = "10"; // Short timeout

    // Mock fetch to simulate a delay that triggers the timeout
    globalThis.fetch = async (url: any, options: any): Promise<any> => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 100);
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }
      });
      throw new Error("Should have been aborted");
    };

    let threwTimeoutErr = false;
    try {
      await provider.getImageManager().generateImage({
        id: "pollinations-test-timeout",
        mode: GenerationMode.TEXT_TO_IMAGE,
        prompt: "A timed out prompt",
        metadata: { taskId: "task-timeout-55", sceneId: "scene-2" }
      });
    } catch (err: any) {
      threwTimeoutErr = true;
      assert.ok(err instanceof GenerationException, "Error should be GenerationException");
      assert.ok(err.message.includes("Image generation failed:"), "Error message should follow formatting guidelines");
      assert.ok(err.message.includes("provider=Pollinations"), "Should specify provider");
      assert.ok(err.message.includes("taskId=task-timeout-55"), "Should contain taskId");
      assert.ok(err.message.includes("sceneId=scene-2"), "Should contain sceneId");
      assert.ok(err.message.includes("reason=Request timed out"), "Should identify reason as timeout");
      assert.ok(err.message.includes("timeoutMs=10"), "Should report timeoutMs");
      assert.ok(err.cause && err.cause.name === "AbortError", "Should preserve the original AbortError");
    }

    assert.ok(threwTimeoutErr, "Timeout must throw an exception in production");
    console.log("  ✓ Test B passed.");

    // Clean up env
    delete process.env.POLLINATIONS_TIMEOUT_MS;

    // -------------------------------------------------------------------------
    // Test C: Pollinations AbortError -> production error -> cause preserved
    // -------------------------------------------------------------------------
    console.log("Test C: Verify other AbortErrors are correctly handled...");
    globalThis.fetch = async (url: any, options: any): Promise<any> => {
      throw new DOMException("Manual abort operation", "AbortError");
    };

    let threwAbortErr = false;
    try {
      await provider.getImageManager().generateImage({
        id: "pollinations-test-abort",
        mode: GenerationMode.TEXT_TO_IMAGE,
        prompt: "Aborted prompt",
        metadata: { taskId: "task-abort-88", sceneId: "scene-3" }
      });
    } catch (err: any) {
      threwAbortErr = true;
      assert.ok(err instanceof GenerationException, "Should throw GenerationException");
      assert.ok(err.message.includes("reason=Request timed out"), "AbortError translates to Request timed out");
      assert.strictEqual(err.cause.name, "AbortError", "Original cause should be preserved");
    }
    assert.ok(threwAbortErr, "AbortError must throw in production");
    console.log("  ✓ Test C passed.");

    // -------------------------------------------------------------------------
    // Test D: Invalid/non-image provider response -> rejected
    // -------------------------------------------------------------------------
    console.log("Test D: Verify invalid (non-image) content type is rejected...");
    globalThis.fetch = async (url: any, options: any): Promise<any> => {
      return {
        ok: true,
        headers: {
          get: (name: string) => name.toLowerCase() === "content-type" ? "text/html" : null
        },
        arrayBuffer: async () => toArrayBuffer(Buffer.from("<html>Error</html>"))
      };
    };

    let threwInvalidTypeErr = false;
    try {
      await provider.getImageManager().generateImage({
        id: "pollinations-test-invalid-type",
        mode: GenerationMode.TEXT_TO_IMAGE,
        prompt: "Invalid prompt",
        metadata: { taskId: "task-invalid-type", sceneId: "scene-4" }
      });
    } catch (err: any) {
      threwInvalidTypeErr = true;
      assert.ok(err instanceof GenerationException, "Should throw GenerationException");
      assert.ok(err.message.includes("Invalid content-type: text/html"), "Should report invalid content-type in reason");
    }
    assert.ok(threwInvalidTypeErr, "Invalid content type must be rejected in production");
    console.log("  ✓ Test D passed.");

    // -------------------------------------------------------------------------
    // Test E: Empty image response -> rejected
    // -------------------------------------------------------------------------
    console.log("Test E: Verify empty image response is rejected...");
    globalThis.fetch = async (url: any, options: any): Promise<any> => {
      return {
        ok: true,
        headers: {
          get: (name: string) => name.toLowerCase() === "content-type" ? "image/png" : null
        },
        arrayBuffer: async () => toArrayBuffer(Buffer.alloc(0))
      };
    };

    let threwEmptyErr = false;
    try {
      await provider.getImageManager().generateImage({
        id: "pollinations-test-empty",
        mode: GenerationMode.TEXT_TO_IMAGE,
        prompt: "Empty prompt",
        metadata: { taskId: "task-empty", sceneId: "scene-5" }
      });
    } catch (err: any) {
      threwEmptyErr = true;
      assert.ok(err instanceof GenerationException, "Should throw GenerationException");
      assert.ok(err.message.includes("Empty image response"), "Should report empty response in reason");
    }
    assert.ok(threwEmptyErr, "Empty response must be rejected in production");
    console.log("  ✓ Test E passed.");

    // -------------------------------------------------------------------------
    // Test G: Four storyboard scenes -> four independent visual assets
    // -------------------------------------------------------------------------
    console.log("Test G: Verify four storyboard scenes produce independent visual assets...");
    process.env.NODE_ENV = "production";

    // Setup fetch mock to return unique visual assets based on the prompt
    globalThis.fetch = async (url: any, options: any): Promise<any> => {
      const decodedUrl = decodeURIComponent(url);
      let content = "default-visual-content";
      if (decodedUrl.includes("Prompt 1")) content = "unique-content-scene-1";
      if (decodedUrl.includes("Prompt 2")) content = "unique-content-scene-2";
      if (decodedUrl.includes("Prompt 3")) content = "unique-content-scene-3";
      if (decodedUrl.includes("Prompt 4")) content = "unique-content-scene-4";

      return {
        ok: true,
        headers: {
          get: (name: string) => name.toLowerCase() === "content-type" ? "image/png" : null
        },
        arrayBuffer: async () => toArrayBuffer(Buffer.from(content))
      };
    };

    // Construct pipeline context in production with mocked downstream providers
    const pipelineCtx = {
      env: "production",
      namespace: "prod-pipeline-test-g",
      logger: { info: () => {}, error: () => {}, warn: () => {} },
      eventBus: { publish: async () => {} },
      databaseEngine: {
        getQueryManager: () => ({
          execute: async () => ({ rows: [] })
        })
      },
      memoryStore: {
        set: async () => {},
        get: async () => {}
      },
      knowledgeBaseEngine: {
        store: async () => ({ success: true })
      },
      mediaProviderEngine: {
        getImageManager: () => ({
          generateImage: async (req: any) => {
            return provider.getImageManager().generateImage(req);
          }
        }),
        getVoiceManager: () => ({
          textToSpeech: async (req: any) => ({
            id: `vox-${req.id}`,
            audioUrl: `https://shaily.studio/voice-${req.id}.mp3`
          })
        }),
        getMusicManager: () => ({
          generateMusic: async () => ({ assets: [{ id: "m1", url: "https://shaily.studio/music.mp3" }] }),
          generateSfx: async (req: any) => ({ assets: [{ id: `sfx-${req.id}`, url: "https://shaily.studio/sfx.mp3" }] })
        })
      },
      renderEngine: {
        render: async (req: any) => {
          const timeline = req.options?.timeline;
          const imageTrack = timeline.tracks.find((t: any) => t.type === "IMAGE");
          
          assert.strictEqual(imageTrack.assets.length, 4, "Should have exactly 4 image assets");
          
          // Verify unique contents and URL file persistence
          const contents = new Set<string>();
          for (let i = 0; i < 4; i++) {
            const asset = imageTrack.assets[i];
            const p = path.normalize(asset.url.substring(8));
            assert.ok(fs.existsSync(p), `Persisted file ${p} should exist`);
            const fileData = fs.readFileSync(p).toString();
            assert.ok(fileData.startsWith("unique-content-scene-"), "Should have written correct generated bytes");
            contents.add(fileData);
          }
          // Enforce independent uniqueness
          assert.strictEqual(contents.size, 4, "Should have 4 distinct generated visual asset contents");
          
          return {
            id: req.id,
            outputPath: "output.mp4",
            fileSizeBytes: 1000,
            durationSeconds: 16,
            resolution: req.resolution,
            fps: req.fps,
            state: "COMPLETED",
            timestamp: new Date()
          };
        }
      }
    };

    const pipelineEngine = new ContentPipelineBuilder().withContext(pipelineCtx).build() as ContentPipelineEngine;
    await pipelineEngine.initialize();
    await pipelineEngine.start();

    // Mock storyboard manager to generate 4 scenes
    pipelineEngine.getStoryboardManager().generateStoryboard = async (scriptId: string, projectId: string, topicPrompt?: string) => {
      const sb = {
        id: "story-4-scenes-test",
        projectId,
        scriptId,
        scenes: Array.from({ length: 4 }, (_, i) => ({
          id: `sc-pollinations-${i+1}`,
          sceneNumber: i+1,
          title: `Scene ${i+1}`,
          scriptText: `Text for scene ${i+1}`,
          durationSeconds: 4,
          shots: [
            {
              id: `shot-pollinations-${i+1}`,
              shotNumber: 1,
              description: `Shot desc ${i+1}`,
              camera: { angle: "Eye Level", pan: "Static", zoom: "Slow zoom-in", focus: "Code" },
              durationSeconds: 4,
              visualPrompt: `Prompt ${i+1}`
            }
          ],
          transition: "Cut"
        })),
        totalScenes: 4,
        totalDurationSeconds: 16,
        createdAt: new Date()
      };
      (pipelineEngine.getStoryboardManager() as any)._storyboards.set(sb.id, sb);
      return sb;
    };

    await pipelineEngine.execute("test-script-g", "test-project-g", "TypeScript");
    console.log("  ✓ Test G passed.");

    // -------------------------------------------------------------------------
    // Test I: Test/dev fallback behavior remains compatible where intentionally supported
    // -------------------------------------------------------------------------
    console.log("Test I: Verify test/dev fallback behavior generates mock assets and does not throw...");
    process.env.NODE_ENV = "test";
    const testCtx = { env: "test", namespace: "test-ns-i" };
    const testProvider = new MediaProviderEngine(testCtx);
    await testProvider.initialize();
    await testProvider.getProviderManager().registerProvider(openAiConfig);

    // Mock fetch to fail completely
    globalThis.fetch = async (url: any, options: any): Promise<any> => {
      throw new Error("API completely offline");
    };

    const fallbackResp = await testProvider.getImageManager().generateImage({
      id: "pollinations-test-fallback",
      mode: GenerationMode.TEXT_TO_IMAGE,
      prompt: "Test fallback prompt",
      metadata: { taskId: "task-test-fallback", sceneId: "scene-fallback" }
    });

    assert.ok(fallbackResp.assets.length > 0, "Fallback should return mock assets");
    const fallbackAsset = fallbackResp.assets[0];
    assert.strictEqual(fallbackAsset.type, MediaType.IMAGE, "Fallback asset type is IMAGE");
    const fallbackResolvedPath = path.normalize(fallbackAsset.url.substring(8));
    assert.ok(fs.existsSync(fallbackResolvedPath), `Fallback asset file should exist at ${fallbackResolvedPath}`);
    console.log("  ✓ Test I passed.");

  } finally {
    // Restore fetch
    globalThis.fetch = originalFetch;
    cleanMediaDir();
  }

  console.log("\n=== ALL POLLINATIONS IMAGE REGRESSION TESTS PASSED ===\n");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
