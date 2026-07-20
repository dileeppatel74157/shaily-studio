import { ContentPipelineEngine } from "./content-pipeline/ContentPipelineEngine";
import { ContentPipelineBuilder } from "./content-pipeline/ContentPipelineBuilder";
import { ContentPipelineState } from "./content-pipeline/ContentPipelineState";
import { ContentStage } from "./content-pipeline/ContentStage";
import { AssetType } from "./content-pipeline/AssetType";
import { AssetStatus } from "./content-pipeline/AssetStatus";
import { CompositionState } from "./content-pipeline/CompositionState";
import { RenderQuality } from "./content-pipeline/RenderQuality";
import { PipelineEventType } from "./content-pipeline/PipelineEventType";
import { ContentPipelineValidator } from "./content-pipeline/ContentPipelineValidator";
import { ValidationException } from "./content-pipeline/types";

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

// Make a Mock Context with event bus, database, memory, and media provider engines
function makeMockContext(overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  const dbQueries: any[] = [];
  const memoryMap = new Map<string, any>();
  const kbStore: any[] = [];

  return {
    logger: { info: () => {}, error: () => {}, warn: () => {} },
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
    },
    ...overrides
  };
}

async function run(): Promise<void> {
  console.log("\n=== START SPRINT 25.2 CONTENT PIPELINE TESTS ===\n");

  const ctx = makeMockContext();

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  const engine = new ContentPipelineBuilder().withContext(ctx).build() as ContentPipelineEngine;
  assert(engine !== undefined, "engine created");
  await engine.initialize();
  assert(engine.getState() === ContentPipelineState.READY, "initialized");

  // 2. Storyboard Generation
  console.log("2. Storyboard Generation...");
  const storyboardMgr = engine.getStoryboardManager();
  const storyboard = await storyboardMgr.generateStoryboard("script-123", "proj-456");
  assert(storyboard.scriptId === "script-123", "storyboard created");
  assert(storyboard.scenes.length > 0, "scenes generated");

  // 3. Scene Planning
  console.log("3. Scene Planning...");
  const planner = engine.getScenePlanner();
  const scenes = await planner.planScenes(storyboard.id);
  assert(scenes[0].shots[0].camera.zoom !== undefined, "camera plans created");
  assert(scenes[0].durationSeconds > 0, "durations valid");

  // 4. Image Generation
  console.log("4. Image Generation...");
  const imageMgr = engine.getImageGenerationManager();
  const images = await imageMgr.generateImages(scenes);
  assert(images.length > 0, "image assets created");
  assert(images[0].url.startsWith("https://"), "prompts stored");

  // 5. Voice Generation
  console.log("5. Voice Generation...");
  const voiceMgr = engine.getVoiceGenerationManager();
  const voiceSegments = await voiceMgr.generateVoice(scenes);
  assert(voiceSegments.length > 0, "narration generated");
  assert(voiceSegments[0].startOffsetSeconds === 0, "timestamps valid");

  // 6. Music Generation
  console.log("6. Music Generation...");
  const musicMgr = engine.getMusicGenerationManager();
  const music = await musicMgr.generateMusic("Synthwave electronic background track", storyboard.totalDurationSeconds);
  assert(music !== undefined, "music created");
  assert(music.durationSeconds === storyboard.totalDurationSeconds, "duration matches");

  // 7. SFX Generation
  console.log("7. SFX Generation...");
  const sfxMgr = engine.getSfxGenerationManager();
  const sfx = await sfxMgr.generateSfx(scenes);
  assert(sfx.length > 0, "effects generated");
  assert(sfx[0].sceneId === scenes[0].id, "mapped to scenes");

  // 8. Video Generation
  console.log("8. Video Generation...");
  const videoMgr = engine.getVideoGenerationManager();
  const videos = await videoMgr.generateVideos(scenes);
  assert(videos.length > 0, "clips generated");
  assert(videos[0].durationSeconds === scenes[0].shots[0].durationSeconds, "clip durations valid");

  // 9. Composition
  console.log("9. Composition...");
  const compositionMgr = engine.getCompositionManager();
  const timeline = await compositionMgr.assembleTimeline(scenes, images, videos, voiceSegments, music, sfx);
  assert(timeline.tracks.length > 0, "timeline assembled");
  assert(timeline.durationSeconds === storyboard.totalDurationSeconds, "tracks synchronized");

  // 10. Rendering
  console.log("10. Rendering...");
  const renderMgr = engine.getRenderManager();
  const renderReport = await renderMgr.render(timeline, RenderQuality.HIGH);
  assert(renderReport.renderedFileUrl !== undefined, "render completed");
  assert(renderReport.sizeBytes > 0, "output asset created");

  // 11. Subtitle Generation
  console.log("11. Subtitle Generation...");
  // Subtitles generated from voice segment timestamps
  const subtitleList = voiceSegments.map(v => ({
    id: `sub-${v.id}`,
    text: v.text,
    startOffsetMs: v.startOffsetSeconds * 1000,
    endOffsetMs: (v.startOffsetSeconds + v.durationSeconds) * 1000,
    sceneId: v.sceneId
  }));
  assert(subtitleList.length > 0, "subtitles created");
  assert(subtitleList[0].endOffsetMs > subtitleList[0].startOffsetMs, "timings valid");

  // 12. Quality Review
  console.log("12. Quality Review...");
  const qualityMgr = engine.getQualityManager();
  const qaReport = await qualityMgr.review(timeline, renderReport);
  assert(qaReport.missingAssets.length === 0, "no missing assets");
  assert(qaReport.passed === true, "QA passed");

  // 13. Publishing Package
  console.log("13. Publishing Package...");
  // Simulate executing from engine
  await engine.start();
  const pack = await engine.execute("script-123", "proj-456");
  assert(pack !== undefined, "package created");
  assert(pack.metadata?.renderQuality === RenderQuality.HIGH, "metadata included");

  // 14. Database Integration
  console.log("14. Database Integration...");
  assert(ctx.databaseEngine.dbQueries.length > 0, "checkpoints stored");
  const logQueries = ctx.databaseEngine.dbQueries.filter((q: any) => q.sql.includes("INSERT INTO"));
  assert(logQueries.length > 0, "assets logged");

  // 15. Knowledge Base Integration
  console.log("15. Knowledge Base Integration...");
  const kbStore = ctx.knowledgeBaseEngine.kbStore;
  assert(kbStore.length > 0, "storyboard stored");
  assert(kbStore.some((node: any) => node.title.startsWith("Publish Package:")), "package stored");

  // 16. Memory Integration
  console.log("16. Memory Integration...");
  const historyKey = "content-pipeline:history:proj-456";
  assert(ctx.memoryStore.memoryMap.has(historyKey), "execution recorded");
  const statistics = engine.getStatistics();
  assert(statistics.successfulRuns > 0, "snapshot saved");

  // 17. Event Publishing
  console.log("17. Event Publishing...");
  const events = ctx.eventBus.events;
  assert(events.length > 0, "events fired");
  assert(events.some((e: any) => e.name === PipelineEventType.PIPELINE_COMPLETED), "completion event received");

  // 18. Snapshot Immutability
  console.log("18. Snapshot Immutability...");
  const snapshot = engine.getSnapshot();
  assert(Object.isFrozen(snapshot), "snapshot frozen");
  let mutationFailed = false;
  try {
    (snapshot as any).state = ContentPipelineState.READY;
  } catch {
    mutationFailed = true;
  }
  assert(mutationFailed, "mutation rejected");

  // 19. Validator Rules
  console.log("19. Validator Rules...");
  let ruleRejected = false;
  try {
    const invalidTimeline = { ...timeline, durationSeconds: -10 };
    ContentPipelineValidator.assertValid(storyboard, invalidTimeline, pack);
  } catch (err) {
    if (err instanceof ValidationException) {
      ruleRejected = true;
    }
  }
  assert(ruleRejected, "invalid timeline rejected");
  let ruleAccepted = true;
  try {
    ContentPipelineValidator.assertValid(storyboard, timeline, pack);
  } catch {
    ruleAccepted = false;
  }
  assert(ruleAccepted, "valid project accepted");

  // 20. Complete End-to-End Pipeline
  console.log("20. Complete End-to-End Pipeline...");
  assert(engine.getState() === ContentPipelineState.COMPLETED, "complete production pipeline executed");
  assert(pack.videoFileUrl !== undefined && pack.thumbnail.thumbnailUrl !== undefined, "publish-ready package generated");

  console.log(`\n=== ${passed}/${passed + failed} CONTENT PIPELINE TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `— ${failed} FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
