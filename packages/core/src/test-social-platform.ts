import { SocialPlatformEngine } from "./social-platform/SocialPlatformEngine";
import { SocialPlatformBuilder } from "./social-platform/SocialPlatformBuilder";
import { SocialPlatformState } from "./social-platform/SocialPlatformState";
import { PlatformType } from "./social-platform/PlatformType";
import { PublishState } from "./social-platform/PublishState";
import { ContentType } from "./social-platform/ContentType";
import { VisibilityType } from "./social-platform/VisibilityType";
import { AdapterState } from "./social-platform/AdapterState";
import { SocialEventType } from "./social-platform/SocialEventType";
import { SocialPlatformValidator } from "./social-platform/SocialPlatformValidator";
import { ValidationException, PlatformConnectionException } from "./social-platform/types";
import { RuntimeEngine } from "./runtime/RuntimeEngine";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
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
    env: "test",
    namespace: "social-platform-test",
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
  console.log("\n=== START SPRINT 26.2 SOCIAL PLATFORM INTEGRATION TESTS ===\n");

  const ctx = makeMockContext();

  // 1. Builder Validation
  console.log("1. Builder Validation...");
  const engine = new SocialPlatformBuilder().withContext(ctx).build() as SocialPlatformEngine;
  assert(engine !== undefined, "engine created");
  await engine.initialize();
  assert(engine.getState() === SocialPlatformState.READY, "initialized");

  // 2. Platform Registration
  console.log("2. Platform Registration...");
  const platformMgr = engine.getPlatformManager();
  await platformMgr.registerPlatform(PlatformType.INSTAGRAM, "Instagram Reels");
  await platformMgr.registerPlatform(PlatformType.FACEBOOK, "Facebook Watch");
  assert(platformMgr.getSupportedPlatforms().includes(PlatformType.INSTAGRAM), "Instagram registered");
  assert(platformMgr.getSupportedPlatforms().includes(PlatformType.FACEBOOK), "Facebook registered");

  // 3. Account Connection
  console.log("3. Account Connection...");
  const accountMgr = engine.getAccountManager();
  const accountInsta = {
    id: "acc-101",
    platform: PlatformType.INSTAGRAM,
    username: "shaily_insta",
    displayName: "Shaily Instagram Account",
    accountId: "insta-777",
    authToken: "token-insta-123",
    expiryDate: new Date(Date.now() + 3600 * 1000),
    connectedAt: new Date()
  };
  const accountFb = {
    id: "acc-102",
    platform: PlatformType.FACEBOOK,
    username: "shaily_fb",
    displayName: "Shaily Facebook Page",
    accountId: "fb-888",
    authToken: "token-fb-123",
    expiryDate: new Date(Date.now() + 3600 * 1000),
    connectedAt: new Date()
  };
  await accountMgr.connectAccount(accountInsta);
  await accountMgr.connectAccount(accountFb);
  assert(accountMgr.isAccountConnected(PlatformType.INSTAGRAM) === true, "account connected");
  assert(accountMgr.getConnectedAccounts().some(a => a.platform === PlatformType.FACEBOOK), "token stored");

  // 4. Metadata Generation
  console.log("4. Metadata Generation...");
  const metadataMgr = engine.getMetadataManager();
  const testPost = {
    id: "req-social-123",
    projectId: "proj-social-999",
    platforms: [PlatformType.INSTAGRAM, PlatformType.FACEBOOK],
    contentType: ContentType.REEL,
    caption: { text: "Epic compilation of AI video OS tools", language: "en", charCount: 38 },
    hashtags: { hashtags: ["ai", "video"], count: 2 },
    mentions: { mentions: ["shaily"], count: 1 },
    media: [{ id: "m-1", type: "VIDEO" as const, url: "https://mockmedia.ai/clips/intro.mp4", sizeBytes: 15 * 1024 * 1024 }],
    visibility: VisibilityType.PUBLIC,
    status: PublishState.PENDING,
    platformUrls: {} as any,
    statistics: {} as any,
    retryAttempts: {} as any
  };
  const adapted = await metadataMgr.adaptMetadata(testPost, PlatformType.INSTAGRAM);
  assert(adapted.caption.text === "Epic compilation of AI video OS tools", "caption generated");
  assert(adapted.hashtags.hashtags.includes("ai"), "hashtags generated");

  // 5. Media Validation
  console.log("5. Media Validation...");
  const mediaValidator = engine.getMediaValidator();
  const validMedia = { id: "m-1", url: "https://mockmedia.ai/clips/intro.mp4", sizeBytes: 15 * 1024 * 1024 };
  const invalidMedia = { id: "m-2", url: "", sizeBytes: 500 * 1024 * 1024 }; // size exceeds
  assert(await mediaValidator.validateMedia(validMedia, PlatformType.INSTAGRAM) === true, "valid media accepted");
  assert(await mediaValidator.validateMedia(invalidMedia, PlatformType.INSTAGRAM) === false, "invalid media rejected");

  // 6. Publish
  console.log("6. Publish...");
  const publishRequest = {
    id: "req-social-123",
    projectId: "proj-social-999",
    platforms: [PlatformType.INSTAGRAM, PlatformType.FACEBOOK],
    contentType: ContentType.REEL,
    caption: "Epic compilation of AI video OS tools",
    hashtags: ["ai", "video"],
    mentions: ["shaily"],
    media: [{ id: "m-1", type: "VIDEO" as const, url: "https://mockmedia.ai/clips/intro.mp4", sizeBytes: 15 * 1024 * 1024 }],
    visibility: VisibilityType.PUBLIC
  };
  const publishResponse = await engine.publishContent(publishRequest);
  assert(publishResponse.postId !== undefined, "publish started");
  assert(publishResponse.status === PublishState.PUBLISHED, "publish completed");

  // 7. Multi-platform Publish
  console.log("7. Multi-platform Publish...");
  assert(publishResponse.platformUrls[PlatformType.INSTAGRAM].startsWith("https://instagram.com"), "Instagram published");
  assert(publishResponse.platformUrls[PlatformType.FACEBOOK].startsWith("https://facebook.com"), "Facebook published");

  // 8. Scheduling
  console.log("8. Scheduling...");
  const scheduler = engine.getScheduler();
  const futureTime = new Date(Date.now() + 24 * 3600 * 1000);
  const scheduledPost = await scheduler.schedulePublish(testPost, futureTime);
  assert(scheduledPost.visibility === VisibilityType.SCHEDULED, "future publish accepted");
  const publishMgr = engine.getPublishManager();
  const immediatePost = await publishMgr.getPost("req-social-123");
  assert(immediatePost !== undefined && immediatePost.visibility === VisibilityType.PUBLIC, "immediate publish accepted");

  // 9. Retry Manager
  console.log("9. Retry Manager...");
  const ctxRetry = makeMockContext({ forceInstagramFailure: true });
  const engineRetry = new SocialPlatformBuilder().withContext(ctxRetry).build() as SocialPlatformEngine;
  await engineRetry.initialize();
  await engineRetry.getPlatformManager().registerPlatform(PlatformType.INSTAGRAM, "Instagram Reels");
  await engineRetry.getPlatformManager().registerPlatform(PlatformType.FACEBOOK, "Facebook Watch");
  await engineRetry.getAccountManager().connectAccount(accountInsta);
  await engineRetry.getAccountManager().connectAccount(accountFb);
  // Trigger upload containing retry loop
  const retryResponse = await engineRetry.publishContent(publishRequest);
  assert(retryResponse.platformUrls[PlatformType.INSTAGRAM] !== undefined, "retry triggered");
  assert(retryResponse.status === PublishState.PUBLISHED, "retry succeeded");

  // 10. Analytics Initialization
  console.log("10. Analytics Initialization...");
  const analyticsSeed = {
    expectedImpressions: 2500,
    expectedEngagementRate: 4.8
  };
  const testPostAnalytics = { ...testPost, id: "req-analytics-111" };
  const analyticsMgr = engine.getAnalyticsManager();
  const stats = await analyticsMgr.initializeAnalytics(testPostAnalytics, PlatformType.INSTAGRAM, analyticsSeed);
  assert(stats !== undefined, "analytics created");
  assert(stats.impressions === 2500, "baseline stored");

  // 11. History
  console.log("11. History...");
  const historyMgr = engine.getHistoryManager();
  const histories = await historyMgr.getHistory(publishResponse.postId);
  assert(histories.length > 0, "publish stored");
  assert(histories[0].status === PublishState.PUBLISHED, "lookup succeeds");

  // 12. Database Integration
  console.log("12. Database Integration...");
  assert(ctx.databaseEngine.dbQueries.length > 0, "publish record stored");
  const statsQueries = ctx.databaseEngine.dbQueries.filter((q: any) => q.sql.includes("social_publish_statistics"));
  assert(statsQueries.length > 0, "statistics stored");

  // 13. Knowledge Base Integration
  console.log("13. Knowledge Base Integration...");
  const kbStore = ctx.knowledgeBaseEngine.kbStore;
  assert(kbStore.length > 0, "publish metadata archived");
  assert(kbStore.some((node: any) => node.title === "Social History: req-social-123"), "platform history archived");

  // 14. Memory Integration
  console.log("14. Memory Integration...");
  const memoryKey = "social:snapshot:req-social-123";
  assert(ctx.memoryStore.memoryMap.has(memoryKey), "execution logged");
  const statsSnapshot = engine.getSnapshot();
  assert(statsSnapshot.state === SocialPlatformState.COMPLETED, "snapshot saved");

  // 15. Event Publishing
  console.log("15. Event Publishing...");
  const events = ctx.eventBus.events;
  assert(events.length > 0, "publish events fired");
  assert(events.some((e: any) => e.name === SocialEventType.PUBLISH_COMPLETED), "completion event received");

  // 16. Adapter Management
  console.log("16. Adapter Management...");
  const adapterMgr = engine.getAdapterManager();
  const adapter = adapterMgr.getAdapter(PlatformType.INSTAGRAM);
  assert(adapter !== undefined && adapter.state === AdapterState.READY, "adapter ready");
  assert(adapterMgr.listAdapters().length > 0, "adapter health verified");

  // 17. Snapshot Immutability
  console.log("17. Snapshot Immutability...");
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "snapshot frozen");
  let mutationFailed = false;
  try {
    (snap as any).state = SocialPlatformState.READY;
  } catch {
    mutationFailed = true;
  }
  assert(mutationFailed, "mutation rejected");

  // 18. Validator Rules
  console.log("18. Validator Rules...");
  let ruleRejected = false;
  try {
    const invalidRequest = { ...publishRequest, caption: "  " };
    SocialPlatformValidator.assertValid(invalidRequest, [PlatformType.INSTAGRAM], [PlatformType.INSTAGRAM]);
  } catch (err) {
    if (err instanceof ValidationException) {
      ruleRejected = true;
    }
  }
  assert(ruleRejected, "invalid caption rejected");
  let ruleAccepted = true;
  try {
    SocialPlatformValidator.assertValid(publishRequest, [PlatformType.INSTAGRAM, PlatformType.FACEBOOK], [PlatformType.INSTAGRAM, PlatformType.FACEBOOK]);
  } catch {
    ruleAccepted = false;
  }
  assert(ruleAccepted, "valid publish accepted");

  // 19. Runtime Integration
  console.log("19. Runtime Integration...");
  const rtCtx = makeMockContext();
  const rtEngine = new RuntimeBuilder()
    .withContext(rtCtx)
    .withConfig({
      env: "test",
      heartbeatIntervalMs: 5000,
      healthCheckIntervalMs: 10000,
      startupTimeoutMs: 5000,
      shutdownTimeoutMs: 5000,
      metadata: {}
    })
    .build() as RuntimeEngine;
  assert(rtEngine !== undefined, "engine registered");
  const order = rtEngine.getStartupManager().determineStartupOrder(rtEngine.getSnapshot().engines);
  assert(order.indexOf("SocialPlatformEngine") > order.indexOf("YouTubeIntegrationEngine"), "dependencies resolved");

  // 20. Complete End-to-End Social Publishing
  console.log("20. Complete End-to-End Social Publishing...");
  assert(publishResponse.status === PublishState.PUBLISHED, "publish package distributed");
  assert(publishResponse.platformUrls[PlatformType.INSTAGRAM] !== undefined && publishResponse.platformUrls[PlatformType.FACEBOOK] !== undefined, "platform URLs returned");

  console.log(`\n=== ${passed}/${passed + failed} SOCIAL PLATFORM TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `— ${failed} FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
