/**
 * Visual Intelligence & Multi-Domain Pipeline Comprehensive Regression Test
 * Validates prompt classification, visual style planning, scene visual enrichment,
 * and end-to-end rendering across four production domains:
 * 1. FINANCE
 * 2. HISTORY
 * 3. DOCUMENTARY
 * 4. KIDS
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { DomainClassifier } from "./visual-intelligence/DomainClassifier";
import { VisualStylePlanner } from "./visual-intelligence/VisualStylePlanner";
import { SceneVisualPlanner } from "./visual-intelligence/SceneVisualPlanner";
import { ContentPipelineEngine } from "./content-pipeline/ContentPipelineEngine";
import { ContentPipelineBuilder } from "./content-pipeline/ContentPipelineBuilder";
import { RenderEngine } from "./rendering/RenderEngine";

const ffmpegDir = "C:\\Users\\asus\\AppData\\Local\\DigitalWave\\DW Free Video Downloader";
if (fs.existsSync(ffmpegDir) && !process.env.PATH?.includes(ffmpegDir)) {
  process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function verifyVideoIntegrity(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("ffmpeg", ["-v", "error", "-i", filePath, "-f", "null", "-"], (error, _stdout, stderr) => {
      if (error) {
        console.error("FFmpeg decode validation error:", stderr);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
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

async function runVisualIntelligenceTests(): Promise<void> {
  console.log("================================================================================");
  console.log("=== STARTING VISUAL INTELLIGENCE & MULTI-DOMAIN PIPELINE VERIFICATION SUITE ===");
  console.log("================================================================================\n");

  // -------------------------------------------------------------------------
  // TEST 1: FINANCE WORKLOAD
  // -------------------------------------------------------------------------
  console.log("1. Testing FINANCE Domain Intelligence...");
  const financePrompt = "Create a 20 second video explaining inflation for beginners.";
  const financeClassification = await DomainClassifier.classify(financePrompt);
  assert(financeClassification.domain === "FINANCE", `Classified as FINANCE (got ${financeClassification.domain})`);
  assert(financeClassification.confidence >= 0.8, `High confidence score (got ${financeClassification.confidence})`);

  const financeStylePlan = VisualStylePlanner.plan(financeClassification, financePrompt);
  assert(financeStylePlan.domain === "FINANCE", "Style plan domain is FINANCE");
  assert(financeStylePlan.visualStyle === "EDITORIAL_INFOGRAPHIC", "Visual style is EDITORIAL_INFOGRAPHIC");
  assert(financeStylePlan.dataVisualizationStrategy.enabled === true, "Data visualizations enabled for finance");
  assert(financeStylePlan.dataVisualizationStrategy.preferredChartTypes.includes("LINE"), "Includes LINE charts");
  assert(financeStylePlan.overlayStrategy.enabled === true, "Overlays enabled for financial metrics");
  assert(financeStylePlan.cameraStyle.preferredMotion === "ZOOM_IN", "Camera motion is controlled ZOOM_IN");

  const financeScenePlan = SceneVisualPlanner.planScene(
    {
      id: "sc-fin-2",
      sceneNumber: 2,
      title: "Purchasing Power Decline",
      scriptText: "Inflation erodes the purchasing power of your money over time.",
      durationSeconds: 5
    },
    financeStylePlan
  );
  assert(financeScenePlan.layers.length >= 1, "Contains visual layers");
  assert(financeScenePlan.dataVisualizations.some(dv => dv.type === "CHART"), "Scene 2 contains a financial CHART");
  assert(financeScenePlan.dominantVisualType === "CHART", "Dominant visual type is CHART");
  console.log("  ✓ Finance domain intelligence verified successfully.\n");

  // -------------------------------------------------------------------------
  // TEST 2: HISTORY WORKLOAD
  // -------------------------------------------------------------------------
  console.log("2. Testing HISTORY Domain Intelligence...");
  const historyPrompt = "Create a 20 second video explaining how the Roman Empire expanded.";
  const historyClassification = await DomainClassifier.classify(historyPrompt);
  assert(historyClassification.domain === "HISTORY", `Classified as HISTORY (got ${historyClassification.domain})`);
  assert(historyClassification.confidence >= 0.8, `High confidence score (got ${historyClassification.confidence})`);

  const historyStylePlan = VisualStylePlanner.plan(historyClassification, historyPrompt);
  assert(historyStylePlan.domain === "HISTORY", "Style plan domain is HISTORY");
  assert(historyStylePlan.visualStyle === "ARCHIVAL_DOCUMENTARY", "Visual style is ARCHIVAL_DOCUMENTARY");
  assert(historyStylePlan.colorDirection.paletteName === "Imperial_Antiquity", "Uses antique parchment/gold palette");
  assert(historyStylePlan.typographyStyle.captionStyle === "CLASSIC_SERIF", "Uses classic serif typography");
  assert(historyStylePlan.cameraStyle.preferredMotion === "PAN_RIGHT", "Camera motion is cinematic PAN_RIGHT");

  const historyScenePlan = SceneVisualPlanner.planScene(
    {
      id: "sc-hist-2",
      sceneNumber: 2,
      title: "Mediterranean Expansion Routes",
      scriptText: "Roman legions expanded territorial boundaries across the Mediterranean.",
      durationSeconds: 5
    },
    historyStylePlan
  );
  assert(historyScenePlan.dataVisualizations.some(dv => dv.type === "MAP"), "Scene 2 contains a MAP visualization");
  assert(historyScenePlan.dominantVisualType === "MAP", "Dominant visual type is MAP");
  console.log("  ✓ History domain intelligence verified successfully.\n");

  // -------------------------------------------------------------------------
  // TEST 3: DOCUMENTARY WORKLOAD
  // -------------------------------------------------------------------------
  console.log("3. Testing DOCUMENTARY Domain Intelligence...");
  const docPrompt = "Create a 20 second documentary explaining why oceans are getting warmer.";
  const docClassification = await DomainClassifier.classify(docPrompt);
  assert(docClassification.domain === "DOCUMENTARY", `Classified as DOCUMENTARY (got ${docClassification.domain})`);
  assert(docClassification.confidence >= 0.8, `High confidence score (got ${docClassification.confidence})`);

  const docStylePlan = VisualStylePlanner.plan(docClassification, docPrompt);
  assert(docStylePlan.domain === "DOCUMENTARY", "Style plan domain is DOCUMENTARY");
  assert(docStylePlan.visualStyle === "CINEMATIC_EDITORIAL", "Visual style is CINEMATIC_EDITORIAL");
  assert(docStylePlan.colorDirection.paletteName === "Oceanic_Abyss", "Uses oceanic deep blue palette");
  assert(docStylePlan.cameraStyle.preferredMotion === "KEN_BURNS", "Camera motion uses KEN_BURNS");

  const docScenePlan = SceneVisualPlanner.planScene(
    {
      id: "sc-doc-2",
      sceneNumber: 2,
      title: "Thermal Anomaly Indicators",
      scriptText: "Satellite data confirms rising ocean temperature anomalies.",
      durationSeconds: 5
    },
    docStylePlan
  );
  assert(docScenePlan.overlays.length > 0, "Documentary scene contains scientific overlays");
  assert(docScenePlan.dataVisualizations.some(dv => dv.type === "INDICATOR"), "Scene contains INDICATOR data visualization");
  console.log("  ✓ Documentary domain intelligence verified successfully.\n");

  // -------------------------------------------------------------------------
  // TEST 4: KIDS WORKLOAD
  // -------------------------------------------------------------------------
  console.log("4. Testing KIDS Domain Intelligence...");
  const kidsPrompt = "Create a 20 second animated story where Leo the lion learns why the sun rises.";
  const kidsClassification = await DomainClassifier.classify(kidsPrompt);
  assert(kidsClassification.domain === "KIDS", `Classified as KIDS (got ${kidsClassification.domain})`);
  assert(kidsClassification.confidence >= 0.8, `High confidence score (got ${kidsClassification.confidence})`);

  const kidsStylePlan = VisualStylePlanner.plan(kidsClassification, kidsPrompt);
  assert(kidsStylePlan.domain === "KIDS", "Style plan domain is KIDS");
  assert(kidsStylePlan.visualStyle === "2D_CARTOON_ANIMATION", "Visual style is 2D_CARTOON_ANIMATION");
  assert(kidsStylePlan.characterStrategy?.enabled === true, "Character strategy is enabled");
  assert(kidsStylePlan.motionIntensity === "ENERGETIC", "Motion intensity is ENERGETIC");

  const kidsCharacter = { id: "char-leo", name: "Leo the Lion Cub", description: "Cute golden lion cub", assetUrl: "" };
  const kidsScenePlan = SceneVisualPlanner.planScene(
    {
      id: "sc-kids-2",
      sceneNumber: 2,
      title: "Leo Explores the Meadow",
      scriptText: "Leo trots along the sunny flower path.",
      durationSeconds: 5,
      animation: "WALK"
    },
    kidsStylePlan,
    [kidsCharacter]
  );
  assert(kidsScenePlan.layers.some(l => l.layerType === "CHARACTER"), "Contains CHARACTER layer");
  assert(kidsScenePlan.animationInstructions.some(a => a.action === "WALK"), "Contains WALK action instruction");
  assert(kidsScenePlan.dominantVisualType === "CHARACTER", "Dominant visual type is CHARACTER");
  console.log("  ✓ Kids domain intelligence verified successfully.\n");

  // -------------------------------------------------------------------------
  // TEST 5: CONTENT PIPELINE STORYBOARD INTEGRATION ACROSS ALL 4 DOMAINS
  // -------------------------------------------------------------------------
  console.log("5. Testing ContentPipelineEngine Storyboard Generation across all domains...");
  const ctx = makeMockContext();
  await ctx.renderEngine.initialize();
  await ctx.renderEngine.start();

  const pipelineEngine = new ContentPipelineBuilder().withContext(ctx).build() as ContentPipelineEngine;
  await pipelineEngine.initialize();
  await pipelineEngine.start();

  const financeSb = await pipelineEngine.getStoryboardManager().generateStoryboard("scr-fin", "proj-fin", financePrompt);
  assert(financeSb.domainClassification?.domain === "FINANCE", "Finance storyboard domain is FINANCE");
  assert(financeSb.visualStylePlan?.visualStyle === "EDITORIAL_INFOGRAPHIC", "Finance storyboard visualStylePlan is attached");
  assert(financeSb.scenes.length === 4, "Finance storyboard has 4 scenes");
  assert(financeSb.totalDurationSeconds === 20, "Finance storyboard total duration is 20s");
  assert(financeSb.scenes.every(s => s.visualPlan !== undefined), "All finance scenes have visualPlan attached");

  const historySb = await pipelineEngine.getStoryboardManager().generateStoryboard("scr-hist", "proj-hist", historyPrompt);
  assert(historySb.domainClassification?.domain === "HISTORY", "History storyboard domain is HISTORY");
  assert(historySb.scenes.length === 4, "History storyboard has 4 scenes");
  assert(historySb.totalDurationSeconds === 20, "History storyboard total duration is 20s");
  assert(historySb.scenes.every(s => s.visualPlan !== undefined), "All history scenes have visualPlan attached");

  const docSb = await pipelineEngine.getStoryboardManager().generateStoryboard("scr-doc", "proj-doc", docPrompt);
  assert(docSb.domainClassification?.domain === "DOCUMENTARY", "Documentary storyboard domain is DOCUMENTARY");
  assert(docSb.scenes.length === 4, "Documentary storyboard has 4 scenes");
  assert(docSb.totalDurationSeconds === 20, "Documentary storyboard total duration is 20s");
  assert(docSb.scenes.every(s => s.visualPlan !== undefined), "All documentary scenes have visualPlan attached");

  const kidsSb = await pipelineEngine.getStoryboardManager().generateStoryboard("scr-kids", "proj-kids", kidsPrompt);
  assert(kidsSb.domainClassification?.domain === "KIDS", "Kids storyboard domain is KIDS");
  assert(Boolean(kidsSb.characters && kidsSb.characters.length > 0), "Kids storyboard contains protagonist");
  assert(kidsSb.scenes.length === 4, "Kids storyboard has 4 scenes");
  assert(kidsSb.totalDurationSeconds === 20, "Kids storyboard total duration is 20s");
  assert(kidsSb.scenes.every(s => s.visualPlan !== undefined), "All kids scenes have visualPlan attached");
  console.log("  ✓ Content pipeline storyboard generation verified across all 4 domains.\n");

  // -------------------------------------------------------------------------
  // TEST 6: REAL END-TO-END RENDER VALIDATION & MP4 VERIFICATION
  // -------------------------------------------------------------------------
  console.log("6. Executing Real End-to-End Pipeline Execution with FFmpeg Video Render...");
  const execCtx = makeMockContext();
  await execCtx.renderEngine.initialize();
  await execCtx.renderEngine.start();

  const execEngine = new ContentPipelineBuilder().withContext(execCtx).build() as ContentPipelineEngine;
  await execEngine.initialize();
  await execEngine.start();

  const publishingPackage = await execEngine.execute("scr-real-e2e", "proj-real-e2e", financePrompt);
  assert(publishingPackage !== undefined, "Publishing package was generated");
  assert(publishingPackage.videoFileUrl !== undefined && publishingPackage.videoFileUrl.length > 0, `Video file URL exists: ${publishingPackage.videoFileUrl}`);

  const debugInfo = publishingPackage.metadata?.debugInfo;
  assert(debugInfo !== undefined, "Debug info metadata is attached to PublishingPackage");
  assert(debugInfo.detectedDomain === "FINANCE", `Debug info detectedDomain is FINANCE (got ${debugInfo.detectedDomain})`);
  assert(debugInfo.visualStyle === "EDITORIAL_INFOGRAPHIC", `Debug info visualStyle is EDITORIAL_INFOGRAPHIC (got ${debugInfo.visualStyle})`);
  assert(debugInfo.sceneCount === 4, "Debug info records 4 scenes");
  assert(Array.isArray(debugInfo.sceneVisualPlans), "Debug info contains sceneVisualPlans list");

  let localFilePath = publishingPackage.videoFileUrl.replace(/^file:\/\/\/?/, "");
  if (process.platform === "win32") {
    localFilePath = localFilePath.replace(/\//g, "\\");
  }

  assert(fs.existsSync(localFilePath), `Rendered MP4 file exists physically on disk: ${localFilePath}`);
  const stats = fs.statSync(localFilePath);
  assert(stats.size > 10000, `Rendered MP4 file has substantial binary size (>10KB): ${(stats.size / 1024).toFixed(1)} KB`);

  console.log("7. Validating Rendered MP4 Integrity with FFmpeg decoder...");
  const isValid = await verifyVideoIntegrity(localFilePath);
  assert(isValid, "FFmpeg fully decoded and verified video stream integrity without errors");

  console.log("\n================================================================================");
  console.log("=== ALL VISUAL INTELLIGENCE & MULTI-DOMAIN PIPELINE TESTS PASSED (100%) ===");
  console.log("================================================================================\n");
}

runVisualIntelligenceTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
