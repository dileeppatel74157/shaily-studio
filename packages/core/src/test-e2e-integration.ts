import { FounderEngine } from "./founder/FounderEngine";
import { ResearchEngine } from "./research/ResearchEngine";
import { StrategyEngine } from "./strategy/StrategyEngine";
import { ScriptEngine } from "./script/ScriptEngine";
import { ProductionEngine } from "./production/ProductionEngine";
import { MediaProviderEngine } from "./media-provider/MediaProviderEngine";
import { VideoCompositionEngine } from "./video-composition/VideoCompositionEngine";
import { RenderEngine } from "./rendering/RenderEngine";
import { QualityEngine } from "./quality/QualityEngine";
import { YouTubeIntegrationEngine } from "./youtube-integration/YouTubeIntegrationEngine";
import { AnalyticsEngine } from "./analytics/AnalyticsEngine";
import { LearningEngine } from "./learning/LearningEngine";

import { DatabaseBuilder } from "./database/DatabaseBuilder";
import { DatabaseProvider } from "./database/DatabaseProvider";
import { MemoryStore } from "./memory/index";
import { EventBus } from "./events/index";
import { LoggerBuilder, JsonFormatter } from "./logger/index";
import { ConfigBuilder, MemorySource } from "./config/index";
import { ServiceRegistry } from "./registry/index";

// Import types/enums
import { ResearchType } from "./research/ResearchType";
import { TrendType } from "./research/TrendType";
import { StrategyType } from "./strategy/StrategyType";
import { ContentPriority } from "./strategy/ContentPriority";
import { ScriptType } from "./script/ScriptType";
import { GenerationMode } from "./media-provider/GenerationMode";
import { MediaType } from "./media-provider/MediaType";
import { MediaProviderType } from "./media-provider/MediaProviderType";
import { PrivacyStatus } from "./youtube-integration/PrivacyStatus";
import { VideoCategory } from "./youtube-integration/VideoCategory";
import { ExportFormat } from "./rendering/ExportFormat";
import { Resolution } from "./rendering/Resolution";
import { QualityPreset } from "./rendering/QualityPreset";
import { CodecType } from "./rendering/CodecType";
import { RenderingState } from "./rendering/RenderingState";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("E2E Assertion Failed:", message);
    process.exit(1);
  }
}

class SilentTransport {
  public send(): void {}
}

async function runE2E() {
  console.log("=== START FULL END-TO-END SYSTEM ORCHESTRATION TEST ===");
  delete process.env.DATABASE_URL;

  const logger = new LoggerBuilder()
    .addTransport(new SilentTransport())
    .withFormatter(new JsonFormatter())
    .build();

  const eventBus = new EventBus(logger);
  const memoryStore = new MemoryStore();
  const registry = new ServiceRegistry();
  const config = await new ConfigBuilder({})
    .withSource(new MemorySource({}))
    .build();

  const databaseEngine = new DatabaseBuilder()
    .withContext({ env: "test", namespace: "e2e" })
    .withProvider(DatabaseProvider.SQLITE)
    .withFilePath(":memory:")
    .build();
  await databaseEngine.initialize();

  const ctx = {
    env: "test",
    namespace: "e2e",
    logger,
    eventBus,
    memoryStore,
    registry,
    config,
    database: databaseEngine,
    databaseEngine
  };

  console.log("1. Instantiating all 12 OS Engines...");
  const founderEngine = new FounderEngine(ctx);
  const researchEngine = new ResearchEngine(ctx);
  const strategyEngine = new StrategyEngine(ctx);
  const scriptEngine = new ScriptEngine(ctx);
  const productionEngine = new ProductionEngine(ctx);
  const mediaProviderEngine = new MediaProviderEngine(ctx);
  const videoCompositionEngine = new VideoCompositionEngine(ctx);
  const renderEngine = new RenderEngine(ctx);
  const qualityEngine = new QualityEngine(ctx);
  const youtubeIntegrationEngine = new YouTubeIntegrationEngine(ctx);
  const analyticsEngine = new AnalyticsEngine(ctx);
  const learningEngine = new LearningEngine(ctx);

  console.log("2. Initializing and starting all engines...");
  await founderEngine.initialize();
  await founderEngine.start();

  await researchEngine.initialize();
  await researchEngine.start();

  await strategyEngine.initialize();
  await strategyEngine.start();

  await scriptEngine.initialize();
  await scriptEngine.start();

  await productionEngine.initialize();
  await productionEngine.start();

  await mediaProviderEngine.initialize();
  await mediaProviderEngine.getProviderManager().registerProvider({
    provider: MediaProviderType.OPENAI,
    apiKey: "sk-openai-media-key-123",
    capabilities: {
      provider: MediaProviderType.OPENAI,
      supportedTypes: [MediaType.IMAGE, MediaType.EDIT, MediaType.UPSCALE],
      supportedModes: [GenerationMode.TEXT_TO_IMAGE, GenerationMode.IMAGE_TO_IMAGE, GenerationMode.UPSCALE],
      supportedQualities: [],
      supportsStreaming: false
    }
  });

  await mediaProviderEngine.getProviderManager().registerProvider({
    provider: MediaProviderType.ELEVENLABS,
    apiKey: "eleven-labs-key-789",
    capabilities: {
      provider: MediaProviderType.ELEVENLABS,
      supportedTypes: [MediaType.VOICE],
      supportedModes: [GenerationMode.TEXT_TO_SPEECH],
      supportedQualities: [],
      supportsStreaming: true
    }
  });

  await mediaProviderEngine.getProviderManager().registerProvider({
    provider: MediaProviderType.WHISPER,
    apiKey: "whisper-key-321",
    capabilities: {
      provider: MediaProviderType.WHISPER,
      supportedTypes: [MediaType.TRANSCRIPTION, MediaType.SUBTITLE],
      supportedModes: [GenerationMode.SPEECH_TO_TEXT],
      supportedQualities: [],
      supportsStreaming: false
    }
  });

  await videoCompositionEngine.initialize();
  await videoCompositionEngine.start();

  await renderEngine.initialize();
  await renderEngine.start();

  await qualityEngine.initialize();
  await qualityEngine.start();

  await youtubeIntegrationEngine.initialize();
  await youtubeIntegrationEngine.start();

  await analyticsEngine.initialize();
  await analyticsEngine.start();

  await learningEngine.initialize();
  await learningEngine.start();

  // Step 1: Founder Command Center Setup
  const workspace = founderEngine.getWorkspace();
  assert(workspace !== undefined && workspace.dashboard !== undefined, "Dashboard should be available");

  // Step 2: Research & Insights gathering
  console.log("Step 2: Researching trending topics...");
  const researchRequest = {
    id: "e2e-research-1",
    type: ResearchType.FULL,
    channelProfile: { query: "WebGPU TypeScript Development" },
    options: { depth: 2, maxResults: 10 }
  };
  const researchRes = await researchEngine.execute(researchRequest as any);
  assert(researchRes.trendAnalysis !== undefined, "Research should yield trending topics");

  // Step 3: Strategy & Content Calendar formulation
  console.log("Step 3: Creating content strategy pillars and series...");
  const strategyRequest = {
    id: "e2e-strategy-1",
    type: StrategyType.GROWTH,
    researchResponse: researchRes,
    options: { allowCached: false }
  };
  const strategyRes = await strategyEngine.generate(strategyRequest);
  assert(strategyRes.pillars.length > 0, "Strategy should generate content pillars");

  // Step 4: Script drafting
  console.log("Step 4: Writing intelligence script draft...");
  const scriptRes = await scriptEngine.generate({
    id: "e2e-script-1",
    type: ScriptType.TUTORIAL,
    topic: "WebGPU TypeScript Development",
    strategyResponse: strategyRes,
    prompt: "Write a high-performance WebGPU rendering tutorial",
    voiceTone: "Educational",
    maxDurationSeconds: 120
  });
  assert(scriptRes.scenes.length > 0 && scriptRes.dialogue.length > 0, "Script should have scenes and dialogue");

  // Step 5: Production Plan scheduling
  console.log("Step 5: Planning and scheduling production tasks...");
  const productionRes = await productionEngine.generate({
    id: "e2e-plan-1",
    scriptId: "e2e-script-1"
  });
  assert(productionRes.plan !== undefined, "Production planner should generate the plan");

  // Step 6: Media Generation (Image, Audio, Subtitle assets)
  console.log("Step 6: Generating high-quality media assets...");
  const imageRes = await mediaProviderEngine.getImageManager().generateImage({
    id: "e2e-img-1",
    mode: GenerationMode.TEXT_TO_IMAGE,
    prompt: "A beautiful futuristic WebGPU canvas",
    size: "1024x1024"
  });
  const ttsRes = await mediaProviderEngine.getVoiceManager().textToSpeech({
    id: "e2e-tts-1",
    text: "WebGPU represents a massive leap forward for graphics in the browser.",
    voiceId: "voice-rachel-123"
  });
  const subRes = await mediaProviderEngine.getSubtitleManager().generateSubtitles({
    id: "e2e-sub-1",
    audioUrl: ttsRes.audioUrl,
    format: "srt"
  });
  assert(imageRes.assets.length > 0, "Should generate image asset");
  assert(ttsRes.audioUrl !== undefined, "Should generate voice audio URL");
  assert(subRes.subtitleUrl !== undefined, "Should generate subtitle SRT file URL");

  // Step 7: Video timeline composition
  console.log("Step 7: Composing and synchronizing media timeline...");
  const compositionRes = await videoCompositionEngine.compose({
    id: "e2e-comp-1",
    generationResponseId: "e2e-gen-1"
  });
  assert(compositionRes.timeline !== undefined, "Timeline should be constructed");
  const timeline = compositionRes.timeline;

  // Step 8: Rendering
  console.log("Step 8: Rendering the timeline into a final output video file...");
  const renderRes = await renderEngine.render({
    id: "e2e-render-1",
    compositionId: timeline.id,
    format: ExportFormat.MP4,
    resolution: Resolution.P1080,
    quality: QualityPreset.STANDARD,
    codec: CodecType.H264,
    fps: 30,
    state: RenderingState.CREATED,
    timestamp: new Date()
  });
  assert(renderRes.outputPath !== undefined, "Render job should start successfully");

  // Step 9: Quality Assurance check
  console.log("Step 9: Running automated QA check on rendered output...");
  const qaReport = await qualityEngine.review({
    id: "e2e-qa-1",
    renderId: renderRes.id
  });
  assert(qaReport.score.overall >= 0, "QA report should return a valid score");

  // Step 10: YouTube Upload
  console.log("Step 10: Authorizing and uploading video to personal channel...");
  await youtubeIntegrationEngine.getAuthenticationManager().authorize("mock-e2e-auth-code");
  const uploadRes = await youtubeIntegrationEngine.uploadVideo({
    id: "e2e-upload-1",
    projectId: "e2e-proj-123",
    videoFileUrl: "https://shaily.studio/output/e2e-render-1.mp4",
    thumbnailUrl: "https://shaily.studio/output/e2e-thumbnail.png",
    title: "Understanding WebGPU in 2027",
    description: "Deep dive tutorial into WebGPU with TypeScript",
    tags: ["webgpu", "typescript", "graphics"],
    privacy: PrivacyStatus.PUBLIC,
    category: VideoCategory.EDUCATION
  });
  assert(uploadRes.videoUrl !== undefined, "YouTube video upload should yield a URL");

  // Step 11: Analytics gathering
  console.log("Step 11: Initializing and gathering publishing analytics...");
  const videoStats = await youtubeIntegrationEngine.getStatisticsManager().getStatistics(uploadRes.videoId);
  const analyticsSnapshot = await analyticsEngine.getDashboardMetrics();
  assert(videoStats.views !== undefined, "Should fetch view count from YouTube");
  assert(analyticsSnapshot !== undefined, "Should construct analytics snapshot");

  // Step 12: Learning Engine update
  console.log("Step 12: Updating learning feedback loops...");
  const learningRes = await learningEngine.learn(
    {
      id: "e2e-learn-req-1",
      source: "analytics" as any,
      timestamp: new Date()
    },
    [
      {
        id: "e2e-hist-1",
        projectId: "e2e-proj-123",
        source: "analytics" as any,
        success: true,
        durationMs: 2500,
        costUsd: 0.15,
        metrics: { ctrPercent: 7.5, retentionPercent: 60, overallScore: 88 },
        timestamp: new Date()
      }
    ]
  );
  assert(learningRes !== undefined && learningRes.recommendations !== undefined, "Should generate content feedback recommendations");

  console.log("=== ALL 12 PIPELINE ENGINES EXECUTED AND E2E VERIFICATION COMPLETED SUCCESSFULLY ===");
}

runE2E().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
