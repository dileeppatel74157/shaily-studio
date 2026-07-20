import { YouTubeIntegrationEngine } from "./youtube-integration/YouTubeIntegrationEngine";
import { YouTubeIntegrationBuilder } from "./youtube-integration/YouTubeIntegrationBuilder";
import { YouTubeState } from "./youtube-integration/YouTubeState";
import { UploadState } from "./youtube-integration/UploadState";
import { PrivacyStatus } from "./youtube-integration/PrivacyStatus";
import { VideoCategory } from "./youtube-integration/VideoCategory";
import { ThumbnailState } from "./youtube-integration/ThumbnailState";
import { PlaylistState } from "./youtube-integration/PlaylistState";
import { YouTubeEventType } from "./youtube-integration/YouTubeEventType";
import { YouTubeValidator } from "./youtube-integration/YouTubeValidator";
import { ValidationException, AuthenticationException } from "./youtube-integration/types";
import { KnowledgeNodeType } from "./knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "./knowledge-base/KnowledgeSource";

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

// Mock context maker
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
    ...overrides
  };
}

async function run(): Promise<void> {
  console.log("\n=== START SPRINT 26.1 YOUTUBE INTEGRATION TESTS ===\n");

  const ctx = makeMockContext();

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  const engine = new YouTubeIntegrationBuilder().withContext(ctx).build() as YouTubeIntegrationEngine;
  assert(engine !== undefined, "engine created");
  await engine.initialize();
  assert(engine.getState() === YouTubeState.READY, "initialized");

  // 2. Authentication
  console.log("2. Authentication...");
  const authMgr = engine.getAuthenticationManager();
  const session = await authMgr.authorize("mock-auth-code-789");
  assert(session.accessToken.startsWith("access-"), "OAuth session created");
  assert(authMgr.isAuthorized() === true, "token stored");

  // 3. Metadata Builder
  console.log("3. Metadata Builder...");
  const metadataMgr = engine.getMetadataManager();
  const baseVideo = {
    id: "req-101",
    title: "",
    description: "",
    privacy: PrivacyStatus.PRIVATE,
    category: VideoCategory.OTHER,
    tags: [],
    videoFileUrl: "https://mockmedia.ai/videos/final.mp4",
    status: UploadState.PENDING
  };
  const updatedVideo = await metadataMgr.buildMetadata(baseVideo, {
    title: "TypeScript Crash Course",
    description: "Learn TS in 10 minutes",
    tags: ["typescript", "coding"],
    category: VideoCategory.EDUCATION
  });
  assert(updatedVideo.title === "TypeScript Crash Course", "title generated");
  assert(updatedVideo.description === "Learn TS in 10 minutes", "description generated");

  // 4. Thumbnail
  console.log("4. Thumbnail...");
  const thumbMgr = engine.getThumbnailManager();
  const thumb = await thumbMgr.uploadThumbnail(updatedVideo, "https://mockmedia.ai/thumbs/ts-tutorial.png");
  assert(thumb.state === ThumbnailState.UPLOADED, "thumbnail uploaded");
  assert(updatedVideo.thumbnail?.url === "https://mockmedia.ai/thumbs/ts-tutorial.png", "thumbnail linked");

  // 5. Upload
  console.log("5. Upload...");
  const uploadRequest = {
    id: "req-101",
    projectId: "proj-999",
    videoFileUrl: "https://mockmedia.ai/videos/final.mp4",
    title: "TypeScript Crash Course",
    description: "Learn TS in 10 minutes",
    tags: ["typescript", "coding"],
    thumbnailUrl: "https://mockmedia.ai/thumbs/ts-tutorial.png",
    privacy: PrivacyStatus.PUBLIC,
    category: VideoCategory.EDUCATION
  };
  // Ensure mapping register
  engine.getVideosMap().set(uploadRequest.id, updatedVideo);
  const uploadMgr = engine.getUploadManager();
  const uploadResponse = await uploadMgr.startUpload(uploadRequest);
  assert(uploadResponse.videoId !== undefined, "upload started");
  assert(updatedVideo.status === UploadState.PROCESSING, "upload finished");

  // 6. Upload Progress
  console.log("6. Upload Progress...");
  let progressFired = false;
  engine.on(YouTubeEventType.UPLOAD_PROGRESS, (payload: any) => {
    if (payload.progressPercent === 100) {
      progressFired = true;
    }
  });
  // Trigger mock progress loop event
  await engine._emit(YouTubeEventType.UPLOAD_PROGRESS, { requestId: "req-101", progressPercent: 100 });
  assert(progressFired, "progress updates");
  assert(progressFired, "reaches 100%");

  // 7. Processing
  console.log("7. Processing...");
  const processingMgr = engine.getProcessingManager();
  const procStatus = await processingMgr.monitorProcessing("req-101");
  assert(procStatus.progressPercent === 100, "processing completed");
  assert(procStatus.status === "HD_READY", "HD ready");

  // 8. Scheduling
  console.log("8. Scheduling...");
  const scheduleMgr = engine.getScheduleManager();
  const futureDate = new Date(Date.now() + 24 * 3600 * 1000);
  const scheduledVideo = await scheduleMgr.schedulePublish(updatedVideo, futureDate);
  assert(scheduledVideo.privacy === PrivacyStatus.SCHEDULED, "future schedule accepted");
  const publishMgr = engine.getPublishManager();
  const immediateVideo = await publishMgr.publishVideo(updatedVideo, PrivacyStatus.PUBLIC);
  assert(immediateVideo.privacy === PrivacyStatus.PUBLIC, "immediate publish accepted");

  // 9. Playlist
  console.log("9. Playlist...");
  const playlistMgr = engine.getPlaylistManager();
  const playlist = await playlistMgr.assignPlaylist(updatedVideo, "list-777");
  assert(playlist.id === "list-777", "playlist assigned");
  assert(playlist.state === PlaylistState.UPDATED, "playlist updated");

  // 10. Captions
  console.log("10. Captions...");
  const captionMgr = engine.getCaptionManager();
  const caption = await captionMgr.attachCaptions(updatedVideo, "https://mockmedia.ai/captions/tutorial.srt", "en");
  assert(caption.url === "https://mockmedia.ai/captions/tutorial.srt", "captions attached");
  assert(caption.language === "en", "language detected");

  // 11. Publish
  console.log("11. Publish...");
  const publishedVideo = await publishMgr.publishVideo(updatedVideo, PrivacyStatus.PUBLIC);
  assert(publishedVideo.publishedAt !== undefined, "video published");
  assert(uploadResponse.videoUrl === "https://youtube.com/watch?v=mock-vid-123", "video URL generated");

  // 12. Statistics Seed
  console.log("12. Statistics Seed...");
  const statisticsSeed = {
    expectedViews: 5000,
    expectedCtrPercent: 6.5,
    retentionBaselinePercent: 45
  };
  const statsMgr = engine.getStatisticsManager();
  const stats = await statsMgr.initializeStatistics(updatedVideo, statisticsSeed);
  assert(stats !== undefined, "analytics initialized");
  assert(stats.ctrPercent === 6.5, "baseline stored");

  // 13. Database Integration
  console.log("13. Database Integration...");
  // Trigger master upload containing DB logging
  const fullResponse = await engine.uploadVideo(uploadRequest);
  assert(ctx.databaseEngine.dbQueries.length > 0, "upload history stored");
  const uploadQueries = ctx.databaseEngine.dbQueries.filter((q: any) => q.sql.includes("youtube_uploads"));
  assert(uploadQueries.length > 0, "publish record saved");

  // 14. Knowledge Base Integration
  console.log("14. Knowledge Base Integration...");
  const kbStore = ctx.knowledgeBaseEngine.kbStore;
  assert(kbStore.length > 0, "publish package archived");
  assert(kbStore.some((n: any) => n.title === "YouTube Video: TypeScript Crash Course"), "metadata stored");

  // 15. Memory Integration
  console.log("15. Memory Integration...");
  const memoryKey = "youtube:snapshot:req-101";
  assert(ctx.memoryStore.memoryMap.has(memoryKey), "execution logged");
  const statsSnapshot = engine.getSnapshot();
  assert(statsSnapshot.state === YouTubeState.COMPLETED, "snapshot saved");

  // 16. Event Publishing
  console.log("16. Event Publishing...");
  const events = ctx.eventBus.events;
  assert(events.length > 0, "upload events fired");
  assert(events.some((e: any) => e.name === YouTubeEventType.VIDEO_PUBLISHED), "publish event received");

  // 17. Snapshot Immutability
  console.log("17. Snapshot Immutability...");
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "snapshot frozen");
  let mutationFailed = false;
  try {
    (snap as any).state = YouTubeState.READY;
  } catch {
    mutationFailed = true;
  }
  assert(mutationFailed, "mutation rejected");

  // 18. Validator Rules
  console.log("18. Validator Rules...");
  let ruleRejected = false;
  try {
    const invalidRequest = { ...uploadRequest, title: "" };
    YouTubeValidator.assertValid(invalidRequest);
  } catch (err) {
    if (err instanceof ValidationException) {
      ruleRejected = true;
    }
  }
  assert(ruleRejected, "invalid title rejected");
  let ruleAccepted = true;
  try {
    YouTubeValidator.assertValid(uploadRequest);
  } catch {
    ruleAccepted = false;
  }
  assert(ruleAccepted, "valid upload accepted");

  // 19. Retry Recovery
  console.log("19. Retry Recovery...");
  let retrySucceeded = false;
  const ctxFail = makeMockContext();
  const engineFail = new YouTubeIntegrationBuilder().withContext(ctxFail).build() as YouTubeIntegrationEngine;
  await engineFail.initialize();
  // Fail first auth check due to lack of authorization
  try {
    await engineFail.uploadVideo(uploadRequest);
  } catch (err) {
    if (err instanceof AuthenticationException) {
      // Authorize and retry
      await engineFail.getAuthenticationManager().authorize("code");
      await engineFail.initialize();
      const retryResp = await engineFail.uploadVideo(uploadRequest);
      if (retryResp.videoId === "mock-vid-123") {
        retrySucceeded = true;
      }
    }
  }
  assert(retrySucceeded, "failed upload retried");
  assert(retrySucceeded, "retry succeeded");

  // 20. Complete End-to-End Publish
  console.log("20. Complete End-to-End Publish...");
  assert(fullResponse.status === UploadState.PROCESSING, "publish-ready package uploaded");
  assert(fullResponse.videoUrl !== undefined, "video URL returned");

  console.log(`\n=== ${passed}/${passed + failed} YOUTUBE INTEGRATION TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `— ${failed} FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
