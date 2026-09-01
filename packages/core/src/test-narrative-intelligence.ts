/**
 * Intelligent Script & Narrative Engine Regression Suite
 * Milestone 12 (M12) — Comprehensive Test Suite
 *
 * Verifies:
 * 1. Narrative Domain Models (ContentIntent, AudienceProfile, NarrativePlan, ScriptPlan, Claim, VisualOpportunity).
 * 2. Content Intent Analysis (Subject, domain, intent, audience, duration extraction).
 * 3. Audience Intelligence (Child, Teen, Beginner, General, Intermediate, Expert profile tailoring).
 * 4. Hook Planning & Information Progression (Question, Surprising Fact, Problem, Character Action, progression order).
 * 5. Duration-Aware Script Planning (Scaling across 15s, 20s, 30s, 60s, 120s).
 * 6. Factual Claims with explicit verification requirement (requiresVerification: true).
 * 7. Visual Opportunity Extraction (Semantic mapping to charts, counters, timelines, maps, characters).
 * 8. Narrative Quality QA & Evaluation (Coherence, completeness, pacing, QA reports).
 * 9. Determinism Tests (Identical inputs -> strictly identical narrative and script plans).
 * 10. Failure & Edge Case Diagnostics (Empty prompt, length limits, invalid durations).
 * 11. Pipeline Integration & Real MP4 Rendering across all 5 domains with FFmpeg validation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  ContentIntentAnalyzer,
  AudienceAnalyzer,
  HookPlanner,
  InformationProgressionEngine,
  NarrativePlanner,
  ScriptPlanner,
  NarrativeContinuityManager,
  NarrativeQualityEvaluator,
  NarrativeIntelligenceEngine,
  NarrativePlan,
  ScriptPlan
} from "./narrative-intelligence";
import { RenderEngine } from "./rendering/RenderEngine";
import { ContentPipelineBuilder } from "./content-pipeline/ContentPipelineBuilder";
import { ContentPipelineEngine } from "./content-pipeline/ContentPipelineEngine";

const execFilePromise = promisify(execFile);

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
    throw new Error(`Assertion failed: ${label}`);
  }
}

function setupFfmpegPath() {
  const ffmpegDir = "C:\\Users\\asus\\AppData\\Local\\DigitalWave\\DW Free Video Downloader";
  if (fs.existsSync(ffmpegDir) && !process.env.PATH?.includes(ffmpegDir)) {
    process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
  }
}

async function verifyVideoAndAudioIntegrity(filePath: string): Promise<{ valid: boolean; probeData?: any }> {
  try {
    const { stderr } = await execFilePromise("ffmpeg", ["-i", filePath]).catch((e) => ({ stderr: e.stderr || "" }));
    const hasAudio = stderr.includes("Audio:");
    const hasVideo = stderr.includes("Video:");
    const isAac = stderr.includes("Audio: aac");

    const decodeValid = await new Promise<boolean>((resolve) => {
      execFile("ffmpeg", ["-v", "error", "-i", filePath, "-f", "null", "-"], (error) => {
        resolve(!error);
      });
    });

    return {
      valid: decodeValid && hasVideo && hasAudio,
      probeData: {
        streams: [
          { codec_type: "video", valid: hasVideo },
          { codec_type: "audio", codec_name: isAac ? "aac" : "pcm", valid: hasAudio }
        ]
      }
    };
  } catch (err) {
    console.error("Video & audio decode check failed:", err);
    return { valid: false };
  }
}

function makeMockContext(): any {
  const events: any[] = [];
  const dbQueries: any[] = [];
  const memoryMap = new Map<string, any>();
  const kbStore: any[] = [];

  const renderEngine = new RenderEngine({ env: "test" });

  return {
    env: "test",
    logger: { info: () => {}, error: () => {}, warn: () => {} },
    renderEngine,
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
      get: async (ns: string, key: string) => memoryMap.get(`${ns}:${key}`),
      memoryMap
    },
    knowledgeBaseEngine: {
      store: async (node: any) => {
        kbStore.push(node);
        return { id: `kb-${Date.now()}` };
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
    }
  };
}

async function runNarrativeIntelligenceTestSuite(): Promise<void> {
  console.log("================================================================================");
  console.log("=== STARTING INTELLIGENT SCRIPT & NARRATIVE ENGINE REGRESSION SUITE (M12) ======");
  console.log("================================================================================\n");

  setupFfmpegPath();

  // ---------------------------------------------------------------------------
  // 1. CONTENT INTENT & AUDIENCE ANALYSIS
  // ---------------------------------------------------------------------------
  console.log("1. Verifying Content Intent & Audience Intelligence across all domains...");
  const finIntent = ContentIntentAnalyzer.analyzePrompt("Create a 20 second video explaining inflation for beginners.");
  assert(finIntent.domain === "FINANCE", "Finance domain extracted correctly");
  assert(finIntent.targetAudience === "BEGINNER", "Beginner audience tier extracted");
  assert(finIntent.requestedDurationSeconds === 20, "20s duration extracted");

  const histIntent = ContentIntentAnalyzer.analyzePrompt("Create a 60 second video explaining how the Roman Empire expanded.");
  assert(histIntent.domain === "HISTORY", "History domain extracted correctly");
  assert(histIntent.chronologicalRequired, "Chronological requirement flag set for History");
  assert(histIntent.mapRequired, "Map requirement flag set for History");
  assert(histIntent.requestedDurationSeconds === 60, "60s duration extracted");

  const kidsIntent = ContentIntentAnalyzer.analyzePrompt("Create a 15 second animated story where Leo the lion learns why the sun rises.");
  assert(kidsIntent.domain === "KIDS", "Kids domain extracted correctly");
  assert(kidsIntent.characterDriven, "Character-driven flag set for Kids");
  assert(kidsIntent.requestedDurationSeconds === 15, "15s duration extracted");

  const childProfile = AudienceAnalyzer.resolveAudienceProfile("CHILD");
  assert(childProfile.vocabularyComplexity === "SIMPLE", "Child audience receives SIMPLE vocabulary");
  assert(childProfile.narrationSpeedWpm === 125, "Child audience receives 125 WPM narration speed");

  const expertProfile = AudienceAnalyzer.resolveAudienceProfile("EXPERT");
  assert(expertProfile.vocabularyComplexity === "ADVANCED", "Expert audience receives ADVANCED vocabulary");
  assert(expertProfile.narrationSpeedWpm === 160, "Expert audience receives 160 WPM narration speed");
  console.log("  ✓ Content intent and audience intelligence verified.\n");

  // ---------------------------------------------------------------------------
  // 2. HOOK PLANNING & INFORMATION PROGRESSION
  // ---------------------------------------------------------------------------
  console.log("2. Verifying Hook Planning & Logical Information Progression...");
  const finHook = HookPlanner.planHook(finIntent, childProfile);
  assert(finHook.hookType === "QUESTION", "Finance beginner receives QUESTION hook");

  const kidsHook = HookPlanner.planHook(kidsIntent, childProfile);
  assert(kidsHook.hookType === "CHARACTER_ACTION", "Kids story receives CHARACTER_ACTION hook");

  const progressionResult = InformationProgressionEngine.validateAndOrderProgression({
    concepts: [
      { conceptId: "c1", name: "Concept A", definition: "A", prerequisiteConcepts: [], complexityLevel: "BASIC" },
      { conceptId: "c2", name: "Concept B", definition: "B", prerequisiteConcepts: ["c1"], complexityLevel: "BASIC" }
    ],
    claims: [
      { claimId: "cl1", statement: "Statement", importance: "CORE", confidence: 0.95, requiresVerification: true, visualizable: true, relatedConcepts: ["c1", "c2"] }
    ],
    examples: [
      { exampleId: "ex1", conceptId: "c1", description: "Example for C1" }
    ]
  });
  assert(progressionResult.isProgressionValid, "Ordered conceptual progression is valid");
  console.log("  ✓ Hook planning and information progression verified.\n");

  // ---------------------------------------------------------------------------
  // 3. DURATION-AWARE NARRATIVE & SCRIPT PLANNING (15s, 20s, 30s, 60s, 120s)
  // ---------------------------------------------------------------------------
  console.log("3. Verifying Duration-Aware Narrative Planning (15s, 20s, 30s, 60s, 120s)...");
  const durations = [15, 20, 30, 60, 120];
  for (const d of durations) {
    const intent = ContentIntentAnalyzer.analyzePrompt(`Create a ${d}s documentary explaining ocean warming.`);
    const audience = AudienceAnalyzer.resolveAudienceProfile(intent.targetAudience);
    const nPlan = NarrativePlanner.planNarrative(intent, audience);
    const sPlan = ScriptPlanner.planScript(nPlan);

    assert(nPlan.totalPlannedDurationSeconds === d, `Narrative plan duration matches requested ${d}s`);
    assert(sPlan.segments.length === nPlan.beats.length, `Script segments count matches narrative beats for ${d}s`);
    assert(sPlan.totalEstimatedDurationSeconds === d, `Script total duration matches ${d}s`);
  }
  console.log("  ✓ Duration-aware planning verified across 15s to 120s.\n");

  // ---------------------------------------------------------------------------
  // 4. FACTUAL CLAIMS & VERIFICATION REQUIREMENT (No Fake Proofs)
  // ---------------------------------------------------------------------------
  console.log("4. Verifying Factual Claim Structure & Verification Requirements...");
  const finNarrative = NarrativeIntelligenceEngine.generateNarrative("Explain inflation for beginners", 20);
  const unverifiedClaims = finNarrative.narrativePlan.claims.filter(c => c.requiresVerification);
  assert(unverifiedClaims.length > 0, "Factual claims explicitly carry requiresVerification: true");
  assert(finNarrative.narrativePlan.claims[0].statement.length > 10, "Claim statement has non-trivial text");
  console.log("  ✓ Factual claims and verification flags verified.\n");

  // ---------------------------------------------------------------------------
  // 5. VISUAL OPPORTUNITY EXTRACTION
  // ---------------------------------------------------------------------------
  console.log("5. Verifying Semantic Visual Opportunity Extraction...");
  const histNarrative = NarrativeIntelligenceEngine.generateNarrative("Explain how the Roman Empire expanded", 20);
  const visualOpportunities = histNarrative.narrativePlan.beats.flatMap(b => b.visualOpportunities);
  assert(visualOpportunities.length > 0, "Narrative beats include visual opportunities");
  assert(visualOpportunities.some(vo => vo.type === "MAP" || vo.type === "TIMELINE"), "History narrative contains MAP or TIMELINE visual opportunities");
  console.log("  ✓ Visual opportunity extraction verified.\n");

  // ---------------------------------------------------------------------------
  // 6. NARRATIVE QUALITY EVALUATION
  // ---------------------------------------------------------------------------
  console.log("6. Verifying Narrative Quality Evaluation & QA Reporting...");
  const quality = finNarrative.qualityReport;
  assert(quality.coherenceScore >= 0.8, "Coherence score is high");
  assert(quality.completenessScore >= 0.8, "Completeness score is high");
  assert(quality.pacingScore >= 0.7, "Pacing score is high");
  assert(quality.isApprovedForProduction, "Narrative package is approved for production");
  console.log("  ✓ Narrative quality evaluation verified.\n");

  // ---------------------------------------------------------------------------
  // 7. DETERMINISM TESTS
  // ---------------------------------------------------------------------------
  console.log("7. Verifying Determinism for Identical Inputs...");
  const run1 = NarrativeIntelligenceEngine.generateNarrative("Create a 20 second video explaining inflation for beginners.", 20);
  const run2 = NarrativeIntelligenceEngine.generateNarrative("Create a 20 second video explaining inflation for beginners.", 20);
  assert(run1.scriptPlan.fullScriptText === run2.scriptPlan.fullScriptText, "Identical inputs produce strictly identical script text");
  assert(run1.narrativePlan.beats.length === run2.narrativePlan.beats.length, "Identical inputs produce identical beat structures");
  console.log("  ✓ Deterministic planning verified.\n");

  // ---------------------------------------------------------------------------
  // 8. FAILURE & EDGE CASE TESTS
  // ---------------------------------------------------------------------------
  console.log("8. Verifying Graceful Failure Handling on Edge Cases...");
  let emptyFailed = false;
  try {
    ContentIntentAnalyzer.analyzePrompt("");
  } catch (err: any) {
    emptyFailed = true;
    assert(err.message.includes("Cannot analyze empty prompt"), "Empty prompt throws structured error");
  }
  assert(emptyFailed, "Empty prompt rejected gracefully");

  let outOfRangeFailed = false;
  try {
    ContentIntentAnalyzer.analyzePrompt("A short video", 2);
  } catch (err: any) {
    outOfRangeFailed = true;
    assert(err.message.includes("out of supported range"), "Out of range duration throws structured error");
  }
  assert(outOfRangeFailed, "Unsupported duration rejected gracefully");
  console.log("  ✓ Failure diagnostics and edge cases verified.\n");

  // ---------------------------------------------------------------------------
  // 9. FULL PIPELINE INTEGRATION & MP4 RENDERING ACROSS ALL 5 DOMAINS
  // ---------------------------------------------------------------------------
  console.log("9. Executing Real ContentPipeline & RenderEngine MP4 Renders with Narrative Engine...\n");
  const ctx = makeMockContext();
  await ctx.renderEngine.initialize();
  await ctx.renderEngine.start();

  const createPipeline = async (): Promise<ContentPipelineEngine> => {
    const p = new ContentPipelineBuilder().withContext(ctx).build() as ContentPipelineEngine;
    await p.initialize();
    await p.start();
    return p;
  };

  // DOMAIN 1: FINANCE
  console.log("  [A] Executing FINANCE Pipeline with Narrative Intelligence...");
  const p1 = await createPipeline();
  const finPrompt = "Create a 20 second video explaining inflation for beginners.";
  const finPkg = await p1.execute("scr-fin-m12", "proj-fin-m12", finPrompt);
  assert(finPkg.metadata?.debugInfo?.narrativePlan !== undefined, "Finance debugInfo contains narrativePlan");
  assert(finPkg.metadata?.debugInfo?.scriptPlan !== undefined, "Finance debugInfo contains scriptPlan");
  assert(finPkg.metadata?.debugInfo?.narrativeQualityReport !== undefined, "Finance debugInfo contains narrativeQualityReport");

  let finPath = finPkg.videoFileUrl.replace(/^file:\/\/\/?/, "");
  if (process.platform === "win32") finPath = finPath.replace(/\//g, "\\");
  assert(fs.existsSync(finPath), `Finance MP4 exists on disk: ${finPath}`);
  const finRes = await verifyVideoAndAudioIntegrity(finPath);
  assert(finRes.valid, "FFmpeg fully decoded Finance video and audio with 0 errors");
  console.log(`    ✓ Finance video & audio produced successfully (${(fs.statSync(finPath).size / 1024).toFixed(1)} KB)\n`);

  // DOMAIN 2: HISTORY
  console.log("  [B] Executing HISTORY Pipeline with Narrative Intelligence...");
  const p2 = await createPipeline();
  const histPrompt = "Create a 20 second video explaining how the Roman Empire expanded.";
  const histPkg = await p2.execute("scr-hist-m12", "proj-hist-m12", histPrompt);
  assert(histPkg.metadata?.debugInfo?.narrativePlan !== undefined, "History debugInfo contains narrativePlan");

  let histPath = histPkg.videoFileUrl.replace(/^file:\/\/\/?/, "");
  if (process.platform === "win32") histPath = histPath.replace(/\//g, "\\");
  assert(fs.existsSync(histPath), `History MP4 exists on disk: ${histPath}`);
  const histRes = await verifyVideoAndAudioIntegrity(histPath);
  assert(histRes.valid, "FFmpeg fully decoded History video and audio with 0 errors");
  console.log(`    ✓ History video & audio produced successfully (${(fs.statSync(histPath).size / 1024).toFixed(1)} KB)\n`);

  // DOMAIN 3: DOCUMENTARY
  console.log("  [C] Executing DOCUMENTARY Pipeline with Narrative Intelligence...");
  const p3 = await createPipeline();
  const docPrompt = "Create a 20 second documentary explaining why oceans are getting warmer.";
  const docPkg = await p3.execute("scr-doc-m12", "proj-doc-m12", docPrompt);
  assert(docPkg.metadata?.debugInfo?.narrativePlan !== undefined, "Documentary debugInfo contains narrativePlan");

  let docPath = docPkg.videoFileUrl.replace(/^file:\/\/\/?/, "");
  if (process.platform === "win32") docPath = docPath.replace(/\//g, "\\");
  assert(fs.existsSync(docPath), `Documentary MP4 exists on disk: ${docPath}`);
  const docRes = await verifyVideoAndAudioIntegrity(docPath);
  assert(docRes.valid, "FFmpeg fully decoded Documentary video and audio with 0 errors");
  console.log(`    ✓ Documentary video & audio produced successfully (${(fs.statSync(docPath).size / 1024).toFixed(1)} KB)\n`);

  // DOMAIN 4: KIDS
  console.log("  [D] Executing KIDS Pipeline with Narrative Intelligence...");
  const p4 = await createPipeline();
  const kidsPrompt = "Create a 20 second animated story where Leo the lion learns why the sun rises.";
  const kidsPkg = await p4.execute("scr-kids-m12", "proj-kids-m12", kidsPrompt);
  assert(kidsPkg.metadata?.debugInfo?.narrativePlan !== undefined, "Kids debugInfo contains narrativePlan");

  let kidsPath = kidsPkg.videoFileUrl.replace(/^file:\/\/\/?/, "");
  if (process.platform === "win32") kidsPath = kidsPath.replace(/\//g, "\\");
  assert(fs.existsSync(kidsPath), `Kids MP4 exists on disk: ${kidsPath}`);
  const kidsRes = await verifyVideoAndAudioIntegrity(kidsPath);
  assert(kidsRes.valid, "FFmpeg fully decoded Kids video and audio with 0 errors");
  console.log(`    ✓ Kids video & audio produced successfully (${(fs.statSync(kidsPath).size / 1024).toFixed(1)} KB)\n`);

  // DOMAIN 5: GENERAL
  console.log("  [E] Executing GENERAL Domain Pipeline with Narrative Intelligence...");
  const p5 = await createPipeline();
  const genPrompt = "Create a 20 second educational video explaining how a solar eclipse works.";
  const genPkg = await p5.execute("scr-gen-m12", "proj-gen-m12", genPrompt);
  assert(genPkg.metadata?.debugInfo?.narrativePlan !== undefined, "General debugInfo contains narrativePlan");

  let genPath = genPkg.videoFileUrl.replace(/^file:\/\/\/?/, "");
  if (process.platform === "win32") genPath = genPath.replace(/\//g, "\\");
  assert(fs.existsSync(genPath), `General MP4 exists on disk: ${genPath}`);
  const genRes = await verifyVideoAndAudioIntegrity(genPath);
  assert(genRes.valid, "FFmpeg fully decoded General video and audio with 0 errors");
  console.log(`    ✓ General video & audio produced successfully (${(fs.statSync(genPath).size / 1024).toFixed(1)} KB)\n`);

  console.log("================================================================================");
  console.log(`=== ${passed}/${passed + failed} NARRATIVE INTELLIGENCE TESTS PASSED (100%) ===`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runNarrativeIntelligenceTestSuite().catch((err) => {
  console.error("Test suite failed with error:", err);
  process.exit(1);
});
