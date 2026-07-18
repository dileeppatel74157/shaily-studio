/**
 * Sprint 12.7 — Video Composition & Timeline Assembly Engine
 * Verification Suite — 20 Tests
 */

import { VideoCompositionEngine }   from "./video-composition/VideoCompositionEngine";
import { VideoCompositionBuilder }  from "./video-composition/VideoCompositionBuilder";
import { VideoCompositionValidator } from "./video-composition/VideoCompositionValidator";
import { CompositionState }         from "./video-composition/CompositionState";
import { TrackType }                from "./video-composition/TrackType";
import { TransitionType }           from "./video-composition/TransitionType";
import { EffectType }               from "./video-composition/EffectType";
import { TimelineState }            from "./video-composition/TimelineState";
import {
  VideoCompositionValidationException,
  DuplicateCompositionException,
  InvalidCompositionLifecycleException,
} from "./video-composition/types";
import { CompositionRequest }       from "./video-composition/models";

// ─── Assertion Helper ─────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// ─── Mock Context ─────────────────────────────────────────────────────────────

function makeContext(overrides: Record<string, any> = {}): any {
  const events: any[] = [];
  const store = new Map<string, any>();

  return {
    logger: {
      info:  (..._args: any[]) => {},
      error: (..._args: any[]) => {},
      warn:  (..._args: any[]) => {},
    },
    eventBus: {
      publish: async (evt: any) => { events.push(evt); },
      _events: events,
    },
    memoryStore: {
      get: async (_ns: string, key: string) => store.get(key),
      set: async (_ns: string, key: string, value: any) => { store.set(key, value); },
    },
    registry: {
      has: (_t: any) => false,
      resolve: (_t: any) => null,
    },
    ...overrides,
  };
}

function makeRequest(overrides: Partial<CompositionRequest> = {}): CompositionRequest {
  return {
    id:                    overrides.id                    ?? `comp-req-${Date.now()}`,
    generationResponseId:  overrides.generationResponseId  ?? `gen-resp-001`,
    state:                 overrides.state                 ?? CompositionState.CREATED,
    timestamp:             overrides.timestamp             ?? new Date(),
    options:               overrides.options               ?? {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("=== START VIDEO COMPOSITION ENGINE TESTS ===\n");

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("1. Builder Validation...");
  try {
    new VideoCompositionBuilder().build();
    throw new Error("Expected VideoCompositionValidationException");
  } catch (err: unknown) {
    assert(
      err instanceof VideoCompositionValidationException,
      "Builder without context must throw VideoCompositionValidationException"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Builder Validation.\n");

  // ==========================================
  // 2. Lifecycle Transitions
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("2. Lifecycle Transitions...");
  const ctx  = makeContext();
  const eng1 = new VideoCompositionEngine(ctx);

  assert(eng1.state === CompositionState.CREATED, "Initial state must be CREATED");

  // Cannot stop in CREATED state
  try {
    await eng1.stop();
    throw new Error("Expected InvalidCompositionLifecycleException");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidCompositionLifecycleException,
      "Stop from CREATED must throw InvalidCompositionLifecycleException"
    );
  }

  await eng1.initialize();
  assert(eng1.state === CompositionState.INITIALIZED, "State must be INITIALIZED after initialize");

  await eng1.start();
  assert(eng1.state === CompositionState.INITIALIZED, "Start must not mutate state beyond INITIALIZED");

  // eslint-disable-next-line no-console
  console.log("✓ Verified Lifecycle Transitions.\n");

  // ==========================================
  // 3. Timeline Creation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("3. Timeline Creation...");
  const eng3 = new VideoCompositionEngine(makeContext());
  await eng3.initialize();

  const req3   = makeRequest({ id: "comp-001", generationResponseId: "gen-001" });
  const resp3  = await eng3.compose(req3);

  assert(resp3.timeline !== undefined,           "Response must contain a timeline");
  assert(resp3.timeline.id.includes("comp-001"), "Timeline ID must reference composition ID");
  assert(resp3.timeline.durationSeconds > 0,     "Timeline duration must be positive");
  assert(resp3.timeline.fps === 30,              "Default FPS must be 30");
  assert(resp3.timeline.resolution === "1920x1080", "Default resolution must be 1920x1080");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Timeline Creation.\n");

  // ==========================================
  // 4. Track Generation
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("4. Track Generation...");
  const timeline4 = resp3.timeline;
  assert(Array.isArray(timeline4.tracks),         "Timeline must have a tracks array");
  assert(timeline4.tracks.length > 0,             "Timeline must contain at least one track");
  assert(timeline4.audioTrack   !== undefined,    "Timeline must have an audioTrack");
  assert(timeline4.subtitleTrack !== undefined,   "Timeline must have a subtitleTrack");
  assert(timeline4.overlayTrack  !== undefined,   "Timeline must have an overlayTrack");

  const trackTypes = timeline4.tracks.map((t) => t.type);
  assert(
    trackTypes.includes(TrackType.VIDEO) || trackTypes.includes(TrackType.IMAGE),
    "Timeline must include VIDEO or IMAGE tracks"
  );
  // eslint-disable-next-line no-console
  console.log("✓ Verified Track Generation.\n");

  // ==========================================
  // 5. Clip Placement
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("5. Clip Placement...");
  for (const track of timeline4.tracks) {
    for (const clip of track.clips) {
      assert(clip.startTimeSeconds >= 0,                           `Clip "${clip.id}" startTime must be >= 0`);
      assert(clip.endTimeSeconds > clip.startTimeSeconds,          `Clip "${clip.id}" endTime must exceed startTime`);
      assert(clip.endTimeSeconds <= timeline4.durationSeconds + 0.001, `Clip "${clip.id}" must not exceed timeline duration`);
      assert(clip.opacity >= 0 && clip.opacity <= 1,               `Clip "${clip.id}" opacity must be in [0,1]`);
    }
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Clip Placement.\n");

  // ==========================================
  // 6. Audio Synchronization
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("6. Audio Synchronization...");
  const audioTrack6 = resp3.timeline.audioTrack;
  assert(audioTrack6.voiceClips.length > 0,  "Audio track must contain voice clips");
  assert(audioTrack6.musicClips.length > 0,  "Audio track must contain music clips");
  for (const clip of [...audioTrack6.voiceClips, ...audioTrack6.musicClips]) {
    assert(clip.volume >= 0 && clip.volume <= 1,               `AudioClip volume must be in [0,1]`);
    assert(clip.endTimeSeconds > clip.startTimeSeconds,        `AudioClip "${clip.id}" endTime must exceed startTime`);
    assert(clip.startTimeSeconds >= 0,                         `AudioClip "${clip.id}" startTime must be >= 0`);
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Audio Synchronization.\n");

  // ==========================================
  // 7. Subtitle Synchronization
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("7. Subtitle Synchronization...");
  const subTrack7 = resp3.timeline.subtitleTrack;
  assert(subTrack7.entries.length > 0, "Subtitle track must have at least one entry");
  for (const entry of subTrack7.entries) {
    assert(entry.startTimeSeconds >= 0,                      `Subtitle entry "${entry.id}" startTime must be >= 0`);
    assert(entry.endTimeSeconds > entry.startTimeSeconds,    `Subtitle entry "${entry.id}" endTime must exceed startTime`);
    assert(typeof entry.text === "string" && entry.text.length > 0, `Subtitle entry "${entry.id}" must have non-empty text`);
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Subtitle Synchronization.\n");

  // ==========================================
  // 8. Transition Planning
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("8. Transition Planning...");
  const allClips8 = resp3.timeline.tracks.flatMap((t) => t.clips);
  const clipsWithTransitions = allClips8.filter((c) => c.transitions.length > 0);
  assert(clipsWithTransitions.length > 0, "At least one clip must have a transition assigned");

  for (const clip of clipsWithTransitions) {
    for (const trans of clip.transitions) {
      assert(
        Object.values(TransitionType).includes(trans.type as TransitionType),
        `Transition type "${trans.type}" must be a valid TransitionType`
      );
      assert(trans.durationSeconds >= 0, `Transition "${trans.id}" duration must be >= 0`);
    }
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Transition Planning.\n");

  // ==========================================
  // 9. Effect Planning
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("9. Effect Planning...");
  const clipsWithEffects = allClips8.filter((c) => c.effects.length > 0);
  assert(clipsWithEffects.length > 0, "At least one clip must have effects applied");

  for (const clip of clipsWithEffects) {
    for (const fx of clip.effects) {
      assert(
        Object.values(EffectType).includes(fx.type as EffectType),
        `Effect type "${fx.type}" must be a valid EffectType`
      );
      assert(fx.intensity >= 0 && fx.intensity <= 1, `Effect "${fx.id}" intensity must be in [0,1]`);
    }
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Effect Planning.\n");

  // ==========================================
  // 10. Timeline Optimization
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("10. Timeline Optimization...");
  const report10 = resp3.report;
  assert(report10.optimizationsApplied >= 0, "Report must record optimizations applied (>= 0)");

  // Verify no clip extends past timeline
  for (const track of resp3.timeline.tracks) {
    for (const clip of track.clips) {
      assert(
        clip.endTimeSeconds <= resp3.timeline.durationSeconds + 0.001,
        `Optimized clip "${clip.id}" must not exceed timeline duration`
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Timeline Optimization.\n");

  // ==========================================
  // 11. Generation Integration
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("11. Generation Integration...");
  const mockHistory = [
    {
      requestId: "gen-resp-integrated",
      assets: [
        { id: "gen-vid-1", assetType: "VIDEO", filePath: "/gen/vid.mp4", duration: 15 },
        { id: "gen-voice-1", assetType: "VOICE", filePath: "/gen/voice.mp3", duration: 15 },
        { id: "gen-music-1", assetType: "MUSIC", filePath: "/gen/music.wav", duration: 30 },
        { id: "gen-sub-1", assetType: "SUBTITLE", filePath: "/gen/sub.srt" },
      ],
    },
  ];
  const ctxGen = makeContext({
    generationEngine: {
      getHistory: () => mockHistory,
    },
  });

  const engGen = new VideoCompositionEngine(ctxGen);
  await engGen.initialize();

  const reqGen  = makeRequest({ id: "comp-gen-int", generationResponseId: "gen-resp-integrated" });
  const respGen = await engGen.compose(reqGen);

  assert(
    respGen.timeline.tracks.some((t) => t.type === TrackType.VIDEO),
    "Integration: VIDEO track must be assembled from GenerationEngine assets"
  );
  assert(
    respGen.timeline.audioTrack.voiceClips.length > 0,
    "Integration: voice audio clips must be assembled from GenerationEngine assets"
  );
  // eslint-disable-next-line no-console
  console.log("✓ Verified Generation Integration.\n");

  // ==========================================
  // 12. Production Integration
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("12. Production Integration...");
  const mockProdHistory = [
    {
      productionId: "prod-plan-001",
      timeline: {
        assets: {
          "asset-vid-1":   { start: 0,  end: 10 },
          "asset-img-1":   { start: 10, end: 15 },
          "asset-img-2":   { start: 15, end: 20 },
          "asset-bg-1":    { start: 0,  end: 30 },
        },
      },
    },
  ];
  const ctxProd = makeContext({
    productionEngine: {
      getHistory: () => mockProdHistory,
    },
  });

  const engProd  = new VideoCompositionEngine(ctxProd);
  await engProd.initialize();

  const reqProd  = makeRequest({ id: "comp-prod-int", generationResponseId: "gen-xxx", productionPlanId: "prod-plan-001" });
  const respProd = await engProd.compose(reqProd);

  assert(respProd.timeline !== undefined, "Production integration: timeline must be assembled");
  assert(respProd.report.totalAssets > 0, "Production integration: at least one asset must be assembled");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Production Integration.\n");

  // ==========================================
  // 13. Script Integration (narration timing via voice assets)
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("13. Script Integration...");
  const voiceClips13 = resp3.timeline.audioTrack.voiceClips;
  assert(voiceClips13.length > 0, "Script integration: voice clips must encode narration ordering");
  let prevEnd13 = -1;
  for (const vc of voiceClips13) {
    assert(vc.startTimeSeconds >= prevEnd13 - 0.001, "Voice clips must be placed in chronological narration order");
    prevEnd13 = vc.endTimeSeconds;
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Script Integration.\n");

  // ==========================================
  // 14. Decision Integration
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("14. Decision Integration...");
  let decisionRecorded = false;
  const ctxDecision = makeContext({
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: (_t: any) => ({
        record: async (data: any) => {
          decisionRecorded = true;
          assert(data.compositionId !== undefined, "Decision record must include compositionId");
          assert(data.outcome === "SUCCESS",        "Decision record must record SUCCESS outcome");
        },
      }),
    },
  });

  const engDec = new VideoCompositionEngine(ctxDecision);
  await engDec.initialize();
  await engDec.compose(makeRequest({ id: "comp-dec-test", generationResponseId: "gen-yyy" }));
  assert(decisionRecorded, "Decision engine record must be called after successful composition");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Decision Integration.\n");

  // ==========================================
  // 15. Memory Integration
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("15. Memory Integration...");
  const memStore15 = new Map<string, any>();
  const ctxMem = makeContext({
    memoryStore: {
      get: async (_ns: string, key: string) => memStore15.get(key) ? { value: memStore15.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { memStore15.set(key, value); },
    },
  });

  const engMem  = new VideoCompositionEngine(ctxMem);
  await engMem.initialize();

  const reqMem  = makeRequest({ id: "comp-mem-test", generationResponseId: "gen-zzz" });
  await engMem.compose(reqMem);

  const cached15 = memStore15.get(`comp:comp-mem-test`);
  assert(cached15 !== undefined,           "Memory must store composition response after successful composition");
  assert(cached15.requestId === "comp-mem-test", "Cached response must reference correct compositionId");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Memory Integration.\n");

  // ==========================================
  // 16. Agent Integration
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("16. Agent Integration...");
  // Verify ICompositionEngine interface contract is satisfied by VideoCompositionEngine
  const engAgent: import("./video-composition/interfaces").ICompositionEngine = new VideoCompositionEngine(makeContext());
  assert(typeof engAgent.initialize     === "function", "ICompositionEngine.initialize must be a function");
  assert(typeof engAgent.start          === "function", "ICompositionEngine.start must be a function");
  assert(typeof engAgent.stop           === "function", "ICompositionEngine.stop must be a function");
  assert(typeof engAgent.compose        === "function", "ICompositionEngine.compose must be a function");
  assert(typeof engAgent.getSnapshot    === "function", "ICompositionEngine.getSnapshot must be a function");
  assert(typeof engAgent.getReport      === "function", "ICompositionEngine.getReport must be a function");
  assert(typeof engAgent.getHistory     === "function", "ICompositionEngine.getHistory must be a function");
  assert(typeof engAgent.state          !== undefined,  "ICompositionEngine.state must be accessible");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Agent Integration.\n");

  // ==========================================
  // 17. Event Publishing
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("17. Event Publishing...");
  const ctxEvt = makeContext();
  const engEvt = new VideoCompositionEngine(ctxEvt);
  await engEvt.initialize();
  await engEvt.compose(makeRequest({ id: "comp-evt-test", generationResponseId: "gen-evt" }));

  const publishedEvents = (ctxEvt.eventBus._events as any[]).map((e) => e.name);
  const requiredEvents  = [
    "CompositionStarted",
    "TrackGenerated",
    "SyncCompleted",
    "TimelineCreated",
    "TimelineOptimized",
    "CompositionCompleted",
  ];

  for (const evtName of requiredEvents) {
    assert(
      publishedEvents.includes(evtName),
      `Required event "${evtName}" must be published`
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Event Publishing.\n");

  // ==========================================
  // 18. Snapshot Immutability
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("18. Snapshot Immutability...");
  const snap18 = resp3.report.compositionId
    ? (() => {
        const eng = new VideoCompositionEngine(makeContext());
        return null; // placeholder, we'll use the snapshot from engine
      })()
    : null;

  // Use the engine from test 3 that has already composed
  const engSnap18 = new VideoCompositionEngine(makeContext());
  await engSnap18.initialize();
  const respSnap18 = await engSnap18.compose(makeRequest({ id: "comp-snap-test", generationResponseId: "gen-snap" }));
  const snapshot18 = engSnap18.getSnapshot("comp-snap-test");

  assert(Object.isFrozen(snapshot18), "CompositionSnapshot root must be deeply frozen");
  assert(Object.isFrozen(snapshot18.metrics), "CompositionSnapshot.metrics must be frozen");

  let frozenCheck = false;
  try {
    (snapshot18 as any).compositionId = "hacked";
    // In strict mode this throws; in sloppy mode the write is silently ignored
  } catch (e: unknown) {
    frozenCheck = true;
  }
  // The snapshot is frozen — either the write threw or was silently ignored (Object.isFrozen ensures immutability)
  assert(snapshot18.compositionId === "comp-snap-test", "Snapshot compositionId must remain immutable");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Snapshot Immutability.\n");

  // ==========================================
  // 19. Validator Rules
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("19. Validator Rules...");

  // 19a. Missing ID
  try {
    VideoCompositionValidator.validateRequest({
      id:                   "",
      generationResponseId: "gen-001",
      state:                CompositionState.CREATED,
      timestamp:            new Date(),
    });
    throw new Error("Expected VideoCompositionValidationException for empty ID");
  } catch (err: unknown) {
    assert(
      err instanceof VideoCompositionValidationException,
      "Empty request ID must throw VideoCompositionValidationException"
    );
  }

  // 19b. Invalid timestamps in clip
  try {
    VideoCompositionValidator.validateClip(
      {
        id:               "clip-bad",
        trackId:          "track-1",
        assetId:          "asset-1",
        assetPath:        "/a.mp4",
        startTimeSeconds: 10,
        endTimeSeconds:   5,       // end < start
        durationSeconds:  0,
        inPoint:          0,
        outPoint:         0,
        transitions:      [],
        effects:          [],
        opacity:          1.0,
        metadata:         {},
      },
      30
    );
    throw new Error("Expected VideoCompositionValidationException for invalid clip timestamps");
  } catch (err: unknown) {
    assert(
      err instanceof VideoCompositionValidationException,
      "Clip with endTime < startTime must throw VideoCompositionValidationException"
    );
  }

  // 19c. Invalid state transition
  try {
    VideoCompositionValidator.validateStateTransition(
      "comp-x",
      CompositionState.CREATED,
      CompositionState.COMPLETED   // invalid: must go through INITIALIZED first
    );
    throw new Error("Expected VideoCompositionValidationException for invalid state transition");
  } catch (err: unknown) {
    assert(
      err instanceof VideoCompositionValidationException,
      "Invalid state transition must throw VideoCompositionValidationException"
    );
  }

  // 19d. Audio sync — no voice or music
  try {
    VideoCompositionValidator.validateAudioSync(0, 0);
    throw new Error("Expected VideoCompositionValidationException for missing audio");
  } catch (err: unknown) {
    assert(
      err instanceof VideoCompositionValidationException,
      "Zero voice and music clips must throw VideoCompositionValidationException"
    );
  }

  // 19e. Duplicate composition request
  const engDup = new VideoCompositionEngine(makeContext());
  await engDup.initialize();
  const dupReq = makeRequest({ id: "comp-dup-001", generationResponseId: "gen-dup" });
  await engDup.compose(dupReq);
  try {
    await engDup.compose(dupReq);
    throw new Error("Expected DuplicateCompositionException");
  } catch (err: unknown) {
    assert(
      err instanceof DuplicateCompositionException,
      "Duplicate composition ID must throw DuplicateCompositionException"
    );
  }
  // eslint-disable-next-line no-console
  console.log("✓ Verified Validator Rules.\n");

  // ==========================================
  // 20. Full End-to-End Video Composition
  // ==========================================
  // eslint-disable-next-line no-console
  console.log("20. Full End-to-End Video Composition...");

  const e2eHistory = [
    {
      requestId: "gen-full-e2e",
      assets: [
        { id: "e2e-vid-1",   assetType: "VIDEO",      filePath: "/e2e/vid-1.mp4",   duration: 12 },
        { id: "e2e-vid-2",   assetType: "VIDEO",      filePath: "/e2e/vid-2.mp4",   duration: 8  },
        { id: "e2e-img-1",   assetType: "IMAGE",      filePath: "/e2e/img-1.png",   duration: 5  },
        { id: "e2e-bg-1",    assetType: "BACKGROUND", filePath: "/e2e/bg-1.png",    duration: 30 },
        { id: "e2e-voice-1", assetType: "VOICE",      filePath: "/e2e/voice-1.mp3", duration: 12 },
        { id: "e2e-voice-2", assetType: "VOICE",      filePath: "/e2e/voice-2.mp3", duration: 8  },
        { id: "e2e-music-1", assetType: "MUSIC",      filePath: "/e2e/music-1.wav", duration: 30 },
        { id: "e2e-sfx-1",   assetType: "SFX",        filePath: "/e2e/sfx-1.wav",   duration: 2  },
        { id: "e2e-sub-1",   assetType: "SUBTITLE",   filePath: "/e2e/sub-1.srt"                 },
        { id: "e2e-sub-2",   assetType: "SUBTITLE",   filePath: "/e2e/sub-2.srt"                 },
      ],
    },
  ];

  let e2eDecisionCalled = false;
  const memStoreE2E = new Map<string, any>();
  const eventsE2E: string[] = [];

  const ctxE2E = makeContext({
    generationEngine: { getHistory: () => e2eHistory },
    memoryStore: {
      get: async (_ns: string, key: string) => memStoreE2E.get(key) ? { value: memStoreE2E.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { memStoreE2E.set(key, value); },
    },
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: (_t: any) => ({
        record: async (_data: any) => { e2eDecisionCalled = true; },
      }),
    },
    eventBus: {
      publish: async (evt: any) => { eventsE2E.push(evt.name); },
    },
  });

  const engE2E = new VideoCompositionBuilder()
    .withContext(ctxE2E)
    .withMetadata({ sprint: "12.7", author: "Antigravity" })
    .build();

  await engE2E.initialize();

  const reqE2E = makeRequest({
    id:                   "comp-e2e-001",
    generationResponseId: "gen-full-e2e",
    options: {
      targetResolution:   "1920x1080",
      targetFps:          30,
      defaultTransition:  TransitionType.FADE,
      enableSubtitles:    true,
      enableColorGrade:   true,
      brandingEnabled:    true,
    },
  });

  const respE2E = await engE2E.compose(reqE2E);

  // Timeline
  assert(respE2E.state === CompositionState.COMPLETED, "E2E: composition state must be COMPLETED");
  assert(respE2E.timeline.durationSeconds > 0,         "E2E: timeline duration must be positive");
  assert(respE2E.timeline.tracks.length > 0,           "E2E: timeline must contain tracks");
  assert(respE2E.timeline.fps === 30,                  "E2E: FPS must be 30");
  assert(respE2E.timeline.resolution === "1920x1080",  "E2E: resolution must be 1920x1080");

  // Audio
  assert(respE2E.timeline.audioTrack.voiceClips.length >= 2, "E2E: must have at least 2 voice clips");
  assert(respE2E.timeline.audioTrack.musicClips.length >= 1, "E2E: must have at least 1 music clip");
  assert(respE2E.timeline.audioTrack.sfxClips.length  >= 1,  "E2E: must have at least 1 SFX clip");

  // Subtitles
  assert(respE2E.timeline.subtitleTrack.entries.length >= 2, "E2E: must have at least 2 subtitle entries");

  // Transitions
  const e2eAllClips = respE2E.timeline.tracks.flatMap((t) => t.clips);
  assert(
    e2eAllClips.some((c) => c.transitions.length > 0),
    "E2E: at least one clip must have transitions"
  );

  // Effects
  assert(
    e2eAllClips.some((c) => c.effects.length > 0),
    "E2E: at least one clip must have effects"
  );

  // Metrics
  assert(respE2E.metrics.totalClips > 0,      "E2E: metrics must report totalClips > 0");
  assert(respE2E.metrics.totalTracks > 0,     "E2E: metrics must report totalTracks > 0");
  assert(respE2E.metrics.durationSeconds > 0, "E2E: metrics must report positive duration");

  // Report
  assert(respE2E.report.assembledClips > 0,   "E2E: report must show assembled clips > 0");
  assert(respE2E.report.totalAssets > 0,      "E2E: report must show totalAssets > 0");

  // Snapshot
  const snapE2E = engE2E.getSnapshot("comp-e2e-001");
  assert(snapE2E.compositionId === "comp-e2e-001",      "E2E: snapshot compositionId must match");
  assert(snapE2E.state         === CompositionState.COMPLETED, "E2E: snapshot state must be COMPLETED");
  assert(Object.isFrozen(snapE2E),                      "E2E: snapshot must be immutable (frozen)");

  // Memory
  assert(memStoreE2E.get("comp:comp-e2e-001") !== undefined, "E2E: response must be stored in memory");

  // Decision
  assert(e2eDecisionCalled, "E2E: decision engine must record composition outcome");

  // Events
  const requiredE2EEvents = [
    "CompositionStarted", "TrackGenerated", "SyncCompleted",
    "TimelineCreated", "TimelineOptimized", "CompositionCompleted",
  ];
  for (const ev of requiredE2EEvents) {
    assert(eventsE2E.includes(ev), `E2E: event "${ev}" must be published`);
  }

  // History
  const history20 = engE2E.getHistory();
  assert(history20.length === 1,                               "E2E: history must contain the completed composition");
  assert(history20[0].requestId === "comp-e2e-001",           "E2E: history entry must match request ID");
  // eslint-disable-next-line no-console
  console.log("✓ Verified Full End-to-End Video Composition.\n");

  // ─── Summary ──────────────────────────────────────────────────────────────

  // eslint-disable-next-line no-console
  console.log("=== ALL 20 VIDEO COMPOSITION ENGINE TESTS PASSED ✓ ===");
}

runTests().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
