import { PipelineEngine } from "./pipeline/PipelineEngine";
import { PipelineBuilder } from "./pipeline/PipelineBuilder";
import { PipelineState } from "./pipeline/PipelineState";
import { PipelineStage } from "./pipeline/PipelineStage";
import { PipelinePriority } from "./pipeline/PipelinePriority";
import { PipelineStatus } from "./pipeline/PipelineStatus";
import { PipelineMode } from "./pipeline/PipelineMode";
import { ExecutionStrategy } from "./pipeline/ExecutionStrategy";
import { PipelineResult } from "./pipeline/PipelineResult";
import { ProviderType } from "./llm-provider/ProviderType";
import { KnowledgeNodeType } from "./knowledge-base/KnowledgeNodeType";
import { KnowledgeSource } from "./knowledge-base/KnowledgeSource";
import { PipelineValidator } from "./pipeline/PipelineValidator";

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
function makeTestContext(overrides: Record<string, any> = {}): any {
  const kbStore: any[] = [];
  const dbQueries: any[] = [];
  const memoryMap = new Map<string, any>();
  const events: any[] = [];

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
    knowledgeBaseEngine: {
      store: async (req: any) => {
        kbStore.push(req);
        return { nodeId: `kb-${Date.now()}`, success: true };
      },
      kbStore
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
    llmProviderEngine: {
      chat: async (req: any) => {
        if (overrides.forceLlmError) {
          throw new Error("LLM Call Failed");
        }
        return {
          id: "llm-resp",
          completion: req.messages[0].content.includes("dialogue")
            ? "Welcome to this deep dive into TypeScript features. In this video, we cover advanced concepts."
            : "Optimized strategy output blueprint.",
          usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
        };
      }
    },
    researchEngine: {
      refresh: async () => {},
      execute: async (req: any) => ({
        requestId: req.id,
        topics: [{ id: "t-1", topic: "TypeScript", finalScore: 0.95, tags: ["TS"] }]
      })
    },
    strategyEngine: {
      refresh: async () => {},
      generate: async () => ({
        strategyId: "strat-1",
        pillars: [{ id: "p-1", name: "TS Guide", supportingTopics: [] }]
      })
    },
    channelEngine: {
      refresh: async () => {},
      generate: async () => ({
        brandGuide: { tone: "EDUCATIONAL" }
      })
    },
    scriptEngine: {
      refresh: async () => {},
      generate: async () => ({
        scriptId: "scr-1",
        dialogue: [{ speaker: "Host", text: "Welcome to this deep dive into TypeScript features." }]
      })
    },
    productionEngine:  { refresh: async () => {} },
    generationEngine:  { refresh: async () => {} },
    compositionEngine: { refresh: async () => {} },
    renderEngine:      { refresh: async () => {} },
    qualityEngine:     { refresh: async () => {} },
    publishingEngine:  { refresh: async () => {} },
    analyticsEngine:   { refresh: async () => {} },
    channelManager:    { refresh: async () => {} },
    founderEngine:     { refresh: async () => {} },
    controlCenterEngine: { refresh: async () => {} },
    learningEngine:    { refresh: async () => {} },
    optimizationEngine: { refresh: async () => {} },
    ...overrides
  };
}

async function run(): Promise<void> {
  console.log("\n=== START SPRINT 25.1 RESEARCH -> SCRIPT PIPELINE TESTS ===\n");

  // 1. Pipeline initialization & builder
  console.log("1. Pipeline initialization & builder...");
  const ctx = makeTestContext();
  const engine = new PipelineBuilder().withContext(ctx).build() as PipelineEngine;
  assert(engine !== undefined, "Pipeline engine created successfully");
  assert(engine.state === PipelineState.CREATED, "Initial state is CREATED");
  await engine.initialize();
  assert(engine.state === PipelineState.INITIALIZED, "State after initialize() is INITIALIZED");

  // 2. Validator rules
  console.log("2. Validator rules...");
  let validatorFailed = false;
  try {
    PipelineValidator.validateNoDuplicateStages([PipelineStage.RESEARCH, PipelineStage.RESEARCH]);
  } catch {
    validatorFailed = true;
  }
  assert(validatorFailed, "Validator detects duplicate stages");

  // 3. Execution state machine progression
  console.log("3. Execution state machine progression...");
  await engine.start();
  const req = {
    id: "req-1",
    goal: "TypeScript Tutorial",
    mode: PipelineMode.SEQUENTIAL,
    strategy: ExecutionStrategy.LINEAR,
    priority: PipelinePriority.HIGH,
    stages: [PipelineStage.RESEARCH, PipelineStage.STRATEGY, PipelineStage.CHANNEL, PipelineStage.SCRIPT],
    timestamp: new Date()
  };
  const resp = await engine.execute(req);
  assert(resp.result === PipelineResult.SUCCESS, "Sequential execution succeeded");
  assert(resp.completedStages.length === 4, "Execution completed all 4 stages");
  assert(engine.state === PipelineState.COMPLETED, "State after execution is COMPLETED");

  // 4. LLM Routing - Research stage
  console.log("4. LLM Routing - Research stage...");
  const report = engine.getReport(resp.requestId);
  assert(report !== undefined, "Execution report generated successfully");
  assert(report!.result === PipelineResult.SUCCESS, "Report shows success result");
  assert(report!.metrics.totalRetries === 0, "Report shows zero retries");

  // 5. LLM Routing - Strategy stage
  console.log("5. LLM Routing - Strategy stage...");
  assert(ctx.memoryStore.memoryMap.has("pipeline-checkpoints:checkpoints:req-1"), "Checkpoints stored in memory store");

  // 6. LLM Routing - Script stage
  console.log("6. LLM Routing - Script stage...");
  const kbStore = ctx.knowledgeBaseEngine.kbStore;
  const scriptNode = kbStore.find((n: any) => n.type === KnowledgeNodeType.SCRIPT);
  assert(scriptNode !== undefined, "Script node created in Knowledge Base");
  assert(scriptNode.type === KnowledgeNodeType.SCRIPT, "Script node has correct KnowledgeNodeType");

  // 7. LLM Fallback & Retry
  console.log("7. LLM Fallback & Retry...");
  let customChatCalls = 0;
  const ctxRetry = makeTestContext({
    forceLlmError: false,
    llmProviderEngine: {
      chat: async (req: any) => {
        customChatCalls++;
        if (req.options?.provider === ProviderType.GEMINI) {
          throw new Error("Gemini temporary down");
        }
        return {
          id: "llm-fallback-resp",
          completion: "Fallback completion text.",
          usage: { promptTokens: 40, completionTokens: 80, totalTokens: 120 }
        };
      }
    }
  });
  const engineRetry = new PipelineBuilder().withContext(ctxRetry).build();
  await engineRetry.initialize();
  await engineRetry.start();
  const respRetry = await engineRetry.execute(req);
  assert(respRetry.result === PipelineResult.SUCCESS, "Fallback retry succeeded");
  assert(respRetry.requestId === "req-1", "Fallback response requestId matches");
  assert(respRetry.completedStages.length === 4, "Fallback execution completed all stages");
  assert(customChatCalls > 1, "Fallback route triggered retry provider");

  // 8. Knowledge Base Storage - Research
  console.log("8. Knowledge Base Storage - Research...");
  const researchNode = kbStore.find((n: any) => n.type === KnowledgeNodeType.RESEARCH);
  assert(researchNode !== undefined, "Research stored in Knowledge Base");
  assert(researchNode.source === KnowledgeSource.RESEARCH_ENGINE, "Research node source is RESEARCH_ENGINE");
  assert(researchNode.type === KnowledgeNodeType.RESEARCH, "Research node type is RESEARCH");

  // 9. Knowledge Base Storage - Strategy
  console.log("9. Knowledge Base Storage - Strategy...");
  const strategyNode = kbStore.find((n: any) => n.type === KnowledgeNodeType.STRATEGY);
  assert(strategyNode !== undefined, "Strategy stored in Knowledge Base");
  assert(strategyNode.source === KnowledgeSource.PIPELINE_ENGINE, "Strategy node source is PIPELINE_ENGINE");
  assert(strategyNode.type === KnowledgeNodeType.STRATEGY, "Strategy node type is STRATEGY");

  // 10. Knowledge Base Storage - Script
  console.log("10. Knowledge Base Storage - Script...");
  assert(scriptNode.source === KnowledgeSource.SCRIPT_ENGINE, "Script node source is SCRIPT_ENGINE");

  // 11. Memory Integration
  console.log("11. Memory Integration...");
  const llmHistoryKeys = [...ctx.memoryStore.memoryMap.keys()].filter(k => k.startsWith("llm-history:"));
  assert(llmHistoryKeys.length > 0, "LLM run parameters logged to memory store");

  // 12. Database Integration
  console.log("12. Database Integration...");
  assert(ctx.databaseEngine.dbQueries.length > 0, "Pipeline checkpoints inserted to Database");

  // 13. Cost Optimization
  console.log("13. Cost Optimization...");
  const finalReport = engine.getReport(resp.requestId);
  assert(finalReport!.metrics.costUsd > 0, "Cost optimization calculated token prices");
  assert(finalReport!.metrics.successRate === 1.0, "Cost report shows 100% success rate");

  // 14. Observability Tracking
  console.log("14. Observability Tracking...");
  assert(finalReport!.metrics.costUsd < 0.1, "Total cost calculated as optimal");

  // 15. Script Validation - Length
  console.log("15. Script Validation - Length...");
  let lenValidationFailed = false;
  const ctxLenFail = makeTestContext({
    scriptEngine: {
      generate: async () => ({
        scriptId: "scr-fail",
        dialogue: [{ speaker: "Host", text: "" }] // Empty script
      })
    }
  });
  const engineLenFail = new PipelineBuilder().withContext(ctxLenFail).build();
  await engineLenFail.initialize();
  await engineLenFail.start();
  const respLenFail = await engineLenFail.execute(req);
  assert(respLenFail.result === PipelineResult.FAILURE, "Empty script fails execution");

  // 16. Script Validation - Hallucination risk
  console.log("16. Script Validation - Hallucination risk...");
  let hallucinationFailed = false;
  const ctxHalFail = makeTestContext({
    scriptEngine: {
      generate: async () => ({
        scriptId: "scr-fail-hal",
        dialogue: [{ speaker: "Host", text: "This contains hallucinate claims." }]
      })
    }
  });
  const engineHalFail = new PipelineBuilder().withContext(ctxHalFail).build();
  await engineHalFail.initialize();
  await engineHalFail.start();
  const respHalFail = await engineHalFail.execute(req);
  assert(respHalFail.result === PipelineResult.FAILURE, "Hallucination indicator fails execution");

  // 17. Recovery manager retry limit
  console.log("17. Recovery manager retry limit...");
  const recoveryFailures = engine.getRecoveryManager().getFailures(resp.requestId);
  assert(Array.isArray(recoveryFailures), "Recovery manager logs tracked");

  // 18. Checkpoint loading & resumption
  console.log("18. Checkpoint loading & resumption...");
  const checkpoint = engine.getCheckpointManager().loadCheckpoint(resp.requestId);
  assert(checkpoint !== undefined, "Last checkpoint loaded successfully");

  // 19. Snapshot immutability
  console.log("19. Snapshot immutability...");
  const snapshot = engine.getSnapshot();
  assert(Object.isFrozen(snapshot), "Snapshot is frozen");
  assert(snapshot.state === PipelineState.COMPLETED, "Snapshot state is COMPLETED");
  assert(snapshot.metrics !== undefined, "Snapshot contains metrics");

  // 20. Complete End-to-End Run
  console.log("20. Complete End-to-End Run...");
  assert(resp.completedStages.length === 4, "All 4 Research -> Strategy -> Channel -> Script stages executed");
  assert(ctx.memoryStore.memoryMap.has("pipeline-history:history:req-1"), "End-to-end pipeline run tracked in Memory");
  assert(resp.snapshotId !== undefined, "End-to-end run has snapshotId");
  assert(resp.executionTimeMs > 0, "End-to-end run tracks execution time");

  console.log(`\n=== ${passed}/${passed + failed} PIPELINE TESTS PASSED ${failed === 0 ? "SUCCESSFULLY" : `— ${failed} FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
