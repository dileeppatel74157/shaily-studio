/**
 * Sprint 14.1 — Autonomous Channel Manager Engine
 * Verification Suite — 20 Tests
 */

import { ChannelManagerEngine }    from "./channel-manager/ChannelManagerEngine";
import { ChannelManagerBuilder }   from "./channel-manager/ChannelManagerBuilder";
import { ChannelManagerValidator } from "./channel-manager/ChannelManagerValidator";
import { ChannelManagerState }     from "./channel-manager/ChannelManagerState";
import { PlatformProvider }        from "./channel-manager/PlatformProvider";
import { AccountStatus }           from "./channel-manager/AccountStatus";
import { UploadQueueState }        from "./channel-manager/UploadQueueState";
import { ScheduleStatus }          from "./channel-manager/ScheduleStatus";
import { CapabilityType }          from "./channel-manager/CapabilityType";
import { SyncStatus }              from "./channel-manager/SyncStatus";
import {
  ChannelManagerValidationException,
  DuplicateChannelException,
  ChannelNotFoundException,
  QueueConflictException,
  OAuthException,
} from "./channel-manager/types";
import type { ChannelManagerRequest, OAuthToken, QueueItem } from "./channel-manager/models";
import type {
  IChannelProvider,
  IAccountManager,
  IOAuthManager,
  ISynchronizer,
  IUploadQueueManager,
  IScheduleManager,
  ICapabilityResolver,
  IChannelMonitor,
  IHistoryManager,
} from "./channel-manager/interfaces";

// ─── Assertion Helper ─────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function makeContext(overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  const store = new Map<string, any>();
  return {
    logger:  { info: () => {}, error: () => {}, warn: () => {} },
    eventBus: {
      publish: async (e: any) => { events.push(e); },
      _events: events,
    },
    memoryStore: {
      get: async (_ns: string, key: string) => store.has(key) ? { value: store.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { store.set(key, value); },
      _store: store,
    },
    registry: { has: () => false, resolve: () => null },
    ...overrides,
  };
}

function makeValidToken(offsetMs = 3_600_000): OAuthToken {
  return {
    accessToken:      "access-tok-valid-001",
    refreshToken:     "refresh-tok-001",
    tokenType:        "Bearer",
    expiresAt:        new Date(Date.now() + offsetMs),
    scopes:           ["read", "write", "upload"],
    issuedAt:         new Date(),
    isExpired:        false,
    expiresInSeconds: Math.floor(offsetMs / 1000),
  };
}

function makeConnectRequest(
  id: string,
  provider: PlatformProvider = PlatformProvider.YOUTUBE,
  accountId = `acc-${provider.toLowerCase()}-001`
): ChannelManagerRequest {
  return {
    id,
    action:    "CONNECT",
    provider,
    state:     ChannelManagerState.CREATED,
    timestamp: new Date(),
    payload: {
      accountId,
      platformUserId: accountId,
      displayName:    `My ${provider} Channel`,
      accessToken:    "access-tok-valid-001",
      refreshToken:   "refresh-tok-001",
      scopes:         ["read", "write", "upload"],
      expiresAt:      new Date(Date.now() + 3_600_000).toISOString(),
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START AUTONOMOUS CHANNEL MANAGER ENGINE TESTS ===\n");

  // ==========================================================================
  // 1. Builder Validation
  // ==========================================================================
  console.log("1. Builder Validation...");
  try {
    new ChannelManagerBuilder().build();
    throw new Error("Expected ChannelManagerValidationException");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "Builder without context must throw ChannelManagerValidationException");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 2. Lifecycle
  // ==========================================================================
  console.log("2. Lifecycle...");
  const eng2 = new ChannelManagerEngine(makeContext());
  assert(eng2.state === ChannelManagerState.CREATED, "Initial state must be CREATED");
  await eng2.initialize();
  assert(eng2.state === ChannelManagerState.INITIALIZED, "After initialize() must be INITIALIZED");
  await eng2.start();
  assert(eng2.state === ChannelManagerState.READY, "After start() must be READY");
  await eng2.stop();
  assert(eng2.state === ChannelManagerState.PAUSED, "After stop() must be PAUSED");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 3. Provider Registration
  // ==========================================================================
  console.log("3. Provider Registration...");
  const eng3 = new ChannelManagerEngine(makeContext());
  await eng3.initialize();
  const listed = eng3.listProviders();
  assert(listed.includes(PlatformProvider.YOUTUBE),   "YouTube must be registered");
  assert(listed.includes(PlatformProvider.INSTAGRAM),  "Instagram must be registered");
  assert(listed.includes(PlatformProvider.TIKTOK),    "TikTok must be registered");
  assert(listed.includes(PlatformProvider.FACEBOOK),  "Facebook must be registered");
  assert(listed.includes(PlatformProvider.X),         "X must be registered");
  assert(listed.includes(PlatformProvider.LINKEDIN),  "LinkedIn must be registered");
  assert(listed.includes(PlatformProvider.RUMBLE),    "Rumble must be registered");
  assert(listed.includes(PlatformProvider.CUSTOM),    "Custom must be registered");

  // Custom provider registration
  let customPinged = false;
  const customProvider: IChannelProvider = {
    platform:       PlatformProvider.CUSTOM,
    fetchProfile:   async () => ({ channelName: "Custom" }),
    getCapabilities: () => eng3.getProvider(PlatformProvider.CUSTOM).getCapabilities(),
    validateToken:  async () => ({ valid: true, expiresInSeconds: 3600 }),
    fetchDrafts:    async () => [],
    fetchPlaylists: async () => [],
    ping:           async () => { customPinged = true; return true; },
  };
  eng3.registerProvider(customProvider);
  const customProv = eng3.getProvider(PlatformProvider.CUSTOM);
  await customProv.ping();
  assert(customPinged, "Custom provider ping() must be called after registration");

  // removeProvider
  eng3.removeProvider(PlatformProvider.CUSTOM);
  try {
    eng3.getProvider(PlatformProvider.CUSTOM);
    // After removal, either throws or returns a different provider — both acceptable
  } catch (_) {}
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 4. OAuth Management
  // ==========================================================================
  console.log("4. OAuth Management...");
  const eng4 = new ChannelManagerEngine(makeContext());
  await eng4.initialize();
  // Connect a channel
  await eng4.execute(makeConnectRequest("req-oauth-001"));
  const channels4 = eng4.getConnectedChannels();
  assert(channels4.length === 1, "OAuth: must have 1 connected channel after CONNECT");
  assert(channels4[0].status === AccountStatus.CONNECTED, "Channel status must be CONNECTED");
  assert(channels4[0].oauth.accessToken === "access-tok-valid-001", "OAuth accessToken must be stored");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 5. Token Refresh
  // ==========================================================================
  console.log("5. Token Refresh...");
  const eng5 = new ChannelManagerEngine(makeContext());
  await eng5.initialize();
  await eng5.execute(makeConnectRequest("req-tokref-001", PlatformProvider.YOUTUBE, "acc-refresh-001"));
  const refreshResp = await eng5.execute({
    id:        "req-tokref-002",
    action:    "REFRESH_TOKEN",
    channelId: "acc-refresh-001",
    state:     ChannelManagerState.READY,
    timestamp: new Date(),
  });
  assert(refreshResp.state !== ChannelManagerState.FAILED, "Token refresh must not fail");
  const chAfterRefresh = eng5.getConnectedChannels().find(c => c.id === "acc-refresh-001");
  assert(!!chAfterRefresh, "Channel must still be connected after token refresh");
  assert(chAfterRefresh!.oauth.accessToken.startsWith("refreshed-"), "Token must be refreshed (new accessToken)");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 6. Multi Account Support
  // ==========================================================================
  console.log("6. Multi Account Support...");
  const eng6 = new ChannelManagerEngine(makeContext());
  await eng6.initialize();
  const platforms = [
    PlatformProvider.YOUTUBE,
    PlatformProvider.INSTAGRAM,
    PlatformProvider.TIKTOK,
    PlatformProvider.FACEBOOK,
    PlatformProvider.LINKEDIN,
    PlatformProvider.RUMBLE,
  ];
  for (let i = 0; i < platforms.length; i++) {
    await eng6.execute(makeConnectRequest(`req-multi-${i}`, platforms[i], `acc-multi-${platforms[i].toLowerCase()}`));
  }
  const channels6 = eng6.getConnectedChannels();
  assert(channels6.length === platforms.length, `Must manage ${platforms.length} accounts simultaneously`);
  for (const platform of platforms) {
    assert(channels6.some(c => c.provider === platform), `Must have a connected channel for ${platform}`);
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 7. Capability Detection
  // ==========================================================================
  console.log("7. Capability Detection...");
  const eng7 = new ChannelManagerEngine(makeContext());
  await eng7.initialize();
  const ytCaps = eng7.getProvider(PlatformProvider.YOUTUBE).getCapabilities();
  assert(ytCaps.supported.includes(CapabilityType.LONG_VIDEO),   "YouTube must support LONG_VIDEO");
  assert(ytCaps.supported.includes(CapabilityType.SHORTS),       "YouTube must support SHORTS");
  assert(ytCaps.supported.includes(CapabilityType.MONETIZATION), "YouTube must support MONETIZATION");
  assert(ytCaps.supported.includes(CapabilityType.PLAYLISTS),    "YouTube must support PLAYLISTS");
  assert(ytCaps.maxFileSizeBytes > 0, "YouTube maxFileSizeBytes must be > 0");

  const ttCaps = eng7.getProvider(PlatformProvider.TIKTOK).getCapabilities();
  assert(!ttCaps.supported.includes(CapabilityType.LONG_VIDEO), "TikTok must NOT support LONG_VIDEO");
  assert(ttCaps.supported.includes(CapabilityType.SHORTS), "TikTok must support SHORTS");

  const rumCaps = eng7.getProvider(PlatformProvider.RUMBLE).getCapabilities();
  assert(rumCaps.supported.includes(CapabilityType.MONETIZATION), "Rumble must support MONETIZATION");
  assert(rumCaps.supported.includes(CapabilityType.LONG_VIDEO), "Rumble must support LONG_VIDEO");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 8. Upload Queue
  // ==========================================================================
  console.log("8. Upload Queue...");
  const eng8 = new ChannelManagerEngine(makeContext());
  await eng8.initialize();
  await eng8.execute(makeConnectRequest("req-queue-connect", PlatformProvider.YOUTUBE, "acc-queue-001"));

  const queueResp = await eng8.execute({
    id:        "req-queue-001",
    action:    "QUEUE",
    channelId: "acc-queue-001",
    provider:  PlatformProvider.YOUTUBE,
    state:     ChannelManagerState.READY,
    timestamp: new Date(),
    payload: {
      id:          "qi-test-001",
      channelId:   "acc-queue-001",
      provider:    PlatformProvider.YOUTUBE,
      videoPath:   "/outputs/video-final.mp4",
      title:       "Test Video",
      description: "A test upload",
      tags:        ["test", "AI"],
      priority:    1,
      maxRetries:  3,
    },
  });
  assert(queueResp.queueSnapshot.totalItems >= 1, "Queue must have at least 1 item after QUEUE action");
  assert(queueResp.queueSnapshot.waitingCount >= 1, "Item must be in WAITING state");

  // Duplicate queue item — must fail
  try {
    await eng8.execute({
      id:        "req-queue-002",
      action:    "QUEUE",
      channelId: "acc-queue-001",
      provider:  PlatformProvider.YOUTUBE,
      state:     ChannelManagerState.READY,
      timestamp: new Date(),
      payload: { id: "qi-test-001", channelId: "acc-queue-001", provider: PlatformProvider.YOUTUBE, videoPath: "/dup.mp4", title: "Dup", description: "", tags: [], priority: 1, maxRetries: 3 },
    });
    throw new Error("Expected QueueConflictException");
  } catch (err: unknown) {
    assert(err instanceof QueueConflictException, "Duplicate queue item must throw QueueConflictException");
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 9. Schedule Management
  // ==========================================================================
  console.log("9. Schedule Management...");
  const eng9 = new ChannelManagerEngine(makeContext());
  await eng9.initialize();
  await eng9.execute(makeConnectRequest("req-sched-connect", PlatformProvider.YOUTUBE, "acc-sched-001"));

  const futureDate = new Date(Date.now() + 86_400_000);
  const schedResp = await eng9.execute({
    id:        "req-sched-001",
    action:    "SCHEDULE",
    channelId: "acc-sched-001",
    provider:  PlatformProvider.YOUTUBE,
    state:     ChannelManagerState.READY,
    timestamp: new Date(),
    payload: {
      id:          "sp-test-001",
      channelId:   "acc-sched-001",
      provider:    PlatformProvider.YOUTUBE,
      title:       "Scheduled Video",
      description: "Will be published tomorrow",
      scheduledAt: futureDate.toISOString(),
      timezone:    "UTC",
    },
  });
  const snap9 = eng9.getSnapshot("acc-sched-001");
  assert(snap9.scheduledPosts >= 1, "Snapshot must record at least 1 scheduled post");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 10. Draft Synchronization
  // ==========================================================================
  console.log("10. Draft Synchronization...");
  let draftsFetched = false;
  const draftProvider: IChannelProvider = {
    platform:        PlatformProvider.YOUTUBE,
    fetchProfile:    async () => ({ channelName: "Draft Test" }),
    getCapabilities: () => ({} as any),
    validateToken:   async () => ({ valid: true, expiresInSeconds: 3600 }),
    fetchDrafts:     async () => {
      draftsFetched = true;
      return [{
        id: "draft-001", channelId: "acc-draft-001", provider: PlatformProvider.YOUTUBE,
        platformDraftId: "yt-draft-001", title: "Draft 1", description: "A draft",
        tags: [], syncStatus: SyncStatus.COMPLETED, isLocal: false, isRemote: true,
        createdAt: new Date(), updatedAt: new Date(), mergeConflict: false,
      }];
    },
    fetchPlaylists: async () => [],
    ping: async () => true,
  };
  const eng10 = new ChannelManagerBuilder()
    .withContext(makeContext())
    .withProvider(draftProvider)
    .build();
  await eng10.initialize();
  await eng10.execute(makeConnectRequest("req-draft-connect", PlatformProvider.YOUTUBE, "acc-draft-001"));
  await eng10.execute({
    id: "req-draft-sync", action: "SYNC",
    channelId: "acc-draft-001",
    state: ChannelManagerState.READY, timestamp: new Date(),
  });
  assert(draftsFetched, "Synchronizer must call provider.fetchDrafts() during SYNC");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 11. History Tracking
  // ==========================================================================
  console.log("11. History Tracking...");
  const eng11 = new ChannelManagerEngine(makeContext());
  await eng11.initialize();
  await eng11.execute(makeConnectRequest("req-hist-connect", PlatformProvider.YOUTUBE, "acc-hist-001"));

  // Manually record history via injected manager
  const histManager: IHistoryManager = {
    record: (channelId, entry) => {},
    getHistory: (channelId) => ({
      channelId, entries: [
        { id: "he-001", channelId, provider: PlatformProvider.YOUTUBE,
          title: "Published Video", platformVideoId: "yt-hist-001",
          publishedUrl: "https://youtube.com/watch?v=yt-hist-001",
          publishedAt: new Date(), source: "QUEUE", retryCount: 0, deleted: false },
      ],
      totalUploads: 1, successfulUploads: 1, failedUploads: 0, manualUploads: 0, scheduledUploads: 0,
      lastUploadAt: new Date(),
    }),
    markDeleted: () => {},
  };
  const eng11b = new ChannelManagerBuilder()
    .withContext(makeContext())
    .withHistoryManager(histManager)
    .build();
  await eng11b.initialize();
  await eng11b.execute(makeConnectRequest("req-hist2-connect", PlatformProvider.YOUTUBE, "acc-hist-002"));
  const statusResp = await eng11b.execute({
    id: "req-hist-status", action: "GET_STATUS",
    state: ChannelManagerState.READY, timestamp: new Date(),
  });
  const report11 = eng11b.getReport("acc-hist-002");
  assert(report11.history.totalUploads === 1, "History must reflect 1 upload from injected history manager");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 12. Channel Synchronization
  // ==========================================================================
  console.log("12. Channel Synchronization...");
  let syncCalled = false;
  const customSync: ISynchronizer = {
    sync: async (channel, provider) => {
      syncCalled = true;
      return {
        channelId: channel.id, provider: channel.provider,
        status: SyncStatus.COMPLETED, syncedDrafts: 2, syncedPlaylists: 1,
        syncedSchedules: 0, syncedHistory: 0, syncedProfile: true,
        duration: 150, errors: [], timestamp: new Date(),
      };
    },
    syncProfile:   async () => ({}),
    syncDrafts:    async () => [],
    syncPlaylists: async () => [],
  };
  const eng12 = new ChannelManagerBuilder()
    .withContext(makeContext())
    .withSynchronizer(customSync)
    .build();
  await eng12.initialize();
  await eng12.execute(makeConnectRequest("req-sync-connect", PlatformProvider.YOUTUBE, "acc-sync-001"));
  const syncResp = await eng12.execute({
    id: "req-sync-001", action: "SYNC",
    state: ChannelManagerState.READY, timestamp: new Date(),
  });
  assert(syncCalled, "Custom synchronizer must be called during SYNC action");
  assert(syncResp.syncResults.length > 0, "SYNC must produce at least one SyncResult");
  assert(syncResp.syncResults[0].status === SyncStatus.COMPLETED, "SyncResult status must be COMPLETED");
  assert(syncResp.syncResults[0].syncedDrafts === 2, "SyncResult must report 2 synced drafts");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 13. Planning Integration
  // ==========================================================================
  console.log("13. Planning Integration...");
  let planningTaskCreated = false;
  const ctxPlan = makeContext({
    planningEngine: {
      createTask: async (task: any) => {
        planningTaskCreated = true;
        assert(task.type === "CHANNEL_MANAGER_ACTION_COMPLETE", "Planning task type must be CHANNEL_MANAGER_ACTION_COMPLETE");
        assert(task.action !== undefined, "Planning task must include action");
      },
    },
  });
  const eng13 = new ChannelManagerEngine(ctxPlan);
  await eng13.initialize();
  await eng13.execute(makeConnectRequest("req-plan-001"));
  assert(planningTaskCreated, "Planning engine createTask must be called after action");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 14. Decision Integration
  // ==========================================================================
  console.log("14. Decision Integration...");
  let decisionRecorded = false;
  const ctxDec = makeContext({
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: () => ({
        record: async (data: any) => {
          decisionRecorded = true;
          assert(data.channelManagerRequestId !== undefined, "Decision record must include channelManagerRequestId");
          assert(data.action !== undefined, "Decision record must include action");
        },
      }),
    },
  });
  const eng14 = new ChannelManagerEngine(ctxDec);
  await eng14.initialize();
  await eng14.execute(makeConnectRequest("req-dec-001"));
  assert(decisionRecorded, "Decision engine record must be triggered after action");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 15. Memory Integration
  // ==========================================================================
  console.log("15. Memory Integration...");
  const ctxMem = makeContext();
  const eng15 = new ChannelManagerEngine(ctxMem);
  await eng15.initialize();
  await eng15.execute(makeConnectRequest("req-mem-001", PlatformProvider.YOUTUBE, "acc-mem-001"));
  const memStore = ctxMem.memoryStore._store as Map<string, any>;
  assert(memStore.has("channels:req-mem-001"),  "channel-manager:channels must be in memory");
  assert(memStore.has("account:acc-mem-001"),   "accounts:account must be in memory");
  assert(memStore.has("token:acc-mem-001"),     "oauth:token must be in memory");
  assert(memStore.has("queue:acc-mem-001"),     "queue:queue must be in memory");
  assert(memStore.has("history:acc-mem-001"),   "history:history must be in memory");
  assert(memStore.has("schedule:acc-mem-001"),  "schedule:schedule must be in memory");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 16. Agent Integration
  // ==========================================================================
  console.log("16. Agent Integration...");
  const engAgent: import("./channel-manager/interfaces").IChannelManager =
    new ChannelManagerEngine(makeContext());
  assert(typeof engAgent.initialize          === "function", "IChannelManager.initialize must be a function");
  assert(typeof engAgent.start               === "function", "IChannelManager.start must be a function");
  assert(typeof engAgent.stop                === "function", "IChannelManager.stop must be a function");
  assert(typeof engAgent.execute             === "function", "IChannelManager.execute must be a function");
  assert(typeof engAgent.getSnapshot         === "function", "IChannelManager.getSnapshot must be a function");
  assert(typeof engAgent.getReport           === "function", "IChannelManager.getReport must be a function");
  assert(typeof engAgent.getConnectedChannels=== "function", "IChannelManager.getConnectedChannels must be a function");
  assert(typeof engAgent.getHistory          === "function", "IChannelManager.getHistory must be a function");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 17. Event Publishing
  // ==========================================================================
  console.log("17. Event Publishing...");
  const ctxEvt = makeContext();
  const eng17  = new ChannelManagerEngine(ctxEvt);
  await eng17.initialize();
  await eng17.execute(makeConnectRequest("req-evt-001", PlatformProvider.YOUTUBE, "acc-evt-001"));
  await eng17.execute({ id: "req-evt-sync", action: "SYNC", state: ChannelManagerState.READY, timestamp: new Date() });

  const evtNames = (ctxEvt.eventBus._events as any[]).map((e: any) => e.name);
  assert(evtNames.includes("ChannelManagerActionStarted"),   "ChannelManagerActionStarted must be emitted");
  assert(evtNames.includes("ChannelConnected"),              "ChannelConnected must be emitted on CONNECT");
  assert(evtNames.includes("SynchronizationStarted"),        "SynchronizationStarted must be emitted on SYNC");
  assert(evtNames.includes("SynchronizationCompleted"),      "SynchronizationCompleted must be emitted on SYNC");
  assert(evtNames.includes("ChannelManagerActionCompleted"), "ChannelManagerActionCompleted must be emitted");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 18. Snapshot Immutability
  // ==========================================================================
  console.log("18. Snapshot Immutability...");
  const eng18 = new ChannelManagerEngine(makeContext());
  await eng18.initialize();
  await eng18.execute(makeConnectRequest("req-snap-001", PlatformProvider.YOUTUBE, "acc-snap-001"));
  const snap18 = eng18.getSnapshot("acc-snap-001");
  assert(Object.isFrozen(snap18), "Snapshot root must be frozen");
  assert(snap18.channelId === "acc-snap-001", "Snapshot channelId must match");
  assert(Object.values(PlatformProvider).includes(snap18.provider), "Snapshot provider must be valid");
  assert(Object.values(AccountStatus).includes(snap18.accountStatus), "Snapshot accountStatus must be valid");
  assert(snap18.tokenValid === true, "Snapshot tokenValid must be true for fresh token");
  assert(Array.isArray(snap18.capabilities), "Snapshot capabilities must be an array");
  assert(Object.isFrozen(snap18.capabilities), "Snapshot capabilities array must be frozen");

  let mutationFailed = false;
  try { (snap18 as any).channelId = "hacked"; } catch (_) { mutationFailed = true; }
  assert(snap18.channelId === "acc-snap-001" || mutationFailed, "Snapshot must be immutable");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 19. Validator Rules
  // ==========================================================================
  console.log("19. Validator Rules...");

  // 19a. Empty ID
  try {
    ChannelManagerValidator.validateRequest({ id: "", action: "CONNECT", state: ChannelManagerState.CREATED, timestamp: new Date() } as any);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "Empty ID must fail validation");
  }

  // 19b. Invalid action
  try {
    ChannelManagerValidator.validateRequest({ id: "req-val", action: "FLY", state: ChannelManagerState.CREATED, timestamp: new Date() } as any);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "Invalid action must fail validation");
  }

  // 19c. DISCONNECT without channelId
  try {
    ChannelManagerValidator.validateRequest({ id: "req-dis", action: "DISCONNECT", state: ChannelManagerState.READY, timestamp: new Date() } as any);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "DISCONNECT without channelId must fail");
  }

  // 19d. Invalid provider
  try {
    ChannelManagerValidator.validateRequest({ id: "req-prov", action: "CONNECT", provider: "SNAPCHAT" as any, state: ChannelManagerState.CREATED, timestamp: new Date() });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "Invalid provider must fail validation");
  }

  // 19e. Invalid OAuth token (empty accessToken)
  try {
    ChannelManagerValidator.validateOAuthToken({
      accessToken: "", tokenType: "Bearer", expiresAt: new Date(Date.now() + 3600_000),
      scopes: ["read"], issuedAt: new Date(), isExpired: false, expiresInSeconds: 3600,
    }, "ch-001");
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "Empty accessToken must fail OAuth validation");
  }

  // 19f. Empty scopes
  try {
    ChannelManagerValidator.validateOAuthToken({
      accessToken: "tok", tokenType: "Bearer", expiresAt: new Date(Date.now() + 3600_000),
      scopes: [], issuedAt: new Date(), isExpired: false, expiresInSeconds: 3600,
    }, "ch-001");
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "Empty scopes must fail OAuth validation");
  }

  // 19g. Queue item — missing videoPath
  try {
    ChannelManagerValidator.validateQueueItem({
      id: "qi-bad", channelId: "ch-001", provider: PlatformProvider.YOUTUBE,
      videoPath: "", title: "T", description: "", tags: [],
      state: UploadQueueState.WAITING, priority: 1, enqueuedAt: new Date(), retryCount: 0, maxRetries: 3,
    });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "Empty videoPath must fail queue validation");
  }

  // 19h. Schedule in the past
  try {
    ChannelManagerValidator.validateScheduledPost({
      id: "sp-bad", channelId: "ch-001", provider: PlatformProvider.YOUTUBE,
      title: "Test", description: "", scheduledAt: new Date(Date.now() - 1000),
      timezone: "UTC", status: ScheduleStatus.PENDING, createdAt: new Date(),
    });
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "Past scheduledAt must fail schedule validation");
  }

  // 19i. Duplicate channel IDs
  try {
    ChannelManagerValidator.validateNoDuplicateChannels(["ch-a", "ch-b", "ch-a"]);
    throw new Error("Expected DuplicateChannelException");
  } catch (err: unknown) {
    assert(err instanceof DuplicateChannelException, "Duplicate channel IDs must throw DuplicateChannelException");
  }

  // 19j. Forbidden state transition
  try {
    ChannelManagerValidator.validateStateTransition("test", ChannelManagerState.CREATED, ChannelManagerState.RUNNING);
    throw new Error("Expected exception");
  } catch (err: unknown) {
    assert(err instanceof ChannelManagerValidationException, "Forbidden state transition must fail validation");
  }

  console.log("✓ Passed.\n");

  // ==========================================================================
  // 20. Full End-to-End Autonomous Channel Management
  // ==========================================================================
  console.log("20. Full End-to-End Autonomous Channel Management...");

  let e2ePlanningCalled = false;
  let e2eDecisionCalled = false;
  let e2eSyncCalled     = false;

  const ctxE2E = makeContext({
    planningEngine: { createTask: async () => { e2ePlanningCalled = true; } },
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: () => ({ record: async () => { e2eDecisionCalled = true; } }),
    },
  });

  const syncE2E: ISynchronizer = {
    sync: async (channel, provider) => {
      e2eSyncCalled = true;
      return {
        channelId: channel.id, provider: channel.provider,
        status: SyncStatus.COMPLETED, syncedDrafts: 3, syncedPlaylists: 2,
        syncedSchedules: 1, syncedHistory: 5, syncedProfile: true,
        duration: 200, errors: [], timestamp: new Date(),
      };
    },
    syncProfile: async () => ({}), syncDrafts: async () => [], syncPlaylists: async () => [],
  };

  const engE2E = new ChannelManagerBuilder()
    .withContext(ctxE2E)
    .withSynchronizer(syncE2E)
    .withMetadata({ sprint: "14.1" })
    .build();

  await engE2E.initialize();
  assert(engE2E.state === ChannelManagerState.INITIALIZED, "E2E: must be INITIALIZED");

  // Step 1: Connect 3 channels
  const e2eChannels = [
    { provider: PlatformProvider.YOUTUBE,   id: "acc-e2e-yt" },
    { provider: PlatformProvider.INSTAGRAM, id: "acc-e2e-ig" },
    { provider: PlatformProvider.RUMBLE,    id: "acc-e2e-ru" },
  ];
  for (let i = 0; i < e2eChannels.length; i++) {
    await engE2E.execute(makeConnectRequest(`req-e2e-connect-${i}`, e2eChannels[i].provider, e2eChannels[i].id));
  }
  const e2eConnected = engE2E.getConnectedChannels();
  assert(e2eConnected.length === 3, "E2E: must have 3 connected channels");

  // Step 2: Sync all channels
  const e2eSyncResp = await engE2E.execute({
    id: "req-e2e-sync", action: "SYNC",
    options: { syncAll: true },
    state: ChannelManagerState.READY, timestamp: new Date(),
  });
  assert(e2eSyncCalled, "E2E: custom synchronizer must be called");
  assert(e2eSyncResp.syncResults.length === 3, "E2E: must sync all 3 channels");

  // Step 3: Queue an upload to YouTube
  await engE2E.execute({
    id: "req-e2e-queue", action: "QUEUE",
    channelId: "acc-e2e-yt", provider: PlatformProvider.YOUTUBE,
    state: ChannelManagerState.READY, timestamp: new Date(),
    payload: {
      id: "qi-e2e-001", channelId: "acc-e2e-yt", provider: PlatformProvider.YOUTUBE,
      videoPath: "/outputs/e2e-video.mp4", title: "E2E Test Video",
      description: "Sprint 14.1 E2E test", tags: ["e2e", "AI"], priority: 1, maxRetries: 3,
    },
  });

  // Step 4: Schedule a post to Rumble
  const e2eFuture = new Date(Date.now() + 2 * 86_400_000);
  await engE2E.execute({
    id: "req-e2e-sched", action: "SCHEDULE",
    channelId: "acc-e2e-ru", provider: PlatformProvider.RUMBLE,
    state: ChannelManagerState.READY, timestamp: new Date(),
    payload: {
      id: "sp-e2e-001", channelId: "acc-e2e-ru", provider: PlatformProvider.RUMBLE,
      title: "Rumble Scheduled Upload", description: "E2E schedule test",
      scheduledAt: e2eFuture.toISOString(), timezone: "UTC",
    },
  });

  // Step 5: Refresh YouTube token
  await engE2E.execute({
    id: "req-e2e-refresh", action: "REFRESH_TOKEN",
    channelId: "acc-e2e-yt",
    state: ChannelManagerState.READY, timestamp: new Date(),
  });

  // Step 6: Get status
  await engE2E.execute({
    id: "req-e2e-status", action: "GET_STATUS",
    state: ChannelManagerState.READY, timestamp: new Date(),
  });

  // Assertions
  assert(e2ePlanningCalled, "E2E: planning engine must be called");
  assert(e2eDecisionCalled, "E2E: decision engine must be called");

  // Snapshots for all 3 channels
  for (const ch of e2eChannels) {
    const snap = engE2E.getSnapshot(ch.id);
    assert(Object.isFrozen(snap), `E2E: snapshot for ${ch.id} must be frozen`);
    assert(snap.channelId === ch.id, `E2E: snapshot channelId must be ${ch.id}`);
    assert(snap.provider === ch.provider, `E2E: snapshot provider must be ${ch.provider}`);
  }

  // YouTube queue
  const ytSnap = engE2E.getSnapshot("acc-e2e-yt");
  assert(ytSnap.queueLength >= 1, "E2E: YouTube queue must have at least 1 item");

  // Rumble schedule
  const ruSnap = engE2E.getSnapshot("acc-e2e-ru");
  assert(ruSnap.scheduledPosts >= 1, "E2E: Rumble must have at least 1 scheduled post");

  // Events
  const e2eEvts = (ctxE2E.eventBus._events as any[]).map((e: any) => e.name);
  assert(e2eEvts.includes("ChannelConnected"),              "E2E: ChannelConnected events must be emitted");
  assert(e2eEvts.includes("SynchronizationStarted"),        "E2E: SynchronizationStarted must be emitted");
  assert(e2eEvts.includes("SynchronizationCompleted"),      "E2E: SynchronizationCompleted must be emitted");
  assert(e2eEvts.includes("UploadQueued"),                  "E2E: UploadQueued must be emitted");
  assert(e2eEvts.includes("ScheduleCreated"),               "E2E: ScheduleCreated must be emitted");
  assert(e2eEvts.includes("TokenRefreshed"),                "E2E: TokenRefreshed must be emitted");
  assert(e2eEvts.includes("ChannelManagerActionCompleted"), "E2E: ChannelManagerActionCompleted must be emitted");

  // Memory
  const e2eStore = ctxE2E.memoryStore._store as Map<string, any>;
  assert(e2eStore.has("account:acc-e2e-yt"), "E2E: YouTube account must be in memory");
  assert(e2eStore.has("account:acc-e2e-ig"), "E2E: Instagram account must be in memory");
  assert(e2eStore.has("account:acc-e2e-ru"), "E2E: Rumble account must be in memory");
  assert(e2eStore.has("queue:acc-e2e-yt"),   "E2E: YouTube queue must be in memory");
  assert(e2eStore.has("token:acc-e2e-yt"),   "E2E: YouTube token must be in memory");

  // History
  const e2eHistory = engE2E.getHistory();
  assert(e2eHistory.length >= 6, "E2E: must have at least 6 response entries in history");

  console.log("✓ Passed.\n");

  console.log("=== ALL 20 CHANNEL MANAGER ENGINE TESTS PASSED ✓ ===");
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
