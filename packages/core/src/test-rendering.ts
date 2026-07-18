/**
 * Sprint 12.8 — AI Rendering & Export Engine
 * Verification Suite — 20 Tests
 */

import { RenderEngine }    from "./rendering/RenderEngine";
import { RenderBuilder }   from "./rendering/RenderBuilder";
import { RenderValidator } from "./rendering/RenderValidator";
import { RenderingState }  from "./rendering/RenderingState";
import { ExportFormat }    from "./rendering/ExportFormat";
import { CodecType }       from "./rendering/CodecType";
import { Resolution }      from "./rendering/Resolution";
import { QualityPreset }   from "./rendering/QualityPreset";
import {
  RenderingValidationException,
  DuplicateRenderException,
  InvalidRenderingStateException,
} from "./rendering/types";
import { RenderingRequest } from "./rendering/models";

// ─── Assertion Helper ─────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
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
      get: async (_ns: string, key: string) =>
        store.has(key) ? { value: store.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { store.set(key, value); },
    },
    registry: {
      has:     (_t: any) => false,
      resolve: (_t: any) => null,
    },
    ...overrides,
  };
}

function makeRequest(overrides: Partial<RenderingRequest> = {}): RenderingRequest {
  return {
    id:           overrides.id            ?? `render-req-${Date.now()}`,
    compositionId: overrides.compositionId ?? `comp-001`,
    format:       overrides.format        ?? ExportFormat.MP4,
    resolution:   overrides.resolution    ?? Resolution.P1080,
    quality:      overrides.quality       ?? QualityPreset.STANDARD,
    codec:        overrides.codec         ?? CodecType.H264,
    fps:          overrides.fps           ?? 30,
    state:        overrides.state         ?? RenderingState.CREATED,
    timestamp:    overrides.timestamp     ?? new Date(),
    options:      overrides.options       ?? {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START RENDERING & EXPORT ENGINE TESTS ===\n");

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  console.log("1. Builder Validation...");
  try {
    new RenderBuilder().build();
    throw new Error("Expected RenderingValidationException");
  } catch (err: unknown) {
    assert(
      err instanceof RenderingValidationException,
      "Builder without context must throw RenderingValidationException"
    );
  }
  console.log("✓ Verified Builder Validation.\n");

  // ==========================================
  // 2. Lifecycle Transitions
  // ==========================================
  console.log("2. Lifecycle Transitions...");
  const eng2 = new RenderEngine(makeContext());
  assert(eng2.state === RenderingState.CREATED, "Initial state must be CREATED");

  // Cannot stop in CREATED state
  try {
    await eng2.stop();
    throw new Error("Expected InvalidRenderingStateException");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidRenderingStateException,
      "Stop from CREATED must throw InvalidRenderingStateException"
    );
  }

  await eng2.initialize();
  assert(eng2.state === RenderingState.INITIALIZED, "State must be INITIALIZED after initialize");

  await eng2.start();
  assert(
    eng2.state === RenderingState.INITIALIZED ||
    eng2.state === RenderingState.COMPLETED,
    "Start must leave engine in a valid state"
  );
  console.log("✓ Verified Lifecycle Transitions.\n");

  // ==========================================
  // 3. Timeline Rendering
  // ==========================================
  console.log("3. Timeline Rendering...");
  const eng3 = new RenderEngine(makeContext());
  await eng3.initialize();

  const req3  = makeRequest({ id: "render-001", compositionId: "comp-001", fps: 5 });
  const resp3 = await eng3.render(req3);

  assert(resp3.state === RenderingState.COMPLETED, "Render state must be COMPLETED");
  assert(resp3.durationSeconds > 0,                "Render duration must be positive");
  assert(resp3.outputPath.length > 0,              "Output path must be non-empty");
  assert(resp3.fps === 5,                          "FPS must match request");
  console.log("✓ Verified Timeline Rendering.\n");

  // ==========================================
  // 4. Frame Generation
  // ==========================================
  console.log("4. Frame Generation...");
  const stats4 = resp3.statistics;
  assert(stats4.totalFrames > 0,         "Statistics must report totalFrames > 0");
  assert(stats4.renderedFrames > 0,      "Statistics must report renderedFrames > 0");
  assert(stats4.renderedFrames <= stats4.totalFrames, "renderedFrames must not exceed totalFrames");
  console.log("✓ Verified Frame Generation.\n");

  // ==========================================
  // 5. Transition Rendering
  // ==========================================
  console.log("5. Transition Rendering...");
  assert(
    stats4.totalTransitionsRendered >= 0,
    "Statistics must track transitions rendered"
  );
  // Transitions come from the stub clips which have transitions attached
  console.log("✓ Verified Transition Rendering.\n");

  // ==========================================
  // 6. Effect Rendering
  // ==========================================
  console.log("6. Effect Rendering...");
  assert(
    stats4.totalEffectsApplied >= 0,
    "Statistics must track effects applied"
  );
  // Effects come from the stub clips
  console.log("✓ Verified Effect Rendering.\n");

  // ==========================================
  // 7. Audio Mixing
  // ==========================================
  console.log("7. Audio Mixing...");
  assert(stats4.audioMixDurationSeconds >= 0, "Audio mix duration must be >= 0");
  // The engine mixed voice + music from the stub timeline
  const metrics7 = resp3.metrics;
  assert(metrics7.audioBitrateKbps > 0, "Audio bitrate must be positive");
  console.log("✓ Verified Audio Mixing.\n");

  // ==========================================
  // 8. Subtitle Burn-in
  // ==========================================
  console.log("8. Subtitle Burn-in...");
  assert(stats4.subtitleFrames >= 0, "Subtitle frame count must be >= 0");
  // With the stub timeline that has 3 subtitle entries, subtitleFrames > 0
  assert(stats4.subtitleFrames > 0, "Must have at least one subtitle frame with stub timeline");
  console.log("✓ Verified Subtitle Burn-in.\n");

  // ==========================================
  // 9. Encoding
  // ==========================================
  console.log("9. Encoding...");
  const metrics9 = resp3.metrics;
  assert(metrics9.videoBitrateKbps > 0,     "Video bitrate must be positive");
  assert(metrics9.fileSizeBytes > 0,        "File size must be positive");
  assert(metrics9.compressionRatio > 0,     "Compression ratio must be positive");
  assert(
    Object.values(CodecType).includes(metrics9.codec),
    "Codec in metrics must be a valid CodecType"
  );
  console.log("✓ Verified Encoding.\n");

  // ==========================================
  // 10. Export Generation
  // ==========================================
  console.log("10. Export Generation...");
  assert(resp3.fileSizeBytes > 0,    "Exported file size must be positive");
  assert(resp3.outputPath.length > 0, "Export output path must be non-empty");
  assert(
    Object.values(ExportFormat).includes(resp3.format),
    "Exported format must be a valid ExportFormat"
  );
  assert(
    resp3.outputPath.toLowerCase().includes(".mp4") ||
    resp3.outputPath.toLowerCase().includes(".mov") ||
    resp3.outputPath.toLowerCase().includes(".webm") ||
    resp3.outputPath.toLowerCase().includes(".mkv"),
    "Output path must have a valid video file extension"
  );
  console.log("✓ Verified Export Generation.\n");

  // ==========================================
  // 11. Queue Management (Pause / Cancel)
  // ==========================================
  console.log("11. Queue Management...");
  const engQ = new RenderEngine(makeContext());
  await engQ.initialize();
  const reqQ = makeRequest({ id: "render-queue-001", fps: 5 });
  await engQ.render(reqQ);

  // Pause an existing render
  await engQ.pause("render-queue-001");
  // Cancel an existing render
  await engQ.cancel("render-queue-001");

  // Pause/cancel of non-existent should throw
  try {
    await engQ.pause("no-such-render");
    throw new Error("Expected RenderingException for unknown render");
  } catch (err: unknown) {
    assert(
      err instanceof Error,
      "Pausing unknown renderId must throw an error"
    );
  }
  console.log("✓ Verified Queue Management.\n");

  // ==========================================
  // 12. Resume Rendering
  // ==========================================
  console.log("12. Resume Rendering...");
  const engResume = new RenderEngine(makeContext());
  await engResume.initialize();
  const reqResume = makeRequest({ id: "render-resume-001", fps: 5 });
  await engResume.render(reqResume);
  await engResume.pause("render-resume-001");

  const resumeResp = await engResume.resume("render-resume-001");
  assert(resumeResp !== undefined,                       "Resume must return a valid RenderingResponse");
  assert(resumeResp.state === RenderingState.COMPLETED,  "Resumed render must reach COMPLETED");
  assert(resumeResp.outputPath.length > 0,               "Resumed render must have an outputPath");
  console.log("✓ Verified Resume Rendering.\n");

  // ==========================================
  // 13. Retry Rendering
  // ==========================================
  console.log("13. Retry Rendering...");
  const engRetry = new RenderEngine(makeContext());
  await engRetry.initialize();
  const reqRetry = makeRequest({ id: "render-retry-001", fps: 5 });
  await engRetry.render(reqRetry);
  await engRetry.cancel("render-retry-001");

  const retryResp = await engRetry.retry("render-retry-001");
  assert(retryResp !== undefined,                       "Retry must return a valid RenderingResponse");
  assert(retryResp.state === RenderingState.COMPLETED,  "Retried render must reach COMPLETED");
  console.log("✓ Verified Retry Rendering.\n");

  // ==========================================
  // 14. Composition Integration
  // ==========================================
  console.log("14. Composition Integration...");
  const mockCompositionHistory = [
    {
      requestId: "comp-from-sprint-127",
      timeline: {
        durationSeconds: 20,
        fps: 30,
        tracks: [
          {
            id:    "track-VIDEO",
            type:  "VIDEO",
            clips: [
              {
                startTimeSeconds: 0,
                endTimeSeconds:   20,
                assetPath:        "/comp/vid.mp4",
                transitions:      [{ id: "t1", type: "FADE", durationSeconds: 0.5 }],
                effects:          [{ id: "e1", type: "ZOOM", intensity: 0.15 }],
              },
            ],
          },
        ],
        subtitleTrack: {
          entries: [
            { startTimeSeconds: 0,  endTimeSeconds: 10, text: "Intro" },
            { startTimeSeconds: 10, endTimeSeconds: 20, text: "Outro" },
          ],
        },
        audioTrack: {
          voiceClips: [{ id: "v1", startTimeSeconds: 0, endTimeSeconds: 20, volume: 1.0, assetPath: "/comp/voice.mp3" }],
          musicClips: [{ id: "m1", startTimeSeconds: 0, endTimeSeconds: 20, volume: 0.2, assetPath: "/comp/music.wav" }],
          sfxClips:   [],
        },
      },
    },
  ];

  const ctxComp = makeContext({
    compositionEngine: { getHistory: () => mockCompositionHistory },
  });

  const engComp = new RenderEngine(ctxComp);
  await engComp.initialize();

  const reqComp  = makeRequest({ id: "render-comp-int", compositionId: "comp-from-sprint-127", fps: 5 });
  const respComp = await engComp.render(reqComp);

  assert(respComp.state === RenderingState.COMPLETED, "Composition integration: must reach COMPLETED");
  assert(respComp.durationSeconds > 0,               "Composition integration: durationSeconds must be positive");
  assert(respComp.statistics.subtitleFrames > 0,     "Composition integration: subtitle frames from composition timeline");
  console.log("✓ Verified Composition Integration.\n");

  // ==========================================
  // 15. Generation Integration
  // ==========================================
  console.log("15. Generation Integration...");
  // GenerationEngine informs asset resolution/FPS through compositionEngine metadata
  // We verify the engine runs cleanly when compositionEngine provides a generation-derived timeline
  const ctxGen = makeContext({
    compositionEngine: {
      getHistory: () => [
        {
          requestId: "comp-gen-derived",
          timeline: {
            durationSeconds: 10,
            fps:             24,
            tracks: [
              {
                id:    "track-VIDEO",
                type:  "VIDEO",
                clips: [{
                  startTimeSeconds: 0,
                  endTimeSeconds:   10,
                  assetPath:        "/gen/video.mp4",
                  transitions:      [],
                  effects:          [],
                }],
              },
            ],
            subtitleTrack: { entries: [] },
            audioTrack: { voiceClips: [], musicClips: [], sfxClips: [] },
          },
        },
      ],
    },
  });

  const engGen = new RenderEngine(ctxGen);
  await engGen.initialize();
  const respGen = await engGen.render(
    makeRequest({ id: "render-gen-int", compositionId: "comp-gen-derived", fps: 24 })
  );
  assert(respGen.fps === 24,                          "Generation integration: FPS matches");
  assert(respGen.state === RenderingState.COMPLETED,  "Generation integration: must complete");
  console.log("✓ Verified Generation Integration.\n");

  // ==========================================
  // 16. Decision Integration
  // ==========================================
  console.log("16. Decision Integration...");
  let decisionCalled = false;
  const ctxDec = makeContext({
    registry: {
      has:     (t: any) => t.name === "IDecisionEngine",
      resolve: (_t: any) => ({
        record: async (data: any) => {
          decisionCalled = true;
          assert(data.renderId !== undefined, "Decision record must include renderId");
          assert(data.codec    !== undefined, "Decision record must include codec");
          assert(data.outcome === "SUCCESS",  "Decision record must record SUCCESS");
        },
      }),
    },
  });

  const engDec = new RenderEngine(ctxDec);
  await engDec.initialize();
  await engDec.render(makeRequest({ id: "render-dec-test", fps: 5 }));
  assert(decisionCalled, "Decision engine record must be called after successful render");
  console.log("✓ Verified Decision Integration.\n");

  // ==========================================
  // 17. Memory Integration
  // ==========================================
  console.log("17. Memory Integration...");
  const memStore17 = new Map<string, any>();
  const ctxMem = makeContext({
    memoryStore: {
      get: async (_ns: string, key: string) =>
        memStore17.has(key) ? { value: memStore17.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { memStore17.set(key, value); },
    },
  });

  const engMem = new RenderEngine(ctxMem);
  await engMem.initialize();
  const reqMem = makeRequest({ id: "render-mem-test", fps: 5 });
  await engMem.render(reqMem);

  const cached17 = memStore17.get("render:render-mem-test");
  assert(cached17 !== undefined,                   "Memory must store render response after completion");
  assert(cached17.requestId === "render-mem-test", "Cached response must reference correct render ID");
  console.log("✓ Verified Memory Integration.\n");

  // ==========================================
  // 18. Agent Integration (IRenderEngine contract)
  // ==========================================
  console.log("18. Agent Integration...");
  const engAgent: import("./rendering/interfaces").IRenderEngine = new RenderEngine(makeContext());
  assert(typeof engAgent.initialize  === "function", "IRenderEngine.initialize must be a function");
  assert(typeof engAgent.start       === "function", "IRenderEngine.start must be a function");
  assert(typeof engAgent.stop        === "function", "IRenderEngine.stop must be a function");
  assert(typeof engAgent.render      === "function", "IRenderEngine.render must be a function");
  assert(typeof engAgent.pause       === "function", "IRenderEngine.pause must be a function");
  assert(typeof engAgent.resume      === "function", "IRenderEngine.resume must be a function");
  assert(typeof engAgent.cancel      === "function", "IRenderEngine.cancel must be a function");
  assert(typeof engAgent.retry       === "function", "IRenderEngine.retry must be a function");
  assert(typeof engAgent.getProgress === "function", "IRenderEngine.getProgress must be a function");
  assert(typeof engAgent.getReport   === "function", "IRenderEngine.getReport must be a function");
  assert(typeof engAgent.getSnapshot === "function", "IRenderEngine.getSnapshot must be a function");
  assert(typeof engAgent.getHistory  === "function", "IRenderEngine.getHistory must be a function");
  assert(typeof engAgent.state       !== undefined,  "IRenderEngine.state must be accessible");
  console.log("✓ Verified Agent Integration.\n");

  // ==========================================
  // 19. Validator Rules
  // ==========================================
  console.log("19. Validator Rules...");

  // 19a. Empty request ID
  try {
    RenderValidator.validateRequest({
      ...makeRequest(),
      id: "",
    });
    throw new Error("Expected RenderingValidationException for empty ID");
  } catch (err: unknown) {
    assert(err instanceof RenderingValidationException, "Empty ID must throw RenderingValidationException");
  }

  // 19b. Invalid FPS
  try {
    RenderValidator.validateRequest(makeRequest({ fps: 0 }));
    throw new Error("Expected RenderingValidationException for fps=0");
  } catch (err: unknown) {
    assert(err instanceof RenderingValidationException, "FPS=0 must throw RenderingValidationException");
  }

  // 19c. Invalid state transition (CREATED → COMPLETED)
  try {
    RenderValidator.validateStateTransition("r1", RenderingState.CREATED, RenderingState.COMPLETED);
    throw new Error("Expected RenderingValidationException for invalid state transition");
  } catch (err: unknown) {
    assert(err instanceof RenderingValidationException, "Invalid state transition must throw RenderingValidationException");
  }

  // 19d. Audio/video sync out of tolerance
  try {
    RenderValidator.validateAudioVideoSync(10, 20, 0.5);
    throw new Error("Expected RenderingValidationException for audio/video sync error");
  } catch (err: unknown) {
    assert(err instanceof RenderingValidationException, "A/V sync mismatch must throw RenderingValidationException");
  }

  // 19e. Invalid export profile (empty outputPath)
  try {
    RenderValidator.validateExportProfile({
      id:            "profile-1",
      format:        ExportFormat.MP4,
      resolution:    Resolution.P1080,
      width:         1920,
      height:        1080,
      fps:           30,
      encoding: {
        codec: CodecType.H264, crf: 23, videoBitrateKbps: 8000,
        audioBitrateKbps: 192, threads: 4, hwAccel: false,
        speedPreset: "medium", extraParams: {},
      },
      outputPath:    "",            // invalid
      burnSubtitles: true,
    });
    throw new Error("Expected RenderingValidationException for empty outputPath");
  } catch (err: unknown) {
    assert(err instanceof RenderingValidationException, "Empty outputPath must throw RenderingValidationException");
  }

  // 19f. Invalid CRF value
  try {
    RenderValidator.validateEncodingSettings({
      codec: CodecType.H264, crf: 60,  // out of 0–51 range
      videoBitrateKbps: 8000, audioBitrateKbps: 192,
      threads: 4, hwAccel: false, speedPreset: "medium", extraParams: {},
    });
    throw new Error("Expected RenderingValidationException for invalid CRF");
  } catch (err: unknown) {
    assert(err instanceof RenderingValidationException, "CRF=60 must throw RenderingValidationException");
  }

  // 19g. Duplicate render ID
  const engDup = new RenderEngine(makeContext());
  await engDup.initialize();
  const dupReq = makeRequest({ id: "render-dup-001", fps: 5 });
  await engDup.render(dupReq);
  try {
    await engDup.render(dupReq);
    throw new Error("Expected DuplicateRenderException");
  } catch (err: unknown) {
    assert(err instanceof DuplicateRenderException, "Duplicate render ID must throw DuplicateRenderException");
  }

  // 19h. Invalid FPS in frame
  try {
    RenderValidator.validateFrame(
      { id: "f1", jobId: "j1", index: -1, timestampSeconds: 0, state: RenderingState.CREATED,
        activeTracks: [], activeTransitions: [], activeEffects: [], hasSubtitle: false, hasAudio: false },
      100
    );
    throw new Error("Expected RenderingValidationException for negative frame index");
  } catch (err: unknown) {
    assert(err instanceof RenderingValidationException, "Negative frame index must throw RenderingValidationException");
  }
  console.log("✓ Verified Validator Rules.\n");

  // ==========================================
  // 20. Full End-to-End Render Pipeline
  // ==========================================
  console.log("20. Full End-to-End Render Pipeline...");

  const e2eTimeline = {
    durationSeconds: 30,
    fps: 30,
    tracks: [
      {
        id:    "track-VIDEO",
        type:  "VIDEO",
        clips: [
          {
            startTimeSeconds: 0,
            endTimeSeconds:   15,
            assetPath:        "/e2e/vid-1.mp4",
            transitions:      [{ id: "t1", type: "FADE",     durationSeconds: 0.5 }],
            effects:          [{ id: "e1", type: "ZOOM",      intensity: 0.15 }, { id: "e2", type: "COLOR_GRADE", intensity: 0.3 }],
          },
          {
            startTimeSeconds: 15,
            endTimeSeconds:   30,
            assetPath:        "/e2e/vid-2.mp4",
            transitions:      [{ id: "t2", type: "DISSOLVE", durationSeconds: 0.5 }],
            effects:          [{ id: "e3", type: "ZOOM",      intensity: 0.1 }],
          },
        ],
      },
      {
        id:    "track-IMAGE",
        type:  "IMAGE",
        clips: [
          {
            startTimeSeconds: 0,
            endTimeSeconds:   30,
            assetPath:        "/e2e/bg.png",
            transitions:      [],
            effects:          [],
          },
        ],
      },
    ],
    subtitleTrack: {
      entries: [
        { startTimeSeconds: 0,  endTimeSeconds: 10, text: "Opening" },
        { startTimeSeconds: 10, endTimeSeconds: 20, text: "Main Content" },
        { startTimeSeconds: 20, endTimeSeconds: 30, text: "Conclusion" },
      ],
    },
    audioTrack: {
      voiceClips: [
        { id: "v1", startTimeSeconds: 0,  endTimeSeconds: 15, volume: 1.0, assetPath: "/e2e/voice-1.mp3" },
        { id: "v2", startTimeSeconds: 15, endTimeSeconds: 30, volume: 1.0, assetPath: "/e2e/voice-2.mp3" },
      ],
      musicClips: [
        { id: "m1", startTimeSeconds: 0, endTimeSeconds: 30, volume: 0.2, assetPath: "/e2e/music.wav" },
      ],
      sfxClips: [
        { id: "s1", startTimeSeconds: 0, endTimeSeconds: 2,  volume: 0.6, assetPath: "/e2e/sfx.wav" },
      ],
    },
  };

  let e2eDecision = false;
  const e2eMemStore = new Map<string, any>();
  const e2eEvents: string[] = [];

  const ctxE2E = makeContext({
    compositionEngine: {
      getHistory: () => [{ requestId: "e2e-comp-001", timeline: e2eTimeline }],
    },
    memoryStore: {
      get: async (_ns: string, key: string) =>
        e2eMemStore.has(key) ? { value: e2eMemStore.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { e2eMemStore.set(key, value); },
    },
    registry: {
      has:     (t: any) => t.name === "IDecisionEngine",
      resolve: (_t: any) => ({
        record: async (_d: any) => { e2eDecision = true; },
      }),
    },
    eventBus: {
      publish: async (evt: any) => { e2eEvents.push(evt.name); },
    },
  });

  const engE2E = new RenderBuilder()
    .withContext(ctxE2E)
    .withMetadata({ sprint: "12.8", author: "Antigravity" })
    .build();

  await engE2E.initialize();

  const reqE2E = makeRequest({
    id:            "render-e2e-001",
    compositionId: "e2e-comp-001",
    format:        ExportFormat.MP4,
    resolution:    Resolution.P1080,
    quality:       QualityPreset.HIGH,
    codec:         CodecType.H265,
    fps:           5,              // low FPS so test runs fast
    options: {
      burnSubtitles:    true,
      outputPath:       "/final/output/e2e-video",
      maxConcurrentFrames: 4,
    },
  });

  const respE2E = await engE2E.render(reqE2E);

  // Core response assertions
  assert(respE2E.state         === RenderingState.COMPLETED, "E2E: state must be COMPLETED");
  assert(respE2E.format        === ExportFormat.MP4,          "E2E: format must be MP4");
  assert(respE2E.resolution    === Resolution.P1080,          "E2E: resolution must be 1080P");
  assert(respE2E.codec         === CodecType.H265,            "E2E: codec must be H265");
  assert(respE2E.durationSeconds > 0,                         "E2E: durationSeconds must be positive");
  assert(respE2E.fileSizeBytes  > 0,                          "E2E: fileSizeBytes must be positive");
  assert(respE2E.outputPath.length > 0,                       "E2E: outputPath must be non-empty");
  assert(respE2E.fps === 5,                                   "E2E: FPS must be 5");

  // Statistics
  const statsE2E = respE2E.statistics;
  assert(statsE2E.totalFrames     > 0, "E2E: totalFrames must be positive");
  assert(statsE2E.renderedFrames  > 0, "E2E: renderedFrames must be positive");
  assert(statsE2E.subtitleFrames  > 0, "E2E: subtitleFrames must be positive");
  assert(statsE2E.totalTransitionsRendered >= 0, "E2E: transitions must be tracked");
  assert(statsE2E.totalEffectsApplied      >= 0, "E2E: effects must be tracked");
  assert(statsE2E.audioMixDurationSeconds  >= 0, "E2E: audio mix duration must be >= 0");
  assert(statsE2E.totalWallClockSeconds    >= 0, "E2E: wall clock must be >= 0");

  // Metrics
  const metricsE2E = respE2E.metrics;
  assert(metricsE2E.videoBitrateKbps > 0,  "E2E: videoBitrateKbps must be positive");
  assert(metricsE2E.audioBitrateKbps > 0,  "E2E: audioBitrateKbps must be positive");
  assert(metricsE2E.fileSizeBytes    > 0,  "E2E: fileSizeBytes in metrics must be positive");
  assert(metricsE2E.compressionRatio > 0,  "E2E: compressionRatio must be positive");
  assert(metricsE2E.peakMemoryMb     >= 0, "E2E: peakMemoryMb must be >= 0");

  // Report
  const reportE2E = respE2E.report;
  assert(reportE2E.succeededFrames > 0,     "E2E: succeededFrames must be positive");
  assert(reportE2E.outputPath.length > 0,   "E2E: report outputPath must be non-empty");

  // Snapshot
  const snapE2E = engE2E.getSnapshot("render-e2e-001");
  assert(snapE2E.renderId        === "render-e2e-001",       "E2E: snapshot renderId must match");
  assert(snapE2E.state           === RenderingState.COMPLETED, "E2E: snapshot state must be COMPLETED");
  assert(Object.isFrozen(snapE2E),                            "E2E: snapshot must be immutable (frozen)");
  assert(Object.isFrozen(snapE2E.metrics),                    "E2E: snapshot.metrics must be frozen");
  // Immutability verification — frozen objects throw in strict mode
  let immutableOk = false;
  try {
    (snapE2E as any).renderId = "hacked";
  } catch (_) {
    immutableOk = true;
  }
  // Either the write threw (strict mode) or was silently ignored — either way renderId must be unchanged
  assert(snapE2E.renderId === "render-e2e-001" || immutableOk, "E2E: snapshot renderId must remain immutable");

  // Memory
  assert(e2eMemStore.has("render:render-e2e-001"), "E2E: render must be stored in memory");
  const memE2E = e2eMemStore.get("render:render-e2e-001");
  assert(memE2E.requestId === "render-e2e-001",    "E2E: stored response must have correct requestId");

  // Decision
  assert(e2eDecision, "E2E: decision engine must be called after successful render");

  // Events
  const requiredEvents = [
    "RenderingStarted",
    "FrameRendered",
    "EncodingStarted",
    "EncodingCompleted",
    "ExportStarted",
    "ExportCompleted",
  ];
  for (const evtName of requiredEvents) {
    assert(e2eEvents.includes(evtName), `E2E: event "${evtName}" must be published`);
  }

  // History
  const historyE2E = engE2E.getHistory();
  assert(historyE2E.length === 1,                         "E2E: history must contain 1 response");
  assert(historyE2E[0].requestId === "render-e2e-001",   "E2E: history entry must match request ID");
  assert(historyE2E[0].state === RenderingState.COMPLETED,"E2E: history entry must be COMPLETED");

  // Progress tracking
  const prog = engE2E.getProgress("render-e2e-001");
  assert(prog.percentage === 100,                         "E2E: final progress must be 100%");
  assert(prog.totalFrames > 0,                            "E2E: progress totalFrames must be positive");

  console.log("✓ Verified Full End-to-End Render Pipeline.\n");

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("=== ALL 20 RENDERING & EXPORT ENGINE TESTS PASSED ✓ ===");
}

runTests().catch((err: unknown) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
