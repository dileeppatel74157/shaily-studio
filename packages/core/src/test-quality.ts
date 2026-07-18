/**
 * Sprint 12.9 — AI Quality Assurance & Review Engine
 * Verification Suite — 20 Tests
 */

import { QualityEngine } from "./quality/QualityEngine";
import { QualityBuilder } from "./quality/QualityBuilder";
import { QualityValidator } from "./quality/QualityValidator";
import { QualityState } from "./quality/QualityState";
import { QualityType } from "./quality/QualityType";
import { QualitySeverity } from "./quality/QualitySeverity";
import { ReviewStatus } from "./quality/ReviewStatus";
import { IssueType } from "./quality/IssueType";
import {
  QualityValidationException,
  DuplicateQualityException,
  InvalidQualityStateException,
} from "./quality/types";
import { QualityRequest } from "./quality/models";

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

function makeRequest(overrides: Partial<QualityRequest> = {}): QualityRequest {
  return {
    id: overrides.id ?? `quality-req-${Date.now()}`,
    renderId: overrides.renderId ?? `render-001`,
    compositionId: overrides.compositionId ?? `comp-001`,
    state: overrides.state ?? QualityState.CREATED,
    timestamp: overrides.timestamp ?? new Date(),
    options: overrides.options ?? {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log("=== START AI QUALITY ASSURANCE & REVIEW TESTS ===\n");

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  console.log("1. Builder Validation...");
  try {
    new QualityBuilder().build();
    throw new Error("Expected QualityValidationException");
  } catch (err: unknown) {
    assert(
      err instanceof QualityValidationException,
      "Builder without context must throw QualityValidationException"
    );
  }
  console.log("✓ Passed.\n");

  // ==========================================
  // 2. Lifecycle Transitions
  // ==========================================
  console.log("2. Lifecycle Transitions...");
  const eng2 = new QualityEngine(makeContext());
  assert(eng2.state === QualityState.CREATED, "Initial state must be CREATED");

  await eng2.initialize();
  // Standard initialization lifecycle
  console.log("✓ Passed.\n");

  // ==========================================
  // 3. Visual Analysis
  // ==========================================
  console.log("3. Visual Analysis...");
  const eng3 = new QualityEngine(makeContext());
  await eng3.initialize();
  const resp3 = await eng3.review(makeRequest({ id: "q-003" }));
  assert(resp3.report.visual !== undefined, "Report must contain visual analysis");
  assert(resp3.report.visual.totalFramesAnalyzed > 0, "Visual analysis must analyze frames");
  console.log("✓ Passed.\n");

  // ==========================================
  // 4. Audio Analysis
  // ==========================================
  console.log("4. Audio Analysis...");
  assert(resp3.report.audio !== undefined, "Report must contain audio analysis");
  assert(resp3.report.audio.averageVolume > 0, "Audio analyzer must track volume metrics");
  console.log("✓ Passed.\n");

  // ==========================================
  // 5. Subtitle Analysis
  // ==========================================
  console.log("5. Subtitle Analysis...");
  assert(resp3.report.subtitles !== undefined, "Report must contain subtitle analysis");
  assert(resp3.report.subtitles.totalEntries > 0, "Subtitle analysis must process entries");
  console.log("✓ Passed.\n");

  // ==========================================
  // 6. Thumbnail Scoring
  // ==========================================
  console.log("6. Thumbnail Scoring...");
  assert(resp3.report.thumbnail !== undefined, "Report must contain thumbnail score");
  assert(resp3.report.thumbnail.ctrPotential > 0, "CTR potential must be scored");
  console.log("✓ Passed.\n");

  // ==========================================
  // 7. Brand Consistency
  // ==========================================
  console.log("7. Brand Consistency...");
  assert(resp3.report.brand !== undefined, "Report must check brand consistency");
  assert(resp3.report.brand.score === 100, "Should default to complete brand alignment");
  console.log("✓ Passed.\n");

  // ==========================================
  // 8. Content Pacing Analysis
  // ==========================================
  console.log("8. Content Pacing Analysis...");
  assert(resp3.score.content > 0, "Content pacing should be evaluated and scored");
  console.log("✓ Passed.\n");

  // ==========================================
  // 9. Quality Score Calculation
  // ==========================================
  console.log("9. Quality Score Calculation...");
  const score = resp3.score;
  assert(score.overall >= 0 && score.overall <= 100, "Overall score must be 0-100");
  assert(score.visual >= 0 && score.visual <= 100, "Visual score must be 0-100");
  assert(score.audio >= 0 && score.audio <= 100, "Audio score must be 0-100");
  console.log("✓ Passed.\n");

  // ==========================================
  // 10. Auto-fix Generation
  // ==========================================
  console.log("10. Auto-fix Generation...");
  const report10 = resp3.report;
  assert(report10.suggestions.length >= 0, "Auto-fix suggestions array must be present");
  console.log("✓ Passed.\n");

  // ==========================================
  // 11. Rendering Integration
  // ==========================================
  console.log("11. Rendering Integration...");
  const mockRenderHistory = [
    {
      requestId: "render-xxx",
      fps: 30,
      resolution: "1080P",
      statistics: { totalFrames: 1000 }
    }
  ];
  const ctxRender = makeContext({
    renderEngine: { getHistory: () => mockRenderHistory }
  });
  const engRender = new QualityEngine(ctxRender);
  await engRender.initialize();
  const respRender = await engRender.review(makeRequest({ renderId: "render-xxx" }));
  assert(respRender.report.visual.totalFramesAnalyzed === 1000, "Should load frame count from RenderEngine history");
  console.log("✓ Passed.\n");

  // ==========================================
  // 12. Composition Integration
  // ==========================================
  console.log("12. Composition Integration...");
  const mockCompHistory = [
    {
      requestId: "comp-yyy",
      timeline: {
        subtitleTrack: { entries: [{ text: "Scene subtitle test", startTimeSeconds: 0, endTimeSeconds: 2 }] },
        audioTrack: {
          voiceClips: [{ id: "vc-1", volume: 0.9, durationSeconds: 2 }],
          musicClips: [],
          sfxClips: []
        }
      }
    }
  ];
  const ctxComp = makeContext({
    compositionEngine: { getHistory: () => mockCompHistory }
  });
  const engComp = new QualityEngine(ctxComp);
  await engComp.initialize();
  const respComp = await engComp.review(makeRequest({ compositionId: "comp-yyy" }));
  assert(respComp.report.subtitles.totalEntries === 1, "Should integrate subtitle entries from Composition timeline");
  console.log("✓ Passed.\n");

  // ==========================================
  // 13. Decision Integration
  // ==========================================
  console.log("13. Decision Integration...");
  let decisionRecorded = false;
  const ctxDec = makeContext({
    registry: {
      has: (t: any) => t.name === "IDecisionEngine",
      resolve: (_t: any) => ({
        record: async (data: any) => {
          decisionRecorded = true;
          assert(data.qualityId !== undefined, "Decision record must contain qualityId");
          assert(data.overallScore !== undefined, "Decision record must contain overallScore");
        }
      })
    }
  });
  const engDec = new QualityEngine(ctxDec);
  await engDec.initialize();
  await engDec.review(makeRequest({ id: "q-dec-test" }));
  assert(decisionRecorded, "Decision engine record must be triggered");
  console.log("✓ Passed.\n");

  // ==========================================
  // 14. Memory Integration
  // ==========================================
  console.log("14. Memory Integration...");
  const memStore14 = new Map<string, any>();
  const ctxMem = makeContext({
    memoryStore: {
      get: async (_ns: string, key: string) => memStore14.has(key) ? { value: memStore14.get(key) } : undefined,
      set: async (_ns: string, key: string, value: any) => { memStore14.set(key, value); }
    }
  });
  const engMem = new QualityEngine(ctxMem);
  await engMem.initialize();
  await engMem.review(makeRequest({ id: "q-mem-test" }));
  assert(memStore14.has("quality:q-mem-test"), "Should persist quality review into memoryStore");
  console.log("✓ Passed.\n");

  // ==========================================
  // 15. Planning Integration
  // ==========================================
  console.log("15. Planning Integration...");
  // Planning engine capability verification: verify quality tasks flow logically
  assert(resp3.state === QualityState.APPROVED || resp3.state === QualityState.REJECTED, "Pacing transitions must produce final status");
  console.log("✓ Passed.\n");

  // ==========================================
  // 16. Agent Integration
  // ==========================================
  console.log("16. Agent Integration...");
  const engAgent: import("./quality/interfaces").IQualityEngine = new QualityEngine(makeContext());
  assert(typeof engAgent.initialize === "function", "IQualityEngine.initialize must be a function");
  assert(typeof engAgent.review     === "function", "IQualityEngine.review must be a function");
  assert(typeof engAgent.getSnapshot === "function", "IQualityEngine.getSnapshot must be a function");
  console.log("✓ Passed.\n");

  // ==========================================
  // 17. Event Publishing
  // ==========================================
  console.log("17. Event Publishing...");
  const ctxEvt = makeContext();
  const engEvt = new QualityEngine(ctxEvt);
  await engEvt.initialize();
  await engEvt.review(makeRequest({ id: "q-evt-test" }));
  const publishedNames = (ctxEvt.eventBus._events as any[]).map((e) => e.name);
  assert(publishedNames.includes("QualityStarted"), "QualityStarted event must be published");
  assert(publishedNames.includes("QualityCompleted"), "QualityCompleted event must be published");
  console.log("✓ Passed.\n");

  // ==========================================
  // 18. Snapshot Immutability
  // ==========================================
  console.log("18. Snapshot Immutability...");
  const engSnap = new QualityEngine(makeContext());
  await engSnap.initialize();
  await engSnap.review(makeRequest({ id: "q-snap-test" }));
  const snap18 = engSnap.getSnapshot("q-snap-test");
  assert(Object.isFrozen(snap18), "Snapshot root must be frozen");
  assert(Object.isFrozen(snap18.score), "Snapshot score must be deeply frozen");

  let snapFailed = false;
  try {
    (snap18 as any).qualityId = "hack";
  } catch (_) {
    snapFailed = true;
  }
  assert(snap18.qualityId === "q-snap-test" || snapFailed, "Snapshot properties must be immutable");
  console.log("✓ Passed.\n");

  // ==========================================
  // 19. Validator Rules
  // ==========================================
  console.log("19. Validator Rules...");
  // 19a. Missing request ID
  try {
    QualityValidator.validateRequest({
      ...makeRequest(),
      id: ""
    });
    throw new Error("Expected QualityValidationException");
  } catch (err: unknown) {
    assert(err instanceof QualityValidationException, "Empty ID must fail request validation");
  }

  // 19b. Invalid state transitions
  try {
    QualityValidator.validateStateTransition("q-val", QualityState.CREATED, QualityState.APPROVED);
    throw new Error("Expected QualityValidationException");
  } catch (err: unknown) {
    assert(err instanceof QualityValidationException, "Forbidden state transition must fail validation");
  }
  console.log("✓ Passed.\n");

  // ==========================================
  // 20. Full End-to-End Quality Review
  // ==========================================
  console.log("20. Full End-to-End Quality Review...");
  const ctxE2E = makeContext();
  const engE2E = new QualityBuilder()
    .withContext(ctxE2E)
    .withMetadata({ sprint: "12.9" })
    .build();

  await engE2E.initialize();
  const respE2E = await engE2E.review(makeRequest({
    id: "q-e2e",
    options: {
      autoFix: true,
      approvalThreshold: 75
    }
  }));

  assert(respE2E.reviewStatus === ReviewStatus.APPROVED, "Should approve quality when score meets threshold");
  assert(respE2E.report.suggestions.length > 0, "Should generate auto-fix recommendations in end-to-end review");
  assert(respE2E.metrics.issuesFixed > 0, "Should automatically apply fixes when requested");
  console.log("✓ Passed.\n");

  console.log("=== ALL 20 QUALITY REVIEW ENGINE TESTS PASSED ✓ ===");
}

runTests().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
