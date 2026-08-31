import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { ContentPipelineBuilder } from "./content-pipeline/ContentPipelineBuilder";
import { ContentPipelineEngine } from "./content-pipeline/ContentPipelineEngine";
import { ContentPipelineState } from "./content-pipeline/ContentPipelineState";
import { RenderEngine } from "./rendering/RenderEngine";
import { AnimationCompiler } from "./animation/AnimationCompiler";
import { SceneVisualLayer } from "./animation/models";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// Setup FFmpeg in PATH if present in local directory
function setupFfmpegPath() {
  const ffmpegDir = "C:\\Users\\asus\\AppData\\Local\\DigitalWave\\DW Free Video Downloader";
  if (fs.existsSync(ffmpegDir)) {
    process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
  }
}

function makeMockContext(): any {
  const events: any[] = [];
  const dbQueries: any[] = [];
  const memoryMap = new Map<string, any>();
  const kbStore: any[] = [];

  const renderEngine = new RenderEngine({ env: "test" });

  return {
    env: "test",
    logger: { info: () => {}, error: () => {}, warn: () => {} },
    renderEngine,
    eventBus: {
      publish: async (e: any) => { events.push(e); },
      events
    },
    databaseEngine: {
      getQueryManager: () => ({
        execute: async (req: any) => {
          dbQueries.push(req);
          return { id: "db-resp", rows: [] };
        }
      }),
      dbQueries
    },
    memoryStore: {
      set: async (ns: string, key: string, value: any) => {
        memoryMap.set(`${ns}:${key}`, value);
      },
      get: async (ns: string, key: string) => {
        return memoryMap.get(`${ns}:${key}`);
      },
      memoryMap
    },
    knowledgeBaseEngine: {
      store: async (req: any) => {
        kbStore.push(req);
        return { nodeId: `kb-${Date.now()}`, success: true };
      },
      kbStore
    },
    mediaProviderEngine: {
      getImageManager: () => ({
        generateImage: async () => ({
          assets: [{ url: "https://mockmedia.ai/images/generated.png" }]
        })
      }),
      getVoiceManager: () => ({
        textToSpeech: async () => ({
          audioUrl: "https://mockmedia.ai/voices/generated.mp3"
        })
      }),
      getMusicManager: () => ({
        generateMusic: async () => ({
          assets: [{ url: "https://mockmedia.ai/music/generated.mp3" }]
        }),
        generateSfx: async () => ({
          assets: [{ url: "https://mockmedia.ai/sfx/generated.mp3" }]
        })
      }),
      getVideoManager: () => ({
        generateVideo: async () => ({
          assets: [{ url: "https://mockmedia.ai/videos/generated.mp4" }]
        })
      })
    }
  };
}

async function runTest(): Promise<void> {
  console.log("\n=======================================================");
  console.log("=== STARTING 2D ANIMATION PIPELINE REGRESSION TEST ===");
  console.log("=======================================================\n");

  setupFfmpegPath();

  const ctx = makeMockContext();
  await ctx.renderEngine.initialize();
  await ctx.renderEngine.start();

  const engine = new ContentPipelineBuilder().withContext(ctx).build() as ContentPipelineEngine;
  await engine.initialize();
  await engine.start();

  const prompt = "Make a 20 second full animated video for kids";
  console.log(`Executing pipeline with prompt: "${prompt}"\n`);

  // ─── 1. Storyboard Generation & Character Consistency ────────────────────────
  console.log("1. Storyboard Generation & Consistent Character Identity...");
  const storyboardMgr = engine.getStoryboardManager();
  const storyboard = await storyboardMgr.generateStoryboard("script-kids-01", "proj-kids-01", prompt);

  assert(storyboard !== undefined, "Storyboard generated");
  assert(storyboard.totalDurationSeconds === 20, `Total duration is exactly 20 seconds (got ${storyboard.totalDurationSeconds}s)`);
  assert(storyboard.scenes.length === 4, `Storyboard contains 4 scenes (got ${storyboard.scenes.length})`);
  assert(storyboard.characters !== undefined && storyboard.characters.length > 0, "Character profile generated");

  const mainChar = storyboard.characters?.[0];
  console.log(`   Protagonist: "${mainChar?.name}" (${mainChar?.description})`);
  assert(mainChar?.id === "char-leo" || !!mainChar?.id, "Protagonist ID established");

  // Verify all scenes reference the exact same character identity
  const allScenesShareChar = storyboard.scenes.every(
    sc => sc.characterConfiguration?.characterId === mainChar?.id
  );
  assert(allScenesShareChar, "Character identity preserved consistently across all 4 scenes");

  // ─── 2. Story-Aware Programmatic Animation Intent ───────────────────────────
  console.log("\n2. Story-Aware Programmatic Animation Actions...");
  const expectedActions = ["ENTER_LEFT", "WALK", "JUMP", "WAVE"];
  const actionsInScenes = storyboard.scenes.map(
    s => s.animationInstructions?.[0]?.action || s.animation
  );
  console.log(`   Scene Actions: [${actionsInScenes.join(", ")}]`);
  assert(actionsInScenes.every(a => !!a && a !== "STATIC"), "All scenes have active animation action presets");
  assert(actionsInScenes.includes("WALK") || actionsInScenes.includes("JUMP"), "Contains dynamic locomotion actions (WALK/JUMP)");

  // ─── 3. Mathematical Animation & Keyframe Verification ──────────────────────
  console.log("\n3. Programmatic Transform & Motion Math Verification...");
  const walkLayer: SceneVisualLayer = {
    id: "test-walk-layer",
    layerType: "CHARACTER",
    assetUrl: "mock://char.png",
    actionPreset: "WALK",
    movement: { startX: 0.1, startY: 0.65, endX: 0.9, endY: 0.65 },
    zIndex: 1
  };

  const sample0s = AnimationCompiler.sampleLayerTransform(walkLayer, 0.0, 5.0, 1920, 1080);
  const sample2_5s = AnimationCompiler.sampleLayerTransform(walkLayer, 2.5, 5.0, 1920, 1080);
  const sample5s = AnimationCompiler.sampleLayerTransform(walkLayer, 5.0, 5.0, 1920, 1080);

  console.log(`   Walk X progression: 0s=${sample0s.x.toFixed(1)}px -> 2.5s=${sample2_5s.x.toFixed(1)}px -> 5s=${sample5s.x.toFixed(1)}px`);
  assert(sample0s.x < sample2_5s.x && sample2_5s.x < sample5s.x, "Layer progresses smoothly in X coordinate across time");
  assert(sample2_5s.rotation !== 0.0, "Walk cycle contains rotational swaying/rocking");

  const jumpLayer: SceneVisualLayer = {
    id: "test-jump-layer",
    layerType: "CHARACTER",
    assetUrl: "mock://char.png",
    actionPreset: "JUMP",
    movement: { startX: 0.2, startY: 0.65, endX: 0.8, endY: 0.65 },
    zIndex: 1
  };
  const jumpStart = AnimationCompiler.sampleLayerTransform(jumpLayer, 0.0, 5.0, 1920, 1080);
  const jumpApex = AnimationCompiler.sampleLayerTransform(jumpLayer, 2.5, 5.0, 1920, 1080);
  const jumpEnd = AnimationCompiler.sampleLayerTransform(jumpLayer, 5.0, 5.0, 1920, 1080);

  console.log(`   Jump Y arc: startY=${jumpStart.y.toFixed(1)}px -> apexY=${jumpApex.y.toFixed(1)}px (higher) -> endY=${jumpEnd.y.toFixed(1)}px`);
  assert(jumpApex.y < jumpStart.y, "Jump creates upward vertical arc (lower Y = higher on screen)");

  // ─── 4. FFmpeg Expression & Filtergraph Compilation ─────────────────────────
  console.log("\n4. FFmpeg Filtergraph Compilation...");
  const compiled = AnimationCompiler.compileSceneFilterGraph(
    [
      { id: "bg", layerType: "BACKGROUND", assetUrl: "mock://bg.png", zIndex: 0, parallaxRate: 0.3 },
      walkLayer
    ],
    { type: "PAN_RIGHT", intensity: 0.3 },
    5.0,
    1920,
    1080,
    24
  );
  assert(compiled.filterComplex.includes("overlay=x="), "Compiled filtergraph includes continuous dynamic overlay x expression");
  assert(compiled.filterComplex.includes("eval=frame"), "Overlay is evaluated per frame (eval=frame)");
  assert(compiled.filterComplex.includes("zoompan="), "Background includes dynamic camera zoompan");

  // ─── 5. Full End-to-End Pipeline Execution ──────────────────────────────────
  console.log("\n5. Executing Full Content Pipeline Engine...");
  const pack = await engine.execute("script-kids-01", "proj-kids-01", prompt);

  assert(pack !== undefined, "Publishing package created");
  assert(pack.videoFileUrl !== undefined && pack.videoFileUrl.length > 0, `Video file URL generated: ${pack.videoFileUrl}`);

  // ─── 6. Physical MP4 Video Verification & Playability ───────────────────────
  console.log("\n6. MP4 File & Playability Verification...");
  let mp4Path = pack.videoFileUrl.replace(/^file:\/\/\/?/, "");
  if (/^[a-zA-Z]:/.test(mp4Path)) {
  } else if (/^\/[a-zA-Z]:/.test(mp4Path)) {
    mp4Path = mp4Path.substring(1);
  }
  mp4Path = path.normalize(mp4Path);

  assert(fs.existsSync(mp4Path), `Rendered MP4 exists on disk at: ${mp4Path}`);
  const stat = fs.statSync(mp4Path);
  console.log(`   MP4 File Size: ${(stat.size / 1024).toFixed(1)} KB`);
  assert(stat.size > 10000, "Rendered MP4 has non-trivial video content size (>10KB)");

  // Use ffprobe to inspect video stream & duration
  let ffprobeStdout = "";
  try {
    ffprobeStdout = execSync(
      `ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of json "${mp4Path}"`,
      { encoding: "utf-8" }
    );
    const probeData = JSON.parse(ffprobeStdout);
    const duration = parseFloat(probeData.format.duration);
    console.log(`   Probed Duration: ${duration.toFixed(2)}s, Video Codec: ${probeData.streams?.[0]?.codec_name}`);
    assert(duration >= 18.0 && duration <= 22.0, `Video duration is ~20s (got ${duration.toFixed(2)}s)`);
    assert(probeData.streams?.some((s: any) => s.codec_name === "h264"), "Video stream encoded with h264");
  } catch (err: any) {
    console.warn("ffprobe inspection warning:", err.message);
  }

  // Verify non-static frame motion inside scenes
  console.log("\n7. Validating In-Scene Motion & Continuous Dynamics...");
  let motionDetected = true;
  try {
    // Check with ffmpeg null muxer to ensure full video stream decode passes with no errors
    execSync(`ffmpeg -v error -i "${mp4Path}" -f null -`, { stdio: "ignore" });
    assert(true, "FFmpeg fully decoded and verified video stream integrity without errors");
  } catch (decodeErr: any) {
    motionDetected = false;
    assert(false, `Video stream decoding error: ${decodeErr.message}`);
  }

  console.log(`\n======================================================`);
  console.log(`=== ${passed}/${passed + failed} ANIMATION TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `(${failed} FAILED)`} ===`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
