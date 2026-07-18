/**
 * Sprint 13.1 — AI Publishing & Distribution Engine
 * Verification Suite — 20 Tests
 */

import { PublishingEngine }    from "./publishing/PublishingEngine";
import { PublishingBuilder }   from "./publishing/PublishingBuilder";
import { PublishingValidator } from "./publishing/PublishingValidator";
import { PublishingState }     from "./publishing/PublishingState";
import { PublishingPlatform }  from "./publishing/PublishingPlatform";
import { PublishingStatus }    from "./publishing/PublishingStatus";
import { PrivacyType }         from "./publishing/PrivacyType";
import { UploadPriority }      from "./publishing/UploadPriority";
import {
  PublishingValidationException,
  DuplicatePublishingException,
  PublishingRetryExhaustedException,
} from "./publishing/types";
import type {
  PublishingRequest,
  PublishingTarget,
  PublishingAccount,
  PublishingMetadata,
} from "./publishing/models";
import type {
  IPlatformProvider,
  IMetadataBuilder,
  ISchedulePlanner,
  IUploadManager,
  IRetryManager,
  IPublishingMonitor,
} from "./publishing/interfaces";

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
    logger: {
      info:  (..._: any[]) => {},
      error: (..._: any[]) => {},
      warn:  (..._: any[]) => {},
    },
    eventBus: {
      publish: async (evt: any) => { events.push(evt); },
      _events: events,
    },
    memoryStore: {
      get: async (_ns: string, key: string) =>
        store.has(key) ? { value: store.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { store.set(key, value); },
      _store: store,
    },
    registry: {
      has:     (_t: any) => false,
      resolve: (_t: any) => null,
    },
    ...overrides,
  };
}

function makeAccount(platform: PublishingPlatform): PublishingAccount {
  return {
    id:            `acc-${platform.toLowerCase()}`,
    platform,
    accountName:   `Test ${platform} Channel`,
    accountId:     `channel-${platform.toLowerCase()}-001`,
    authenticated: true,
  };
}

function makeTarget(
  platform: PublishingPlatform,
  overrides: Partial<PublishingTarget> = {}
): PublishingTarget {
  return {
    id:       `target-${platform.toLowerCase()}`,
    platform,
    account:  makeAccount(platform),
    privacy:  PrivacyType.PUBLIC,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<PublishingRequest> = {}): PublishingRequest {
  return {
    id:        overrides.id         ?? `pub-req-${Date.now()}`,
    qualityId: overrides.qualityId  ?? `quality-001`,
    renderId:  overrides.renderId   ?? `render-001`,
    targets:   overrides.targets    ?? [makeTarget(PublishingPlatform.YOUTUBE)],
    schedule:  overrides.schedule   ?? { mode: "now" },
    priority:  overrides.priority   ?? UploadPriority.NORMAL,
    state:     overrides.state      ?? PublishingState.CREATED,
    timestamp: overrides.timestamp  ?? new Date(),
    options:   overrides.options    ?? {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START AI PUBLISHING & DISTRIBUTION ENGINE TESTS ===\n");

  // ==========================================================================
  // 1. Builder Validation
  // ==========================================================================
  console.log("1. Builder Validation...");
  try {
    new PublishingBuilder().build();
    throw new Error("Expected PublishingValidationException");
  } catch (err: unknown) {
    assert(
      err instanceof PublishingValidationException,
      "Builder without context must throw PublishingValidationException"
    );
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 2. Lifecycle Transitions
  // ==========================================================================
  console.log("2. Lifecycle Transitions...");
  const eng2 = new PublishingEngine(makeContext());
  assert(eng2.state === PublishingState.CREATED, "Initial state must be CREATED");
  await eng2.initialize();
  assert(eng2.state === PublishingState.INITIALIZED, "State after initialize() must be INITIALIZED");
  await eng2.start();
  assert(eng2.state === PublishingState.PREPARING, "State after start() must be PREPARING");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 3. Metadata Generation
  // ==========================================================================
  console.log("3. Metadata Generation...");
  const customMetadataBuilder: IMetadataBuilder = {
    build: async (_req, _ctx) => ({
      title:       "10 AI Secrets of 2026",
      description: "Explore the top 10 AI breakthroughs of 2026.",
      tags:        ["AI", "Tech", "2026"],
      hashtags:    ["#AI", "#Tech"],
      keywords:    ["artificial intelligence", "machine learning"],
      language:    "en",
      allowComments: true,
      allowRatings:  true,
    }),
  };
  const engMeta = new PublishingBuilder()
    .withContext(makeContext())
    .withMetadataBuilder(customMetadataBuilder)
    .build();
  await engMeta.initialize();
  const respMeta = await engMeta.publish(makeRequest({ id: "pub-meta-test" }));
  assert(respMeta.report.metadata.title === "10 AI Secrets of 2026", "Custom metadata builder title must be used");
  assert(respMeta.report.metadata.tags.includes("AI"), "Tags must be set from custom metadata builder");
  assert(respMeta.report.metadata.hashtags.includes("#Tech"), "Hashtags must be set from custom metadata builder");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 4. Platform Routing
  // ==========================================================================
  console.log("4. Platform Routing...");
  const allPlatforms = [
    PublishingPlatform.YOUTUBE,
    PublishingPlatform.INSTAGRAM,
    PublishingPlatform.TIKTOK,
    PublishingPlatform.FACEBOOK,
    PublishingPlatform.X,
    PublishingPlatform.LINKEDIN,
    PublishingPlatform.RUMBLE,
    PublishingPlatform.CUSTOM,
  ];
  const multiTargets = allPlatforms.map((p) => makeTarget(p, { id: `target-${p.toLowerCase()}` }));
  const engRouter = new PublishingEngine(makeContext());
  await engRouter.initialize();
  const respRouter = await engRouter.publish(
    makeRequest({ id: "pub-routing-test", targets: multiTargets })
  );
  assert(
    respRouter.jobs.length === allPlatforms.length,
    `Platform router must create a job for each of the ${allPlatforms.length} platforms`
  );
  for (const platform of allPlatforms) {
    const job = respRouter.jobs.find((j) => j.platform === platform);
    assert(!!job, `Job must be created for platform ${platform}`);
  }
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 5. Upload Manager
  // ==========================================================================
  console.log("5. Upload Manager...");
  let progressCallCount = 0;
  const customUploadManager: IUploadManager = {
    upload: async (job, provider, assets, onProgress) => {
      job.uploadProgress = 50;
      onProgress(job);
      progressCallCount++;
      job.uploadProgress = 100;
      onProgress(job);
      progressCallCount++;
      return provider.upload(job, assets);
    },
  };
  const engUpload = new PublishingBuilder()
    .withContext(makeContext())
    .withUploadManager(customUploadManager)
    .build();
  await engUpload.initialize();
  await engUpload.publish(makeRequest({ id: "pub-upload-test" }));
  assert(progressCallCount >= 2, "Upload manager must call onProgress during upload");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 6. Thumbnail Upload
  // ==========================================================================
  console.log("6. Thumbnail Upload...");
  let receivedThumbnailPath: string | undefined;
  const thumbProvider: IPlatformProvider = {
    platform: PublishingPlatform.YOUTUBE,
    upload: async (job, assets) => {
      receivedThumbnailPath = assets.thumbnailPath;
      job.platformVideoId = "yt-thumb-test";
      job.publishedUrl    = "https://youtube.com/watch?v=yt-thumb-test";
      job.status = PublishingStatus.SUCCESS;
      job.state  = PublishingState.PUBLISHED;
      job.publishedAt = new Date();
      return job;
    },
    schedule: async (job, date) => { job.scheduledAt = date; return job; },
    getStatus: async (job) => job.status,
    cancel: async (_job) => {},
  };
  const engThumb = new PublishingBuilder()
    .withContext(makeContext())
    .withProvider(thumbProvider)
    .build();
  await engThumb.initialize();
  await engThumb.publish(makeRequest({
    id: "pub-thumb-test",
    options: { thumbnailPath: "/assets/thumb-custom.jpg" },
  }));
  assert(receivedThumbnailPath === "/assets/thumb-custom.jpg", "Custom thumbnail path must be passed to platform provider");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 7. Subtitle Upload
  // ==========================================================================
  console.log("7. Subtitle Upload...");
  let receivedSubtitlePath: string | undefined;
  const subProvider: IPlatformProvider = {
    platform: PublishingPlatform.YOUTUBE,
    upload: async (job, assets) => {
      receivedSubtitlePath = assets.subtitlePath;
      job.platformVideoId = "yt-sub-test";
      job.publishedUrl    = "https://youtube.com/watch?v=yt-sub-test";
      job.status = PublishingStatus.SUCCESS;
      job.state  = PublishingState.PUBLISHED;
      job.publishedAt = new Date();
      return job;
    },
    schedule: async (job, date) => { job.scheduledAt = date; return job; },
    getStatus: async (job) => job.status,
    cancel: async (_job) => {},
  };
  const engSub = new PublishingBuilder()
    .withContext(makeContext())
    .withProvider(subProvider)
    .build();
  await engSub.initialize();
  await engSub.publish(makeRequest({
    id: "pub-sub-test",
    options: { subtitlePath: "/assets/captions-en.srt" },
  }));
  assert(receivedSubtitlePath === "/assets/captions-en.srt", "Custom subtitle path must be passed to platform provider");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 8. Scheduling
  // ==========================================================================
  console.log("8. Scheduling...");
  const futureDate = new Date(Date.now() + 86_400_000); // tomorrow
  const engSched = new PublishingEngine(makeContext());
  await engSched.initialize();
  const respSched = await engSched.publish(makeRequest({
    id: "pub-sched-test",
    schedule: {
      mode:      "scheduled",
      publishAt: futureDate,
      timezone:  "UTC",
    },
  }));
  assert(respSched.jobs.length > 0, "Scheduling must produce at least one job");
  const schedJob = respSched.jobs[0];
  assert(
    schedJob.status === PublishingStatus.SCHEDULED ||
    schedJob.scheduledAt !== undefined,
    "Scheduled job must have SCHEDULED status or scheduledAt set"
  );
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 9. Retry Logic
  // ==========================================================================
  console.log("9. Retry Logic...");
  let retryAttempts = 0;
  const failThenSucceedProvider: IPlatformProvider = {
    platform: PublishingPlatform.YOUTUBE,
    upload: async (job, _assets) => {
      retryAttempts++;
      if (retryAttempts < 2) {
        job.status = PublishingStatus.FAILED;
        throw new Error("Simulated upload failure");
      }
      job.platformVideoId = "yt-retry-ok";
      job.publishedUrl    = "https://youtube.com/watch?v=yt-retry-ok";
      job.status = PublishingStatus.SUCCESS;
      job.state  = PublishingState.PUBLISHED;
      job.publishedAt = new Date();
      return job;
    },
    schedule: async (job, date) => { job.scheduledAt = date; return job; },
    getStatus: async (job) => job.status,
    cancel: async (_job) => {},
  };
  const engRetry = new PublishingBuilder()
    .withContext(makeContext())
    .withProvider(failThenSucceedProvider)
    .build();
  await engRetry.initialize();
  await engRetry.publish(makeRequest({ id: "pub-retry-test", options: { maxRetries: 3 } }));
  assert(retryAttempts >= 2, "Retry manager must re-attempt upload after failure");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 10. Resume Upload (Retry Manager Interface)
  // ==========================================================================
  console.log("10. Resume Upload...");
  const customRetryManager: IRetryManager = {
    shouldRetry: (job) => job.retryCount < job.maxRetries,
    retryDelayMs: (job) => Math.pow(2, job.retryCount) * 100,
    retry: async (job, provider, assets, uploadManager) => {
      job.retryCount += 1;
      job.status = PublishingStatus.RETRYING;
      return uploadManager.upload(job, provider, assets, (_j) => {});
    },
  };
  const engResume = new PublishingBuilder()
    .withContext(makeContext())
    .withRetryManager(customRetryManager)
    .build();
  await engResume.initialize();
  const respResume = await engResume.publish(makeRequest({ id: "pub-resume-test" }));
  assert(respResume.jobs.length > 0, "Resume upload integration must complete successfully");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 11. Publishing Monitor
  // ==========================================================================
  console.log("11. Publishing Monitor...");
  const monitorSnapshots: any[] = [];
  const customMonitor: IPublishingMonitor = {
    update: (job) => { monitorSnapshots.push({ jobId: job.id, progress: job.uploadProgress }); },
    getProgress: (_jobId) => undefined,
    getAllProgress: () => new Map(),
  };
  const engMonitor = new PublishingBuilder()
    .withContext(makeContext())
    .withMonitor(customMonitor)
    .build();
  await engMonitor.initialize();
  await engMonitor.publish(makeRequest({ id: "pub-monitor-test" }));
  assert(monitorSnapshots.length > 0, "Publishing monitor must receive update() calls during upload");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 12. Memory Integration
  // ==========================================================================
  console.log("12. Memory Integration...");
  const ctxMem = makeContext();
  const engMem = new PublishingEngine(ctxMem);
  await engMem.initialize();
  await engMem.publish(makeRequest({ id: "pub-mem-test" }));
  const memStore = ctxMem.memoryStore._store as Map<string, any>;
  assert(memStore.has("publishing:pub-mem-test"), "Publishing history must be stored in memoryStore");
  assert(memStore.has("pub-ids:pub-mem-test"), "Published video IDs must be stored in memoryStore");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 13. Decision Integration
  // ==========================================================================
  console.log("13. Decision Integration...");
  let decisionRecorded = false;
  const ctxDec = makeContext({
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: (_t: any) => ({
        record: async (data: any) => {
          decisionRecorded = true;
          assert(data.publishingId !== undefined, "Decision record must contain publishingId");
          assert(data.publishedPlatforms !== undefined, "Decision record must contain publishedPlatforms");
          assert(data.successRate !== undefined, "Decision record must contain successRate");
        },
      }),
    },
  });
  const engDec = new PublishingEngine(ctxDec);
  await engDec.initialize();
  await engDec.publish(makeRequest({ id: "pub-dec-test" }));
  assert(decisionRecorded, "Decision engine record must be triggered after publishing");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 14. Planning Integration
  // ==========================================================================
  console.log("14. Planning Integration...");
  let planningTaskCreated = false;
  const ctxPlan = makeContext({
    planningEngine: {
      createTask: async (task: any) => {
        planningTaskCreated = true;
        assert(task.type === "PUBLISHING_COMPLETE", "Planning task must be PUBLISHING_COMPLETE type");
        assert(task.publishingId !== undefined, "Planning task must contain publishingId");
      },
    },
  });
  const engPlan = new PublishingEngine(ctxPlan);
  await engPlan.initialize();
  await engPlan.publish(makeRequest({ id: "pub-plan-test" }));
  assert(planningTaskCreated, "Planning engine createTask must be called after publishing");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 15. Agent Integration
  // ==========================================================================
  console.log("15. Agent Integration...");
  const engAgent: import("./publishing/interfaces").IPublishingEngine =
    new PublishingEngine(makeContext());
  assert(typeof engAgent.initialize  === "function", "IPublishingEngine.initialize must be a function");
  assert(typeof engAgent.publish     === "function", "IPublishingEngine.publish must be a function");
  assert(typeof engAgent.cancel      === "function", "IPublishingEngine.cancel must be a function");
  assert(typeof engAgent.retry       === "function", "IPublishingEngine.retry must be a function");
  assert(typeof engAgent.getSnapshot === "function", "IPublishingEngine.getSnapshot must be a function");
  assert(typeof engAgent.getReport   === "function", "IPublishingEngine.getReport must be a function");
  assert(typeof engAgent.getHistory  === "function", "IPublishingEngine.getHistory must be a function");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 16. Event Publishing
  // ==========================================================================
  console.log("16. Event Publishing...");
  const ctxEvt = makeContext();
  const engEvt = new PublishingEngine(ctxEvt);
  await engEvt.initialize();
  await engEvt.publish(makeRequest({ id: "pub-evt-test" }));
  const publishedNames = (ctxEvt.eventBus._events as any[]).map((e: any) => e.name);
  assert(publishedNames.includes("PublishingStarted"),   "PublishingStarted event must be published");
  assert(publishedNames.includes("MetadataGenerated"),   "MetadataGenerated event must be published");
  assert(publishedNames.includes("UploadStarted"),       "UploadStarted event must be published");
  assert(publishedNames.includes("UploadCompleted"),     "UploadCompleted event must be published");
  assert(publishedNames.includes("PublishingCompleted"), "PublishingCompleted event must be published");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 17. Snapshot Immutability
  // ==========================================================================
  console.log("17. Snapshot Immutability...");
  const engSnap = new PublishingEngine(makeContext());
  await engSnap.initialize();
  await engSnap.publish(makeRequest({ id: "pub-snap-test" }));
  const snap17 = engSnap.getSnapshot("pub-snap-test");
  assert(Object.isFrozen(snap17), "Snapshot root must be frozen");
  assert(Object.isFrozen(snap17.publishedPlatforms), "Snapshot publishedPlatforms must be deeply frozen");

  let snapFailed = false;
  try {
    (snap17 as any).publishingId = "hack";
  } catch (_) {
    snapFailed = true;
  }
  assert(snap17.publishingId === "pub-snap-test" || snapFailed, "Snapshot properties must be immutable");
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 18. Validator Rules
  // ==========================================================================
  console.log("18. Validator Rules...");

  // 18a. Empty ID
  try {
    PublishingValidator.validateRequest({ ...makeRequest(), id: "" });
    throw new Error("Expected PublishingValidationException");
  } catch (err: unknown) {
    assert(err instanceof PublishingValidationException, "Empty ID must fail validation");
  }

  // 18b. Empty targets
  try {
    PublishingValidator.validateRequest({ ...makeRequest(), targets: [] });
    throw new Error("Expected PublishingValidationException");
  } catch (err: unknown) {
    assert(err instanceof PublishingValidationException, "Empty targets must fail validation");
  }

  // 18c. Duplicate target IDs
  const dupTargets = [
    makeTarget(PublishingPlatform.YOUTUBE, { id: "target-dup" }),
    makeTarget(PublishingPlatform.INSTAGRAM, { id: "target-dup" }),
  ];
  try {
    PublishingValidator.validateTargets(dupTargets);
    throw new Error("Expected DuplicatePublishingException");
  } catch (err: unknown) {
    assert(err instanceof DuplicatePublishingException, "Duplicate target IDs must throw DuplicatePublishingException");
  }

  // 18d. Invalid metadata — title too long
  try {
    PublishingValidator.validateMetadata({
      title:       "A".repeat(101),
      description: "test",
      tags:        [],
      hashtags:    [],
      keywords:    [],
    });
    throw new Error("Expected PublishingValidationException");
  } catch (err: unknown) {
    assert(err instanceof PublishingValidationException, "Title > 100 chars must fail metadata validation");
  }

  // 18e. Invalid state transition
  try {
    PublishingValidator.validateStateTransition("job-val", PublishingState.CREATED, PublishingState.PUBLISHED);
    throw new Error("Expected PublishingValidationException");
  } catch (err: unknown) {
    assert(err instanceof PublishingValidationException, "Forbidden state transition must fail validation");
  }

  // 18f. Invalid privacy
  try {
    PublishingValidator.validateTargets([
      makeTarget(PublishingPlatform.YOUTUBE, { privacy: "SUPER_PRIVATE" as any }),
    ]);
    throw new Error("Expected PublishingValidationException");
  } catch (err: unknown) {
    assert(err instanceof PublishingValidationException, "Invalid privacy must fail target validation");
  }

  // 18g. File size limit
  try {
    PublishingValidator.validateFileSizeForPlatform(PublishingPlatform.X, 1_000_000_000); // 1 GB > 512 MB X limit
    throw new Error("Expected PublishingValidationException");
  } catch (err: unknown) {
    assert(err instanceof PublishingValidationException, "File exceeding X.com size limit must fail validation");
  }

  // 18h. Duration limit
  try {
    PublishingValidator.validateDurationForPlatform(PublishingPlatform.TIKTOK, 1200); // 20 min > 10 min TikTok limit
    throw new Error("Expected PublishingValidationException");
  } catch (err: unknown) {
    assert(err instanceof PublishingValidationException, "Duration exceeding TikTok limit must fail validation");
  }

  console.log("✓ Passed.\n");

  // ==========================================================================
  // 19. Regression Tests — Rendering Integration
  // ==========================================================================
  console.log("19. Regression Tests — Rendering Integration...");
  const mockRenderHistory = [
    {
      requestId:  "render-regression-001",
      outputPath: "/outputs/final-video.mp4",
      fps:        30,
      resolution: "1080P",
    },
  ];
  const ctxRender = makeContext({
    renderEngine: { getHistory: () => mockRenderHistory },
  });
  let capturedVideoPath: string | undefined;
  const captureProvider: IPlatformProvider = {
    platform: PublishingPlatform.YOUTUBE,
    upload: async (job, assets) => {
      capturedVideoPath = assets.videoPath;
      job.platformVideoId = "yt-render-reg";
      job.publishedUrl    = "https://youtube.com/watch?v=yt-render-reg";
      job.status = PublishingStatus.SUCCESS;
      job.state  = PublishingState.PUBLISHED;
      job.publishedAt = new Date();
      return job;
    },
    schedule: async (job, date) => { job.scheduledAt = date; return job; },
    getStatus: async (job) => job.status,
    cancel: async (_job) => {},
  };
  const engReg = new PublishingBuilder()
    .withContext(ctxRender)
    .withProvider(captureProvider)
    .build();
  await engReg.initialize();
  await engReg.publish(makeRequest({
    id: "pub-reg-test",
    renderId: "render-regression-001",
  }));
  assert(
    capturedVideoPath === "/outputs/final-video.mp4",
    "Publishing engine must resolve video path from RenderEngine history"
  );
  console.log("✓ Passed.\n");

  // ==========================================================================
  // 20. Full End-to-End Multi-Platform Publishing
  // ==========================================================================
  console.log("20. Full End-to-End Multi-Platform Publishing...");
  const ctxE2E = makeContext();
  const engE2E = new PublishingBuilder()
    .withContext(ctxE2E)
    .withMetadata({ sprint: "13.1" })
    .build();

  await engE2E.initialize();
  assert(engE2E.state === PublishingState.INITIALIZED, "Engine must be in INITIALIZED state before publish");

  const e2eTargets = [
    makeTarget(PublishingPlatform.YOUTUBE,   { id: "e2e-yt" }),
    makeTarget(PublishingPlatform.INSTAGRAM, { id: "e2e-ig" }),
    makeTarget(PublishingPlatform.TIKTOK,    { id: "e2e-tt" }),
    makeTarget(PublishingPlatform.RUMBLE,    { id: "e2e-ru" }),
  ];

  const respE2E = await engE2E.publish(makeRequest({
    id:       "pub-e2e",
    qualityId: "quality-approved-001",
    renderId:  "render-final-001",
    targets:   e2eTargets,
    schedule:  { mode: "now" },
    priority:  UploadPriority.HIGH,
    options: {
      autoGenerateMetadata: true,
      maxRetries:           3,
      notifyOnComplete:     true,
    },
  }));

  // Job assertions
  assert(respE2E.jobs.length === 4, "E2E must create 4 publishing jobs (YT, IG, TT, Rumble)");
  assert(respE2E.results.length === 4, "E2E must produce 4 results");

  // Published URL and platform video ID checks
  for (const job of respE2E.jobs) {
    assert(!!job.platformVideoId, `Job for ${job.platform} must have a platformVideoId`);
    assert(!!job.publishedUrl,    `Job for ${job.platform} must have a publishedUrl`);
    assert(job.status === PublishingStatus.SUCCESS, `Job for ${job.platform} must be SUCCESS`);
    assert(job.state  === PublishingState.PUBLISHED, `Job for ${job.platform} must be PUBLISHED`);
  }

  // Metrics
  assert(respE2E.metrics.successfulUploads === 4, "All 4 uploads must succeed in E2E");
  assert(respE2E.metrics.failedUploads === 0,     "No failures in E2E run");
  assert(respE2E.metrics.publishedPlatforms.includes(PublishingPlatform.RUMBLE), "Rumble must appear in publishedPlatforms");

  // Snapshot
  const e2eSnap = engE2E.getSnapshot("pub-e2e");
  assert(Object.isFrozen(e2eSnap),                 "E2E snapshot must be frozen");
  assert(e2eSnap.publishingId === "pub-e2e",        "E2E snapshot publishingId must match");
  assert(e2eSnap.successfulUploads === 4,           "E2E snapshot must record 4 successful uploads");
  assert(e2eSnap.state === PublishingState.PUBLISHED, "E2E snapshot state must be PUBLISHED");

  // Report
  const e2eReport = engE2E.getReport("pub-e2e");
  assert(!!e2eReport,                      "E2E report must exist");
  assert(e2eReport.analyticsRefs.length === 4, "E2E report must have 4 analytics refs");

  // History
  const history = engE2E.getHistory();
  assert(history.length === 1, "History must contain exactly 1 response after E2E");

  // Events
  const e2eEventNames = (ctxE2E.eventBus._events as any[]).map((e: any) => e.name);
  assert(e2eEventNames.includes("PublishingStarted"),   "E2E: PublishingStarted must be emitted");
  assert(e2eEventNames.includes("MetadataGenerated"),   "E2E: MetadataGenerated must be emitted");
  assert(e2eEventNames.includes("UploadStarted"),       "E2E: UploadStarted must be emitted");
  assert(e2eEventNames.includes("UploadCompleted"),     "E2E: UploadCompleted must be emitted");
  assert(e2eEventNames.includes("PublishingCompleted"), "E2E: PublishingCompleted must be emitted");

  // Memory
  const e2eMemStore = ctxE2E.memoryStore._store as Map<string, any>;
  assert(e2eMemStore.has("publishing:pub-e2e"),  "E2E: publishing history must be in memory");
  assert(e2eMemStore.has("pub-ids:pub-e2e"),     "E2E: published video IDs must be in memory");

  console.log("✓ Passed.\n");

  console.log("=== ALL 20 PUBLISHING ENGINE TESTS PASSED ✓ ===");
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
