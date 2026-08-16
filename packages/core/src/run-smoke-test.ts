import { RenderEngine } from "./rendering/RenderEngine";
import { MediaProviderEngine } from "./media-provider/MediaProviderEngine";
import { MediaType } from "./media-provider/MediaType";
import { MediaProviderType } from "./media-provider/MediaProviderType";
import { GenerationMode } from "./media-provider/GenerationMode";
import { ExportFormat } from "./rendering/ExportFormat";
import { CodecType } from "./rendering/CodecType";
import { Resolution } from "./rendering/Resolution";
import { QualityPreset } from "./rendering/QualityPreset";
import { RenderingState } from "./rendering/RenderingState";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// 1. Load environment variables from .env
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const parts = trimmed.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join("=").trim();
          process.env[key] = value;
        }
      }
    }
    console.log("Loaded environment variables from .env");
  } else {
    console.warn(".env file not found at root.");
  }
}

// 2. Prep PATH with found FFmpeg directory
function setupFfmpegPath() {
  const ffmpegDir = "C:\\Users\\asus\\AppData\\Local\\DigitalWave\\DW Free Video Downloader";
  if (fs.existsSync(ffmpegDir)) {
    process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
    console.log(`Added FFmpeg directory to PATH: ${ffmpegDir}`);
  } else {
    console.warn(`FFmpeg directory not found at ${ffmpegDir}`);
  }
}

async function runSmokeTest() {
  console.log("\n=== STARTING SHAILY STUDIO SMOKE TEST ===");
  loadEnv();
  setupFfmpegPath();

  // Verify FFmpeg is executable
  try {
    const version = execSync("ffmpeg -version", { encoding: "utf-8" });
    console.log("FFmpeg is available!");
  } catch (err: any) {
    console.error("FFmpeg verification failed:", err.message);
    process.exit(1);
  }

  // 3. Initialize MediaProviderEngine to generate audio clips
  console.log("\n--- STEP 1: INITIALIZE MEDIA PROVIDER ENGINE ---");
  const providerCtx = { env: "test", namespace: "smoke-test-ns" };
  const provider = new MediaProviderEngine(providerCtx);
  await provider.initialize();

  // Register the ElevenLabs and Google providers in the media provider manager
  console.log("Registering ELEVENLABS and GOOGLE providers...");
  await provider.getProviderManager().registerProvider({
    provider: MediaProviderType.ELEVENLABS,
    apiKey: process.env.ELEVENLABS_API_KEY || "eleven-labs-key-789",
    capabilities: {
      provider: MediaProviderType.ELEVENLABS,
      supportedTypes: [MediaType.VOICE],
      supportedModes: [GenerationMode.TEXT_TO_SPEECH],
      supportedQualities: [],
      supportsStreaming: true
    }
  });

  await provider.getProviderManager().registerProvider({
    provider: MediaProviderType.GOOGLE,
    apiKey: process.env.GEMINI_API_KEY || "gemini-key-123",
    capabilities: {
      provider: MediaProviderType.GOOGLE,
      supportedTypes: [MediaType.VOICE],
      supportedModes: [GenerationMode.TEXT_TO_SPEECH],
      supportedQualities: [],
      supportsStreaming: true
    }
  });

  const scenesText = [
    "Inflation means prices rise over time, reducing what your money can buy.",
    "If something costs one hundred rupees today, the same one hundred rupees may buy less in the future.",
    "That's why inflation is important when thinking about your money."
  ];

  console.log("\n--- STEP 2: GENERATING VOICE CLIPS VIA TTS ---");
  const voiceAssets: any[] = [];
  for (let i = 0; i < scenesText.length; i++) {
    console.log(`Generating TTS for Scene ${i + 1}...`);
    try {
      const res = await provider.getVoiceManager().textToSpeech({
        id: `smoke-scene-${i + 1}`,
        text: scenesText[i],
        voiceId: "Rachel",
        languageCode: "en-US",
        provider: MediaProviderType.GOOGLE
      });
      let audioUrl = res.audioUrl;
      if (audioUrl && audioUrl.endsWith(".mp3")) {
        const mp3Path = audioUrl.substring(8).replace(/\//g, path.sep);
        const wavPath = mp3Path.replace(/\.mp3$/, ".wav");
        if (fs.existsSync(mp3Path)) {
          fs.copyFileSync(mp3Path, wavPath);
          audioUrl = `file:///${wavPath.replace(/\\/g, "/")}`;
          console.log(`  [WORKAROUND] Renamed mock MP3 to WAV: ${audioUrl}`);
        }
      }
      console.log(`  ✓ Generated: url=${audioUrl}, duration=${res.durationSeconds}s`);
      voiceAssets.push({
        url: audioUrl,
        duration: res.durationSeconds
      });
    } catch (err: any) {
      console.error(`  ✗ TTS generation failed for scene ${i + 1}:`, err.message);
      process.exit(1);
    }
  }

  // Define image assets from the assets directory in the workspace
  const workspaceRoot = process.cwd();
  const imageAssets = [
    `file:///${path.join(workspaceRoot, "assets", "scene1.jpg").replace(/\\/g, "/")}`,
    `file:///${path.join(workspaceRoot, "assets", "scene2.jpg").replace(/\\/g, "/")}`,
    `file:///${path.join(workspaceRoot, "assets", "scene3.jpg").replace(/\\/g, "/")}`
  ];

  // Verify visual assets exist
  console.log("\n--- STEP 3: VERIFYING VISUAL ASSETS ---");
  for (let i = 0; i < imageAssets.length; i++) {
    const localPath = imageAssets[i].substring(8).replace(/\//g, path.sep);
    if (!fs.existsSync(localPath)) {
      console.error(`  ✗ Visual asset missing: ${localPath}`);
      process.exit(1);
    }
    console.log(`  ✓ Found visual asset: ${localPath}`);
  }

  // 4. Build Timeline Composition
  console.log("\n--- STEP 4: COMPOSING TIMELINE ---");
  let currentOffset = 0;
  const visualClips: any[] = [];
  const voiceClips: any[] = [];

  for (let i = 0; i < scenesText.length; i++) {
    const duration = voiceAssets[i].duration;
    const end = currentOffset + duration;

    // Visual clip
    let anim = "IMAGE_KEN_BURNS";
    if (i === 1) anim = "IMAGE_SLOW_ZOOM";
    if (i === 2) anim = "IMAGE_PAN_RIGHT";

    visualClips.push({
      id: `visual-clip-${i + 1}`,
      assetPath: imageAssets[i],
      startTimeSeconds: currentOffset,
      endTimeSeconds: end,
      meta: { animation: anim },
      transitions: [],
      effects: []
    });

    // Voice clip
    voiceClips.push({
      id: `voice-clip-${i + 1}`,
      assetPath: voiceAssets[i].url,
      startTimeSeconds: currentOffset,
      endTimeSeconds: end,
      volume: 1.0
    });

    currentOffset = end;
  }

  const totalDuration = currentOffset;
  console.log(`Total duration composed: ${totalDuration.toFixed(2)} seconds`);

  const customTimeline = {
    durationSeconds: totalDuration,
    fps: 24,
    tracks: [
      {
        id: "tr-images",
        type: "IMAGE",
        clips: visualClips
      }
    ],
    subtitleTrack: {
      entries: [
        { startTimeSeconds: 0, endTimeSeconds: voiceAssets[0].duration, text: "Scene 1: Introduction" },
        { startTimeSeconds: voiceAssets[0].duration, endTimeSeconds: voiceAssets[0].duration + voiceAssets[1].duration, text: "Scene 2: Example" },
        { startTimeSeconds: voiceAssets[0].duration + voiceAssets[1].duration, endTimeSeconds: totalDuration, text: "Scene 3: Conclusion" }
      ]
    },
    audioTrack: {
      voiceClips: voiceClips,
      musicClips: [],
      sfxClips: []
    }
  };

  // 5. Initialize RenderEngine
  console.log("\n--- STEP 5: INITIALIZE RENDER ENGINE ---");
  const renderCtx = {
    env: "test",
    namespace: "smoke-test-ns",
    logger: {
      info: (...args: any[]) => console.log("[RenderEngine INFO]:", ...args),
      error: (...args: any[]) => console.error("[RenderEngine ERROR]:", ...args),
      warn: (...args: any[]) => console.warn("[RenderEngine WARN]:", ...args),
    },
    eventBus: {
      publish: async (evt: any) => {
        console.log(`[EventBus Publish]: ${evt.name}`);
      }
    },
    compositionEngine: {
      getHistory: () => [
        {
          requestId: "smoke-test-composition",
          timeline: customTimeline
        }
      ]
    }
  };

  // Temp directory cleanup disabled inside RenderEngine.ts directly

  const renderer = new RenderEngine(renderCtx);
  await renderer.initialize();
  await renderer.start();

  const outputPath = path.join(workspaceRoot, "storage", "media", "smoke-test-output.mp4");
  if (fs.existsSync(outputPath)) {
    fs.rmSync(outputPath, { force: true });
  }

  const renderRequest = {
    id: "smoke-test-render",
    compositionId: "smoke-test-composition",
    format: ExportFormat.MP4,
    resolution: Resolution.P1080,
    quality: QualityPreset.STANDARD,
    codec: CodecType.H264,
    fps: 24,
    state: RenderingState.CREATED,
    timestamp: new Date(),
    options: {
      outputPath: outputPath
    }
  };

  // 6. Run Render
  console.log("\n--- STEP 6: EXECUTING PROGRAMMATIC RENDER ---");
  let renderResponse;
  try {
    renderResponse = await renderer.render(renderRequest);
  } catch (err: any) {
    console.error("Render failed:", err.message);
    process.exit(1);
  }

  console.log("\n--- STEP 7: VALIDATING RENDERED MP4 ---");
  if (!fs.existsSync(outputPath)) {
    console.error("  ✗ Final MP4 file was not created!");
    process.exit(1);
  }

  const stats = fs.statSync(outputPath);
  console.log(`  ✓ File exists: ${outputPath}`);
  console.log(`  ✓ File size: ${stats.size} bytes (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);

  // Decode verification using FFmpeg
  try {
    console.log("Running FFmpeg decode check...");
    execSync(`ffmpeg -v error -y -i "${outputPath}" -f null -`, { stdio: "inherit" });
    console.log("  ✓ Decode check passed: MP4 can be fully opened and decoded without errors!");
  } catch (err: any) {
    console.error("  ✗ Decode check failed: File is corrupt or cannot be read.", err.message);
    process.exit(1);
  }
}

runSmokeTest().catch(err => {
  console.error("Smoke test execution failed:", err);
  process.exit(1);
});
