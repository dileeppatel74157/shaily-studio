import {
  MediaProviderBuilder,
  MediaProviderValidator,
  MediaProviderEngine,
  MediaProviderState,
  MediaProviderType,
  MediaType,
  GenerationMode,
  MediaQuality,
  ProcessingState,
  MediaEventType,
  ProviderHealth,
  MediaValidationResult
} from "./media-provider";
import { ProviderConfiguration } from "./media-provider/models";

const ctx = { env: "test", namespace: "shaily-studio" };

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

// Mock provider configurations
const openAiConfig: ProviderConfiguration = {
  provider: MediaProviderType.OPENAI,
  apiKey: "sk-openai-media-key-123",
  capabilities: {
    provider: MediaProviderType.OPENAI,
    supportedTypes: [MediaType.IMAGE, MediaType.EDIT, MediaType.UPSCALE],
    supportedModes: [GenerationMode.TEXT_TO_IMAGE, GenerationMode.IMAGE_TO_IMAGE, GenerationMode.UPSCALE],
    supportedQualities: [MediaQuality.MEDIUM, MediaQuality.HIGH],
    supportsStreaming: false
  }
};

const runwayConfig: ProviderConfiguration = {
  provider: MediaProviderType.RUNWAY,
  apiKey: "runway-key-456",
  capabilities: {
    provider: MediaProviderType.RUNWAY,
    supportedTypes: [MediaType.VIDEO],
    supportedModes: [GenerationMode.TEXT_TO_VIDEO, GenerationMode.IMAGE_TO_VIDEO],
    supportedQualities: [MediaQuality.HIGH, MediaQuality.ULTRA],
    supportsStreaming: true
  }
};

const elevenLabsConfig: ProviderConfiguration = {
  provider: MediaProviderType.ELEVENLABS,
  apiKey: "eleven-labs-key-789",
  capabilities: {
    provider: MediaProviderType.ELEVENLABS,
    supportedTypes: [MediaType.VOICE],
    supportedModes: [GenerationMode.TEXT_TO_SPEECH],
    supportedQualities: [MediaQuality.HIGH],
    supportsStreaming: true
  }
};

const whisperConfig: ProviderConfiguration = {
  provider: MediaProviderType.WHISPER,
  apiKey: "whisper-key-321",
  capabilities: {
    provider: MediaProviderType.WHISPER,
    supportedTypes: [MediaType.TRANSCRIPTION, MediaType.SUBTITLE],
    supportedModes: [GenerationMode.SPEECH_TO_TEXT],
    supportedQualities: [MediaQuality.MEDIUM],
    supportsStreaming: false
  }
};

const sunoConfig: ProviderConfiguration = {
  provider: MediaProviderType.SUNO,
  apiKey: "suno-key-654",
  capabilities: {
    provider: MediaProviderType.SUNO,
    supportedTypes: [MediaType.MUSIC],
    supportedModes: [GenerationMode.TEXT_TO_MUSIC],
    supportedQualities: [MediaQuality.HIGH],
    supportsStreaming: false
  }
};

const musicGenConfig: ProviderConfiguration = {
  provider: MediaProviderType.MUSICGEN,
  apiKey: "musicgen-key-987",
  capabilities: {
    provider: MediaProviderType.MUSICGEN,
    supportedTypes: [MediaType.SFX],
    supportedModes: [GenerationMode.TEXT_TO_SFX],
    supportedQualities: [MediaQuality.MEDIUM],
    supportsStreaming: false
  }
};

async function run(): Promise<void> {
  console.log("\n=== START SPRINT 24.2 MEDIA PROVIDER TESTS ===\n");

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  const builderEngine = new MediaProviderBuilder()
    .withContext(ctx)
    .withProvider(openAiConfig)
    .build() as MediaProviderEngine;
  assert(builderEngine !== undefined, "MediaProviderEngine built successfully");

  // 2. Lifecycle Transitions
  console.log("2. Lifecycle Transitions...");
  const engine = new MediaProviderEngine(ctx);
  assert(engine.getState() === MediaProviderState.CREATED, "Initial state is CREATED");
  await engine.initialize();
  assert(engine.getState() === MediaProviderState.READY, "State after initialize() is READY");

  // 3. Provider Registration
  console.log("3. Provider Registration...");
  const regOpenAI = await engine.getProviderManager().registerProvider(openAiConfig);
  await engine.getProviderManager().registerProvider(runwayConfig);
  await engine.getProviderManager().registerProvider(elevenLabsConfig);
  await engine.getProviderManager().registerProvider(whisperConfig);
  await engine.getProviderManager().registerProvider(sunoConfig);
  await engine.getProviderManager().registerProvider(musicGenConfig);
  assert(regOpenAI !== undefined, "OpenAI registered");
  assert(regOpenAI.state === MediaProviderState.READY, "OpenAI ready");

  // 4. Provider Removal
  console.log("4. Provider Removal...");
  const tempConfig: ProviderConfiguration = {
    provider: MediaProviderType.FLUX,
    apiKey: "flux-test-key",
    capabilities: {
      provider: MediaProviderType.FLUX,
      supportedTypes: [MediaType.IMAGE],
      supportedModes: [GenerationMode.TEXT_TO_IMAGE],
      supportedQualities: [MediaQuality.ULTRA],
      supportsStreaming: false
    }
  };
  await engine.getProviderManager().registerProvider(tempConfig);
  assert(engine.getProviderManager().getProvider(MediaProviderType.FLUX) !== undefined, "Flux registered");
  await engine.getProviderManager().unregisterProvider(MediaProviderType.FLUX);
  assert(engine.getProviderManager().getProvider(MediaProviderType.FLUX) === undefined, "Flux unregistered");

  // 5. Image Generation
  console.log("5. Image Generation...");
  const imageResp = await engine.getImageManager().generateImage({
    id: "req-image-1",
    mode: GenerationMode.TEXT_TO_IMAGE,
    prompt: "A beautiful futuristic city",
    size: "1024x1024"
  });
  assert(imageResp.assets.length === 1, "Image response contains 1 asset");
  assert(imageResp.assets[0].type === MediaType.IMAGE, "Asset type is IMAGE");

  // 6. Image Editing
  console.log("6. Image Editing...");
  const editResp = await engine.getImageManager().editImage({
    id: "req-image-edit-1",
    mode: GenerationMode.IMAGE_TO_IMAGE,
    prompt: "Add flying cars"
  });
  assert(editResp.assets.length === 1, "Edit response contains 1 asset");
  assert(editResp.assets[0].url.includes("edited"), "Asset URL indicates edited");

  // 7. Image Upscaling
  console.log("7. Image Upscaling...");
  const upscaleResp = await engine.getImageManager().upscaleImage({
    id: "req-image-upscale-1",
    assetUrl: "https://mockmedia.ai/images/edited-123.png",
    scaleFactor: 4,
    type: "image"
  });
  assert(upscaleResp.assets.length === 1, "Upscale response contains 1 asset");
  assert(upscaleResp.assets[0].url.includes("upscaled"), "Asset URL indicates upscaled");

  // 8. Video Generation
  console.log("8. Video Generation...");
  const videoResp = await engine.getVideoManager().generateVideo({
    id: "req-video-1",
    mode: GenerationMode.TEXT_TO_VIDEO,
    prompt: "A walking astronaut",
    durationSeconds: 5,
    fps: 30,
    resolution: "1080p"
  });
  assert(videoResp.assets.length === 1, "Video response contains 1 asset");
  assert(videoResp.assets[0].type === MediaType.VIDEO, "Asset type is VIDEO");
  assert(videoResp.assets[0].durationSeconds === 5, "Video duration is 5s");

  // 9. Image-to-Video
  console.log("9. Image-to-Video...");
  const i2vResp = await engine.getVideoManager().imageToVideo({
    id: "req-video-i2v-1",
    mode: GenerationMode.IMAGE_TO_VIDEO,
    prompt: "Make the water flow",
    inputImage: "https://mockmedia.ai/images/edited-123.png",
    durationSeconds: 5
  });
  assert(i2vResp.assets.length === 1, "Image-to-video response contains 1 asset");
  assert(i2vResp.assets[0].url.includes("i2v"), "Asset URL indicates image-to-video");

  // 10. Text-to-Speech
  console.log("10. Text-to-Speech...");
  const ttsResp = await engine.getVoiceManager().textToSpeech({
    id: "req-tts-1",
    text: "Hello and welcome to Shaily Studio.",
    voiceId: "voice-rachel-123",
    languageCode: "en-US"
  });
  assert(ttsResp.audioUrl !== undefined, "TTS response contains audioUrl");
  assert(ttsResp.durationSeconds > 0, "TTS duration is greater than 0");

  // 11. Speech-to-Text
  console.log("11. Speech-to-Text...");
  const sttResp = await engine.getVoiceManager().speechToText({
    id: "req-stt-1",
    audioUrl: "https://mockmedia.ai/voices/123.mp3",
    format: "srt"
  });
  assert(sttResp.content.includes("Hello and welcome"), "Transcription matches voice input");
  assert(sttResp.subtitleUrl.endsWith(".srt"), "SRT subtitle file generated");

  // 12. Music Generation
  console.log("12. Music Generation...");
  const musicResp = await engine.getMusicManager().generateMusic({
    id: "req-music-1",
    mode: GenerationMode.TEXT_TO_MUSIC,
    prompt: "Upbeat electronic background music",
    durationSeconds: 30
  });
  assert(musicResp.assets.length === 1, "Music response contains 1 asset");
  assert(musicResp.assets[0].type === MediaType.MUSIC, "Asset type is MUSIC");

  // 13. SFX Generation
  console.log("13. SFX Generation...");
  const sfxResp = await engine.getMusicManager().generateSfx({
    id: "req-sfx-1",
    mode: GenerationMode.TEXT_TO_SFX,
    prompt: "Laser beam blast",
    durationSeconds: 3
  });
  assert(sfxResp.assets.length === 1, "SFX response contains 1 asset");
  assert(sfxResp.assets[0].type === MediaType.SFX, "Asset type is SFX");

  // 14. Usage Tracking
  console.log("14. Usage Tracking...");
  const usage = engine.getUsageManager().getUsage();
  assert(usage.imagesGenerated === 3, "Total generated images tracked (3)");
  assert(usage.videosGenerated === 10, "Total generated video seconds tracked (10s)");

  // 15. Health Monitoring
  console.log("15. Health Monitoring...");
  const healthReport = await engine.getHealthManager().checkHealth(MediaProviderType.OPENAI);
  assert(healthReport.status === ProviderHealth.HEALTHY, "OpenAI provider is HEALTHY");

  // 16. Runtime Integration
  console.log("16. Runtime Integration...");
  const snapshot = engine.getSnapshot();
  assert(snapshot.state === MediaProviderState.READY, "Engine state is READY in snapshot");
  assert(Object.isFrozen(snapshot), "Snapshot object is frozen");

  // 17. Event Publishing
  console.log("17. Event Publishing...");
  let requestStartedFired = false;
  engine.getEventManager().on(MediaEventType.REQUEST_STARTED, () => { requestStartedFired = true; });
  await engine.getImageManager().generateImage({
    id: "req-event-test",
    mode: GenerationMode.TEXT_TO_IMAGE,
    prompt: "Event test"
  });
  assert(requestStartedFired, "REQUEST_STARTED event captured");

  // 18. Snapshot Immutability
  console.log("18. Snapshot Immutability...");
  const snap = engine.getSnapshot();
  let threw = false;
  try {
    (snap as any).state = MediaProviderState.FAILED;
  } catch {
    threw = true;
  }
  assert(threw || snap.state === MediaProviderState.READY, "Mutation rejected");

  // 19. Validator Rules
  console.log("19. Validator Rules...");
  let validatorThrew = false;
  try {
    MediaProviderValidator.validateDuration(-5);
  } catch {
    validatorThrew = true;
  }
  assert(validatorThrew, "Validator rejects negative duration");

  const report = MediaProviderValidator.generateReport(openAiConfig);
  assert(report.valid, "Valid config produces valid validation report");

  // 20. Complete End-to-End Media Provider Lifecycle
  console.log("20. Complete End-to-End Media Provider Lifecycle...");
  const finalStats = engine.getUsageManager().getStatistics();
  assert(finalStats.totalRequests > 0, "Total generated assets tracked");
  assert(finalStats.successfulRequests > 0, "Provider statistics updated");

  // final shutdown
  engine.getProviderManager().setProviderState(MediaProviderType.OPENAI, MediaProviderState.STOPPED);
  assert(engine.getProviderManager().getProvider(MediaProviderType.OPENAI)?.state === MediaProviderState.STOPPED, "Stopped state verified");

  console.log(`\n=== ${passed}/${passed + failed} MEDIA PROVIDER TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `— ${failed} FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
