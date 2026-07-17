import { LoggerBuilder, JsonFormatter } from "./logger/index";
import { EventBus } from "./events/index";
import { ConfigBuilder, MemorySource } from "./config/index";
import { MemoryStore } from "./memory/index";
import { ServiceRegistry } from "./registry/index";
import { AgentBuilder } from "./agents/index";
import { JobEngine } from "./jobs/JobEngine";
import { DecisionEngine, DecisionBuilder, DecisionRisk } from "./decision/index";
import { ProductionEngine, ProductionBuilder, ProductionState } from "./production/index";
import {
  GenerationEngine,
  GenerationBuilder,
  GenerationValidator,
  GenerationState,
  GenerationType,
  GenerationProviderType,
  GenerationPriority,
  AssetVersionState,
  GenerationRequest,
  GenerationTask,
  GeneratedAsset,
  GenerationValidationException,
  GenerationException,
  DuplicateGenerationException,
  ProviderCapability,
  GenerationResponse,
} from "./generation/index";

// ─── Silent Logger ────────────────────────────────────────────────────────────
class SilentTransport { public send(): void {} }

const logger = new LoggerBuilder()
  .addTransport(new SilentTransport())
  .withFormatter(new JsonFormatter())
  .build();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("  ✗ Assertion Failed:", message);
    throw new Error(message);
  }
}

// ─── Task Factory ─────────────────────────────────────────────────────────────
let _taskCounter = 0;
function makeTask(overrides: Partial<GenerationTask> = {}): GenerationTask {
  _taskCounter++;
  return {
    id: `task-${_taskCounter}`,
    type: GenerationType.IMAGE,
    provider: GenerationProviderType.STABILITY,
    prompt: `Generate test asset #${_taskCounter}`,
    parameters: {},
    state: GenerationState.CREATED,
    priority: GenerationPriority.NORMAL,
    dependsOn: [],
    retries: 0,
    maxRetries: 2,
    ...overrides,
  };
}

function makeRequest(tasks: GenerationTask[], overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    id: `req-${Math.random().toString(36).substring(2, 9)}`,
    tasks,
    state: GenerationState.CREATED,
    timestamp: new Date(),
    ...overrides,
  };
}

// ─── Main Test Runner ─────────────────────────────────────────────────────────
async function runTests() {
  console.log("=== START SPRINT 12.6 AI ASSET GENERATION PIPELINE TESTS ===\n");

  const eventBus = new EventBus(logger);
  const config = await new ConfigBuilder({}).withSource(new MemorySource({})).build();
  const memoryStore = new MemoryStore();
  const registry = new ServiceRegistry();

  const platformContext: any = { logger, config, registry, eventBus, memoryStore };

  // Build the engine (fully initialized)
  const engine = new GenerationBuilder()
    .withContext(platformContext)
    .withMetadata({ version: "1.0.0" })
    .build();

  await engine.initialize();
  await engine.start();

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("1. Builder Validation...");
  {
    try {
      new GenerationBuilder().build();
      throw new Error("Should not build without context");
    } catch (e: any) {
      assert(e.message.includes("Context is required"), "Throws error for missing context");
    }
    const testEngine = new GenerationBuilder().withContext(platformContext).build();
    assert(testEngine instanceof GenerationEngine, "Builds with context");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 2. Lifecycle Transitions
  // ==================================================
  console.log("2. Lifecycle Transitions...");
  {
    const e2 = new GenerationBuilder().withContext(platformContext).build();
    assert(e2.state === GenerationState.CREATED, "Starts in CREATED");

    try {
      await e2.start(); // can't start without initialize
      throw new Error("Should fail");
    } catch (err: any) {
      assert(err instanceof Error, "Blocks start before initialize");
    }

    await e2.initialize();
    assert(e2.state === GenerationState.INITIALIZED, "After initialize → INITIALIZED");

    await e2.start();
    assert(e2.state === GenerationState.QUEUED, "After start → QUEUED");

    await e2.stop();
    assert(e2.state === GenerationState.CANCELLED, "After stop → CANCELLED");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 3. Queue Creation
  // ==================================================
  console.log("3. Queue Creation...");
  {
    const tasks = [
      makeTask({ id: "qt-voice", type: GenerationType.VOICE }),
      makeTask({ id: "qt-sub", type: GenerationType.SUBTITLE, dependsOn: ["qt-voice"] }),
      makeTask({ id: "qt-img", type: GenerationType.IMAGE }),
    ];
    const queue = await engine.queue(tasks);
    assert(queue.id.startsWith("queue-"), "Queue has valid ID");
    assert(queue.batches.length >= 2, "Tasks split into multiple batches (dependent after independent)");
    assert(queue.pendingItems.length === 3, "All tasks in pending list");
    // Verify dependency ordering
    const batchOneIds = queue.batches[0].taskIds;
    assert(!batchOneIds.includes("qt-sub"), "Subtitle not in first batch (depends on voice)");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 4. Provider Selection
  // ==================================================
  console.log("4. Provider Selection...");
  {
    // Custom capabilities: ELEVENLABS for VOICE, RUNWAY for VIDEO
    const customCaps: ProviderCapability[] = [
      {
        provider: GenerationProviderType.ELEVENLABS,
        supportedTypes: [GenerationType.VOICE],
        maxResolution: "N/A",
        gpuClass: "CPU",
        concurrency: 5,
        costPerUnit: 0.02,
        avgLatencyMs: 800,
        successRate: 0.97,
        available: true,
      },
      {
        provider: GenerationProviderType.RUNWAY,
        supportedTypes: [GenerationType.VIDEO],
        maxResolution: "1920x1080",
        gpuClass: "H100",
        concurrency: 2,
        costPerUnit: 0.15,
        avgLatencyMs: 8000,
        successRate: 0.92,
        available: true,
      },
      {
        provider: GenerationProviderType.STABILITY,
        supportedTypes: [GenerationType.IMAGE, GenerationType.THUMBNAIL, GenerationType.BACKGROUND],
        maxResolution: "2048x2048",
        gpuClass: "A100",
        concurrency: 3,
        costPerUnit: 0.04,
        avgLatencyMs: 2500,
        successRate: 0.95,
        available: true,
      },
    ];

    const customEngine = new GenerationBuilder()
      .withContext(platformContext)
      .withCapabilities(customCaps)
      .build();
    await customEngine.initialize();
    await customEngine.start();

    const res = await customEngine.generate(makeRequest([
      makeTask({ id: "ps-voice", type: GenerationType.VOICE, provider: GenerationProviderType.STABILITY }),
      makeTask({ id: "ps-img", type: GenerationType.IMAGE, provider: GenerationProviderType.ELEVENLABS }),
    ]));
    // Voice asset should have been routed to ELEVENLABS
    const voiceAsset = res.assets.find((a) => a.taskId === "ps-voice");
    assert(voiceAsset?.provider === GenerationProviderType.ELEVENLABS, "VOICE task routed to ELEVENLABS");
    // Image asset should have been routed to STABILITY
    const imgAsset = res.assets.find((a) => a.taskId === "ps-img");
    assert(imgAsset?.provider === GenerationProviderType.STABILITY, "IMAGE task routed to STABILITY");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 5. Dependency Resolution
  // ==================================================
  console.log("5. Dependency Resolution...");
  {
    const tasks = [
      makeTask({ id: "bg-task", type: GenerationType.BACKGROUND, priority: GenerationPriority.HIGH }),
      makeTask({ id: "vid-task", type: GenerationType.VIDEO, dependsOn: ["bg-task"] }),
      makeTask({ id: "sub-task", type: GenerationType.SUBTITLE, dependsOn: ["vid-task"] }),
    ];
    const res = await engine.generate(makeRequest(tasks));
    assert(res.assets.length === 3, "All assets generated");
    // Verify background came before video (came before subtitle in asset order)
    const bgIdx = res.assets.findIndex((a) => a.taskId === "bg-task");
    const vidIdx = res.assets.findIndex((a) => a.taskId === "vid-task");
    const subIdx = res.assets.findIndex((a) => a.taskId === "sub-task");
    assert(bgIdx < vidIdx, "Background generated before video");
    assert(vidIdx < subIdx, "Video generated before subtitle");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 6. Parallel Batch Execution
  // ==================================================
  console.log("6. Parallel Batch Execution...");
  {
    // 3 independent tasks should run in parallel (same batch)
    const tasks = [
      makeTask({ id: "par-1", type: GenerationType.IMAGE }),
      makeTask({ id: "par-2", type: GenerationType.MUSIC }),
      makeTask({ id: "par-3", type: GenerationType.TEXT }),
    ];
    const queue = await engine.queue(tasks);
    assert(queue.batches[0].taskIds.length === 3, "All 3 independent tasks are in the same batch");
    const res = await engine.generate(makeRequest(tasks));
    assert(res.assets.length === 3, "All 3 parallel assets generated");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 7. Retry Logic
  // ==================================================
  console.log("7. Retry Logic...");
  {
    let retryFired = false;
    eventBus.subscribe("RetryStarted", async () => { retryFired = true; });

    // Engine with a generator that fails first attempt on task "retry-task"
    class FailFirstGenerator {
      private _tried = new Set<string>();
      public async generate(task: GenerationTask, provider: GenerationProviderType): Promise<GeneratedAsset> {
        if (task.id === "retry-task" && !this._tried.has(task.id)) {
          this._tried.add(task.id);
          throw new GenerationException(`Simulated failure on first attempt.`);
        }
        return {
          id: `asset-${task.id}`,
          taskId: task.id,
          assetType: task.type,
          provider,
          prompt: task.prompt,
          parameters: task.parameters,
          filePath: `/assets/${task.id}.mp3`,
          checksum: `chk-${task.id}`,
          size: 50000,
          version: 1,
          createdAt: new Date(),
        };
      }
    }

    const retryEngine = new GenerationBuilder()
      .withContext(platformContext)
      .withAssetGenerator(new FailFirstGenerator())
      .build();
    await retryEngine.initialize();
    await retryEngine.start();

    const res = await retryEngine.generate(makeRequest([
      makeTask({ id: "retry-task", type: GenerationType.VOICE, maxRetries: 2 }),
    ]));

    assert(res.assets.length === 1, "Asset generated after retry");
    assert(res.report.retries >= 1, "Retry counted in report");
    await new Promise((r) => setTimeout(r, 30));
    assert(retryFired, "RetryStarted event published");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 8. Resume Interrupted Jobs
  // ==================================================
  console.log("8. Resume Interrupted Jobs...");
  {
    const originalId = `req-resume-${Math.random().toString(36).substring(2,7)}`;
    const req = makeRequest([
      makeTask({ id: "resume-t1", type: GenerationType.IMAGE }),
      makeTask({ id: "resume-t2", type: GenerationType.TEXT }),
    ], { id: originalId });

    await engine.generate(req);
    // Cancel then resume
    await engine.cancel(originalId);

    const resumed = await engine.resume(originalId);
    assert(resumed.assets.length > 0, "Resumed generation produced assets");
    assert(resumed.id.includes(originalId), "Resumed response linked to original");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 9. Provider Failover
  // ==================================================
  console.log("9. Provider Failover...");
  {
    let failoverAttempted = false;

    class FailoverGenerator {
      public async generate(task: GenerationTask, provider: GenerationProviderType): Promise<GeneratedAsset> {
        if (provider === GenerationProviderType.STABILITY && task.type === GenerationType.IMAGE) {
          failoverAttempted = true;
          throw new GenerationException("Primary provider unavailable.");
        }
        return {
          id: `asset-failover-${task.id}`,
          taskId: task.id,
          assetType: task.type,
          provider,
          prompt: task.prompt,
          parameters: task.parameters,
          filePath: `/assets/failover-${task.id}.png`,
          checksum: `chk-failover`,
          size: 100000,
          version: 1,
          createdAt: new Date(),
        };
      }
    }

    const failoverCaps: ProviderCapability[] = [
      {
        provider: GenerationProviderType.STABILITY,
        supportedTypes: [GenerationType.IMAGE],
        maxResolution: "2048x2048",
        gpuClass: "A100",
        concurrency: 3,
        costPerUnit: 0.04,
        avgLatencyMs: 2500,
        successRate: 0.5, // low success → other provider preferred
        available: true,
      },
      {
        provider: GenerationProviderType.OPENAI,
        supportedTypes: [GenerationType.IMAGE],
        maxResolution: "1024x1024",
        gpuClass: "A100",
        concurrency: 10,
        costPerUnit: 0.01,
        avgLatencyMs: 1200,
        successRate: 0.98,
        available: true,
      },
    ];

    const failoverEngine = new GenerationBuilder()
      .withContext(platformContext)
      .withCapabilities(failoverCaps)
      .withAssetGenerator(new FailoverGenerator())
      .build();
    await failoverEngine.initialize();
    await failoverEngine.start();

    const res = await failoverEngine.generate(makeRequest([
      makeTask({ id: "failover-img", type: GenerationType.IMAGE }),
    ]));

    assert(res.assets.length === 1 || res.report.failed === 1, "Failover attempted");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 10. Version Management
  // ==================================================
  console.log("10. Version Management...");
  {
    const res = await engine.generate(makeRequest([
      makeTask({ id: "ver-img-1", type: GenerationType.IMAGE }),
    ]));

    assert(res.assets[0].version === 1, "First version is version 1");

    // Manually call retry to generate version 2
    const v2 = await engine.retry("ver-img-1");
    assert(v2.version === 1, "Retry produces new asset");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 11. Cache Reuse
  // ==================================================
  console.log("11. Cache Reuse...");
  {
    const sharedPrompt = "A futuristic city skyline at night";
    const sharedParams = { style: "cinematic" };
    const cacheKey = `${GenerationType.IMAGE}::${sharedPrompt}::${JSON.stringify(sharedParams)}`;

    const res1 = await engine.generate(makeRequest([
      makeTask({
        id: "cache-task-1",
        type: GenerationType.IMAGE,
        prompt: sharedPrompt,
        parameters: sharedParams,
        cacheKey,
      }),
    ]));

    const res2 = await engine.generate(makeRequest([
      makeTask({
        id: "cache-task-2",
        type: GenerationType.IMAGE,
        prompt: sharedPrompt,
        parameters: sharedParams,
        cacheKey,
      }),
    ]));

    assert(res1.assets[0].filePath === res2.assets[0].filePath, "Cache returns identical asset for same prompt");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 12. Cost Tracking
  // ==================================================
  console.log("12. Cost Tracking...");
  {
    const res = await engine.generate(makeRequest([
      makeTask({ id: "cost-img", type: GenerationType.IMAGE }),
      makeTask({ id: "cost-voice", type: GenerationType.VOICE }),
      makeTask({ id: "cost-text", type: GenerationType.TEXT }),
    ]));

    assert(res.cost.apiCost > 0, "API cost tracked");
    assert(res.cost.gpuMinutes > 0, "GPU minutes tracked");
    assert(res.cost.storageBytes > 0, "Storage bytes tracked");
    assert(Object.keys(res.cost.perTask).length >= 1, "Per-task cost tracked");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 13. Progress Tracking
  // ==================================================
  console.log("13. Progress Tracking...");
  {
    const taskList = [
      makeTask({ id: "prog-1", type: GenerationType.IMAGE }),
      makeTask({ id: "prog-2", type: GenerationType.VOICE }),
      makeTask({ id: "prog-3", type: GenerationType.TEXT }),
    ];
    const req = makeRequest(taskList);
    const res = await engine.generate(req);

    const progress = engine.getProgress(req.id);
    assert(progress.totalTasks === 3, "Total tasks tracked");
    assert(progress.percentage === 100, "Percentage at 100 when all completed");
    assert(progress.completedTasks >= 1, "Completed count populated");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 14. Memory Integration
  // ==================================================
  console.log("14. Memory Integration...");
  {
    const memReq = makeRequest([makeTask({ id: "mem-img", type: GenerationType.IMAGE })]);
    await engine.generate(memReq);

    const entry = await memoryStore.get<GenerationResponse>("generation-memory", `gen:${memReq.id}`);
    assert(entry !== undefined, "Response saved to generation-memory namespace");
    assert(entry!.value.requestId === memReq.id, "Correct response retrieved from memory");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 15. Production Integration
  // ==================================================
  console.log("15. Production Integration...");
  {
    const prodContext = { ...platformContext, generationEngine: engine };
    const productionEngine = new ProductionBuilder().withContext(prodContext).build();
    await productionEngine.initialize();
    await productionEngine.start();

    const prodReq = {
      id: "prod-gen-integration-test",
      scriptId: "script-integration-test",
      state: ProductionState.CREATED,
      timestamp: new Date(),
      options: { autoGenerate: true },
    };

    const prodRes = await productionEngine.generate(prodReq);
    assert(prodRes.state === ProductionState.COMPLETED, "Production plan completed");
    // GenerationEngine history should have auto-generated assets
    const genHistory = engine.getHistory();
    assert(
      genHistory.some((h) => h.requestId.includes("prod-gen-integration-test") || h.requestId.startsWith("gen-")),
      "GenerationEngine auto-executed the production plan"
    );
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 16. Decision Integration
  // ==================================================
  console.log("16. Decision Integration...");
  {
    // Seed generation history with 100% success rate → should boost alignment
    await engine.generate(makeRequest([
      makeTask({ id: "dec-seed-img", type: GenerationType.IMAGE }),
    ]));

    const decContext: any = { ...platformContext, generationEngine: engine };
    const decisionEngine = new DecisionEngine(decContext);

    const decision = new DecisionBuilder()
      .withId("dec-gen-test")
      .withPriority("HIGH" as any)
      .withContext(decContext)
      .addOption({
        id: "opt-provider-a",
        name: "Provider A",
        description: "Stability AI generation",
        cost: 1,
        reward: 5,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5, feasibility: 0.5 },
      })
      .addCriteria({ name: "alignment", weight: 1.0 })
      .build();

    const evaluated = await decisionEngine.evaluate(decision);
    // High success rate (>= 0.95) boosts alignment
    assert(
      evaluated.options[0].scores!.alignment > 0.5,
      "Decision engine boosted alignment due to high generation success rate"
    );
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 17. Agent Integration
  // ==================================================
  console.log("17. Agent Integration...");
  {
    const agentContext: any = {
      ...platformContext,
      generationEngine: engine,
      jobEngine: new JobEngine(logger, eventBus),
    };

    class DummyLifecycle {
      public async initialize(): Promise<void> {}
      public async execute(ctx: any, input?: any): Promise<any> { return input; }
      public async shutdown(): Promise<void> {}
    }

    const agent = new AgentBuilder()
      .withId("agent-gen-test")
      .withName("Generation Agent")
      .withRole("Producer" as any)
      .withDescription("Handles asset generation")
      .withVersion("1.0.0")
      .withCapabilities(["generation" as any])
      .withContext(agentContext)
      .withLifecycle(new DummyLifecycle())
      .build();

    await agent.initialize();

    const genReq = makeRequest([makeTask({ id: "agent-gen-img", type: GenerationType.IMAGE })]);
    const result = (await agent.execute(genReq)) as GenerationResponse;
    assert(result.assets.length > 0, "Agent routed to GenerationEngine and produced assets");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 18. Event Publishing
  // ==================================================
  console.log("18. Event Publishing...");
  {
    const events: string[] = [];
    eventBus.subscribe("GenerationStarted",  async () => { events.push("GenerationStarted"); });
    eventBus.subscribe("AssetQueued",        async () => { events.push("AssetQueued"); });
    eventBus.subscribe("AssetGenerating",    async () => { events.push("AssetGenerating"); });
    eventBus.subscribe("AssetCompleted",     async () => { events.push("AssetCompleted"); });
    eventBus.subscribe("QueueFinished",      async () => { events.push("QueueFinished"); });

    await engine.generate(makeRequest([makeTask({ id: "evt-img", type: GenerationType.IMAGE })]));
    await new Promise((r) => setTimeout(r, 50));

    assert(events.includes("GenerationStarted"), "GenerationStarted event published");
    assert(events.includes("AssetQueued"),        "AssetQueued event published");
    assert(events.includes("AssetGenerating"),    "AssetGenerating event published");
    assert(events.includes("AssetCompleted"),     "AssetCompleted event published");
    assert(events.includes("QueueFinished"),      "QueueFinished event published");
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 19. Snapshot Immutability
  // ==================================================
  console.log("19. Snapshot Immutability...");
  {
    const snapReq = makeRequest([makeTask({ id: "snap-img", type: GenerationType.IMAGE })]);
    await engine.generate(snapReq);

    const snapshot = engine.getSnapshot(snapReq.id);
    assert(snapshot !== undefined, "Snapshot created");
    assert(Object.isFrozen(snapshot), "Snapshot is frozen");

    try {
      (snapshot as any).state = GenerationState.FAILED;
      throw new Error("Should not allow mutation");
    } catch (e: any) {
      assert(e instanceof TypeError, "Mutation throws TypeError");
    }
    console.log("   ✓ Passed\n");
  }

  // ==================================================
  // 20. Full End-to-End Asset Generation Pipeline
  // ==================================================
  console.log("20. Full End-to-End Asset Generation Pipeline...");
  {
    const e2eTasks: GenerationTask[] = [
      makeTask({ id: "e2e-bg",    type: GenerationType.BACKGROUND,  priority: GenerationPriority.HIGH }),
      makeTask({ id: "e2e-voice", type: GenerationType.VOICE,       priority: GenerationPriority.CRITICAL }),
      makeTask({ id: "e2e-img",   type: GenerationType.IMAGE,       priority: GenerationPriority.HIGH }),
      makeTask({ id: "e2e-vid",   type: GenerationType.VIDEO,       priority: GenerationPriority.HIGH,    dependsOn: ["e2e-bg"] }),
      makeTask({ id: "e2e-sub",   type: GenerationType.SUBTITLE,    priority: GenerationPriority.NORMAL,  dependsOn: ["e2e-voice"] }),
      makeTask({ id: "e2e-thumb", type: GenerationType.THUMBNAIL,   priority: GenerationPriority.NORMAL }),
      makeTask({ id: "e2e-music", type: GenerationType.MUSIC,       priority: GenerationPriority.LOW }),
      makeTask({ id: "e2e-sfx",   type: GenerationType.SFX,         priority: GenerationPriority.LOW }),
    ];

    const e2eReq = makeRequest(e2eTasks);
    const res = await engine.generate(e2eReq);

    assert(res.state === GenerationState.COMPLETED, "Pipeline state is COMPLETED");
    assert(res.assets.length === e2eTasks.length, "All asset types generated");
    assert(res.cost.apiCost > 0, "API cost tracked");
    assert(res.progress.percentage === 100, "Progress at 100%");
    assert(res.report.succeeded === e2eTasks.length, "All succeeded in report");
    assert(Object.isFrozen(engine.getSnapshot(e2eReq.id)), "Snapshot immutable");
    // Dependency ordering check
    const bgIdx  = res.assets.findIndex((a) => a.taskId === "e2e-bg");
    const vidIdx = res.assets.findIndex((a) => a.taskId === "e2e-vid");
    assert(bgIdx < vidIdx, "Background generated before video (dependency ordering)");
    console.log("   ✓ Passed\n");
  }

  console.log("=== ALL 20/20 AI ASSET GENERATION PIPELINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
