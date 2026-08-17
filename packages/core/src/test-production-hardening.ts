import { ContentPipelineEngine } from "./content-pipeline/ContentPipelineEngine";
import { ContentPipelineBuilder } from "./content-pipeline/ContentPipelineBuilder";
import { ContentStage } from "./content-pipeline/ContentStage";
import { RenderQuality } from "./content-pipeline/RenderQuality";
import { MediaProviderEngine } from "./media-provider/MediaProviderEngine";
import { MediaType } from "./media-provider/MediaType";
import { GenerationException } from "./media-provider/types";
import { RenderEngine } from "./rendering/RenderEngine";
import { RenderingException } from "./rendering/types";
import { RenderException } from "./content-pipeline/types";
import { Resolution } from "./rendering/Resolution";
import * as fs from "node:fs";
import * as path from "node:path";
import * as assert from "node:assert";

// Clean output directory helper
function cleanMediaDir() {
  const dir = path.join(process.cwd(), "storage", "media");
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith("hardening-")) {
        fs.rmSync(path.join(dir, f), { force: true });
      }
    }
  }
}

async function run() {
  console.log("\n=== START HARDENING AND CLEANUP VERIFICATION TESTS ===\n");
  cleanMediaDir();

  // Test A: Normal content pipeline stages
  console.log("Test A: Verify content pipeline stages omit VIDEO_GENERATION...");
  const builder = new ContentPipelineBuilder();
  const ctx = {
    env: "test",
    namespace: "test-ns",
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
      getImageManager: () => ({ generateImage: async () => ({ assets: [{ url: "https://mock.ai/1.png" }] }) }),
      getVoiceManager: () => ({ textToSpeech: async () => ({ audioUrl: "https://mock.ai/1.mp3" }) }),
      getMusicManager: () => ({
        generateMusic: async () => ({ assets: [{ url: "https://mock.ai/music.mp3" }] }),
        generateSfx: async () => ({ assets: [{ url: "https://mock.ai/sfx.mp3" }] })
      })
    }
  };
  const engine = builder.withContext(ctx).build() as ContentPipelineEngine;
  await engine.initialize();
  
  // Verify ContentStage enum does not define VIDEO_GENERATION
  const stages = Object.values(ContentStage);
  assert.ok(!stages.includes("VIDEO_GENERATION" as any), "ContentStage does not define VIDEO_GENERATION");
  
  console.log("  ✓ Test A passed: ContentStage does not define VIDEO_GENERATION");

  // Test B: Mock media in test mode
  console.log("Test B: Mock media in test mode (NODE_ENV=test)...");
  process.env.NODE_ENV = "test";
  const providerCtx = { env: "test", namespace: "test-ns" };
  const provider = new MediaProviderEngine(providerCtx);
  await provider.initialize();

  const mockImg = await provider.processAndPersistMedia(
    "hardening-test-image",
    MediaType.IMAGE,
    "png",
    "image/png"
  );
  assert.ok(mockImg.url.startsWith("file://"), "Mock image generated successfully in test mode");
  const imgPath = path.join(process.cwd(), "storage", "media", "hardening-test-image.png");
  assert.ok(fs.existsSync(imgPath), "Image file created on disk in test mode");
  
  const mockAudio = await provider.processAndPersistMedia(
    "hardening-test-audio",
    MediaType.VOICE,
    "wav",
    "audio/wav",
    undefined,
    undefined,
    2
  );
  assert.ok(mockAudio.url.startsWith("file://"), "Mock audio generated successfully in test mode");
  const audioPath = path.join(process.cwd(), "storage", "media", "hardening-test-audio.wav");
  assert.ok(fs.existsSync(audioPath), "Audio file created on disk in test mode");
  
  console.log("  ✓ Test B passed: Fallbacks are allowed and written in test mode");

  // Test C: Production missing image
  console.log("Test C: Production missing required image fails...");
  process.env.NODE_ENV = "production";
  const prodProviderCtx = { env: "production", namespace: "prod-ns" };
  const prodProvider = new MediaProviderEngine(prodProviderCtx);
  await prodProvider.initialize();

  let threwImageErr = false;
  try {
    await prodProvider.processAndPersistMedia(
      "hardening-test-prod-image",
      MediaType.IMAGE,
      "png",
      "image/png"
    );
  } catch (err: any) {
    threwImageErr = true;
    assert.ok(err instanceof GenerationException, "Error should be a GenerationException");
    assert.ok(err.message.includes("Required IMAGE asset unavailable in production"), "actionable message check");
  }
  assert.ok(threwImageErr, "Should throw GenerationException in production for missing image");
  const prodImgPath = path.join(process.cwd(), "storage", "media", "hardening-test-prod-image.png");
  assert.ok(!fs.existsSync(prodImgPath), "No fake PNG file is created in production mode");

  console.log("  ✓ Test C passed: Missing required image fails and writes no fake PNG");

  // Test D: Production missing voice audio
  console.log("Test D: Production missing required voice fails...");
  let threwAudioErr = false;
  try {
    await prodProvider.processAndPersistMedia(
      "hardening-test-prod-voice",
      MediaType.VOICE,
      "wav",
      "audio/wav",
      undefined,
      undefined,
      2
    );
  } catch (err: any) {
    threwAudioErr = true;
    assert.ok(err instanceof GenerationException, "Error should be a GenerationException");
    assert.ok(err.message.includes("Required VOICE asset unavailable in production"), "actionable message check");
  }
  assert.ok(threwAudioErr, "Should throw GenerationException in production for missing required voice");
  const prodAudioPath = path.join(process.cwd(), "storage", "media", "hardening-test-prod-voice.wav");
  assert.ok(!fs.existsSync(prodAudioPath), "No fake WAV file is created in production mode");

  console.log("  ✓ Test D passed: Missing required audio fails and writes no fake WAV");

  // Test E: Optional media continues in production
  console.log("Test E: Optional media (SFX/Music) does not fail in production...");
  const sfxAsset = await prodProvider.processAndPersistMedia(
    "hardening-test-prod-sfx",
    MediaType.SFX,
    "wav",
    "audio/wav",
    undefined,
    undefined,
    1
  );
  assert.equal((sfxAsset as any).status, "FAILED", "Optional asset returns FAILED status in production instead of throwing");
  const prodSfxPath = path.join(process.cwd(), "storage", "media", "hardening-test-prod-sfx.wav");
  assert.ok(!fs.existsSync(prodSfxPath), "No file written to disk for missing optional sfx in production");

  console.log("  ✓ Test E passed: Optional media returns FAILED and does not block production");

  // Test F: Production renderer validation
  console.log("Test F: Production renderer validation fails on missing required files...");
  const renderCtx = { env: "production", namespace: "prod-ns" };
  const renderer = new RenderEngine(renderCtx);
  await renderer.initialize();

  const invalidTimeline = {
    id: "test-timeline-invalid",
    durationSeconds: 10,
    fps: 30,
    tracks: [
      {
        id: "tr-images",
        type: "IMAGE",
        clips: [
          {
            id: "missing-img-1",
            assetPath: "file:///nonexistent-image-path.png",
            startTimeSeconds: 0,
            endTimeSeconds: 5
          }
        ]
      }
    ],
    audioTrack: {
      voiceClips: [],
      musicClips: [],
      sfxClips: []
    }
  };

  let threwRenderErr = false;
  try {
    await renderer.render({
      id: "render-job-prod-fail",
      compositionId: "test-timeline-invalid",
      format: "MP4",
      resolution: "1080P",
      quality: "STANDARD",
      codec: "H264",
      fps: 30,
      state: "CREATED",
      timestamp: new Date()
    });
  } catch (err: any) {
    threwRenderErr = true;
    assert.ok(err instanceof RenderingException, "Should throw RenderingException");
    assert.ok(err.message.includes("Required visual asset unavailable"), "error message should mention missing visual asset");
  }
  assert.ok(threwRenderErr, "Should fail rendering if required visual asset is missing");
  console.log("  ✓ Test F passed: Production renderer fails on missing required files");

  // Test G: Production RenderManager with valid resolution mapped correctly
  console.log("Test G: Production RenderManager maps resolution to Resolution enum correctly...");
  const renderEngineMockG = {
    render: async (req: any) => {
      // Assert that resolution mapped to enum value "1080P" (Resolution.P1080)
      assert.strictEqual(req.resolution, Resolution.P1080, "resolution must be Resolution.P1080 ('1080P')");
      return {
        id: req.id,
        outputPath: req.options?.outputPath || "mock.mp4",
        fileSizeBytes: 1000,
        durationSeconds: 10,
        resolution: req.resolution,
        fps: req.fps,
        state: "COMPLETED",
        timestamp: new Date()
      };
    }
  };
  
  const ctxG = {
    env: "production",
    renderEngine: renderEngineMockG,
    logger: { info: () => {}, error: () => {}, warn: () => {} }
  };
  
  const engineG = new ContentPipelineBuilder().withContext(ctxG).build() as ContentPipelineEngine;
  const renderMgrG = engineG.getRenderManager();
  
  const timelineG = {
    id: "timeline-g",
    tracks: [],
    durationSeconds: 10,
    resolution: "1920x1080", // Will be mapped to Resolution.P1080 ("1080P")
    fps: 30,
    state: "COMPLETED" as any
  };
  
  const reportG = await renderMgrG.render(timelineG, RenderQuality.HIGH);
  assert.strictEqual(reportG.resolution, Resolution.P1080, "Returned report resolution must be Resolution.P1080");
  console.log("  ✓ Test G passed: Production resolution mapped and accepted");

  // Test H: Invalid resolution input mapped safely to default or validated
  console.log("Test H: Invalid resolution input in timeline maps to default fallback...");
  const renderEngineMockH = {
    render: async (req: any) => {
      assert.strictEqual(req.resolution, Resolution.P1080, "fallback resolution must be Resolution.P1080");
      return {
        id: req.id,
        outputPath: req.options?.outputPath || "mock.mp4",
        fileSizeBytes: 1000,
        durationSeconds: 10,
        resolution: req.resolution,
        fps: req.fps,
        state: "COMPLETED",
        timestamp: new Date()
      };
    }
  };
  const ctxH = {
    env: "production",
    renderEngine: renderEngineMockH,
    logger: { info: () => {}, error: () => {}, warn: () => {} }
  };
  const engineH = new ContentPipelineBuilder().withContext(ctxH).build() as ContentPipelineEngine;
  const renderMgrH = engineH.getRenderManager();
  const timelineH = {
    id: "timeline-h",
    tracks: [],
    durationSeconds: 10,
    resolution: "invalid_res",
    fps: 30,
    state: "COMPLETED" as any
  };
  await renderMgrH.render(timelineH, RenderQuality.HIGH);
  console.log("  ✓ Test H passed: Invalid resolution input handled safely");

  // Test I: Production RenderEngine failure does NOT silently succeed
  console.log("Test I: Production RenderEngine failure throws RenderException...");
  const renderEngineMockI = {
    render: async () => {
      throw new Error("Simulated render engine hardware failure");
    }
  };
  const ctxI = {
    env: "production",
    renderEngine: renderEngineMockI,
    logger: { info: () => {}, error: () => {}, warn: () => {} }
  };
  const engineI = new ContentPipelineBuilder().withContext(ctxI).build() as ContentPipelineEngine;
  const renderMgrI = engineI.getRenderManager();
  let threwRenderErrI = false;
  try {
    await renderMgrI.render(timelineG, RenderQuality.HIGH);
  } catch (err: any) {
    threwRenderErrI = true;
    assert.ok(err instanceof RenderException, "Error should be a RenderException");
    assert.ok(err.message.includes("RenderEngine failed"), "Error message should mention RenderEngine failed");
  }
  assert.ok(threwRenderErrI, "RenderManager must fail fast and throw RenderException in production when engine fails");
  console.log("  ✓ Test I passed: RenderEngine failure correctly throws RenderException");

  // Test J: Test-mode behavior falls back to internal/mock rendering when engine fails
  console.log("Test J: Test-mode fallback behavior is preserved on engine failure...");
  const renderEngineMockJ = {
    render: async () => {
      throw new Error("Simulated test-mode render failure");
    }
  };
  const ctxJ = {
    env: "test",
    renderEngine: renderEngineMockJ,
    logger: { info: () => {}, error: () => {}, warn: () => {} }
  };
  const engineJ = new ContentPipelineBuilder().withContext(ctxJ).build() as ContentPipelineEngine;
  const renderMgrJ = engineJ.getRenderManager();
  
  // Should not throw, should return mockReport fallback
  const reportJ = await renderMgrJ.render(timelineG, RenderQuality.HIGH);
  assert.ok(reportJ.renderedFileUrl.includes("mockmedia.ai") || reportJ.renderedFileUrl.startsWith("file://"), "Should fallback to mock/internal render report");
  console.log("  ✓ Test J passed: Test-mode fallback behavior verified");

  cleanMediaDir();
  console.log("\n=== ALL HARDENING AND CLEANUP VERIFICATION TESTS PASSED ===\n");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
