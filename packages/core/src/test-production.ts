import { LoggerBuilder, JsonFormatter } from "./logger/index";
import { EventBus } from "./events/index";
import { ConfigBuilder, MemorySource } from "./config/index";
import { MemoryStore } from "./memory/index";
import { ServiceRegistry } from "./registry/index";
import { AgentBuilder } from "./agents/index";
import { PlanningEngine } from "./planning/index";
import { DecisionEngine, DecisionBuilder, DecisionRisk } from "./decision/index";
import { JobEngine } from "./jobs/JobEngine";
import { ResearchEngine, ResearchState } from "./research/index";
import { StrategyEngine, StrategyState } from "./strategy/index";
import { ChannelEngine } from "./channel/index";
import { ScriptEngine, ScriptState, ScriptType } from "./script/index";
import {
  ProductionEngine,
  ProductionBuilder,
  ProductionValidator,
  ProductionState,
  AssetType,
  AssetStatus,
  ProductionPriority,
  ProductionRequest,
  ProductionResponse,
  ProductionSnapshot,
  ProductionValidationException,
  ProductionException,
} from "./production/index";

class SilentTransport {
  public send(): void {}
}

const logger = new LoggerBuilder()
  .addTransport(new SilentTransport())
  .withFormatter(new JsonFormatter())
  .build();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    throw new Error(message);
  }
}

async function runTests() {
  console.log("=== START SPRINT 12.5 PRODUCTION ENGINE TESTS ===");

  // Platform Setup
  const eventBus = new EventBus(logger);
  const schema = {};
  const config = await new ConfigBuilder(schema)
    .withSource(new MemorySource({}))
    .build();
  const memoryStore = new MemoryStore();
  const registry = new ServiceRegistry();

  const platformContext = {
    logger,
    config,
    registry,
    eventBus,
    memoryStore,
  };

  const engine = new ProductionBuilder()
    .withContext(platformContext)
    .withMetadata({ version: "1.0.0" })
    .build();

  // Register in registry
  registry.register({ name: "IProductionEngine" } as any, engine);

  const researchEngine = new ResearchEngine(platformContext);
  registry.register({ name: "IResearchEngine" } as any, researchEngine);

  const strategyEngine = new StrategyEngine(platformContext);
  registry.register({ name: "IStrategyEngine" } as any, strategyEngine);

  const channelEngine = new ChannelEngine(platformContext);
  registry.register({ name: "IChannelEngine" } as any, channelEngine);

  const scriptEngine = new ScriptEngine(platformContext);
  registry.register({ name: "IScriptEngine" } as any, scriptEngine);

  // Cross-reference context properties
  Object.assign(platformContext, {
    productionEngine: engine,
    researchEngine: researchEngine,
    strategyEngine: strategyEngine,
    channelEngine: channelEngine,
    scriptEngine: scriptEngine,
  });

  // Unique topic tracker to prevent duplicate detection triggers in testing
  let trackerId = 0;
  function getUniqueId(base = "ProdTest") {
    trackerId++;
    return `${base}-${trackerId}`;
  }

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("\n1. Verifying Builder Validation...");
  {
    try {
      new ProductionBuilder().build();
      throw new Error("Should not build without context");
    } catch (e: any) {
      assert(e.message.includes("Context is required"), "Throws correct error for missing context");
    }

    const testEngine = new ProductionBuilder().withContext(platformContext).build();
    assert(testEngine instanceof ProductionEngine, "Succeeds with context");
    console.log("   ✓ Builder validation verified.");
  }

  // ==================================================
  // 2. Lifecycle Transitions
  // ==================================================
  console.log("\n2. Verifying Lifecycle Transitions...");
  {
    assert(engine.state === ProductionState.CREATED, "Starts in CREATED state");

    try {
      await engine.start();
      throw new Error("Should fail starting before initialize");
    } catch (e: any) {
      assert(e instanceof Error, "Fails transition directly from CREATED to RUNNING");
    }

    await engine.initialize();
    assert(engine.state === ProductionState.INITIALIZED, "State becomes INITIALIZED");

    await engine.start();
    assert(engine.state === ProductionState.RUNNING, "State becomes RUNNING");

    await engine.stop();
    assert(engine.state === ProductionState.STOPPED, "State becomes STOPPED");

    await engine.start();
    assert(engine.state === ProductionState.RUNNING, "State restored to RUNNING");
    console.log("   ✓ Lifecycle transitions verified.");
  }

  // ==================================================
  // 3. Scene Breakdown
  // ==================================================
  console.log("\n3. Verifying Scene Breakdown...");
  {
    const req: ProductionRequest = {
      id: getUniqueId("req-scene-breakdown"),
      scriptId: getUniqueId("script-id"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.plan.scenes.length === 3, "Breaks down into scenes");
    assert(res.plan.scenes[0].name.includes("city"), "Maps correct scene names");
    assert(res.plan.scenes[0].requirements.length > 0, "Maps asset requirements per scene");
    console.log("   ✓ Scene breakdown verified.");
  }

  // ==================================================
  // 4. Asset Planning
  // ==================================================
  console.log("\n4. Verifying Asset Planning...");
  {
    const req: ProductionRequest = {
      id: getUniqueId("req-asset-plan"),
      scriptId: getUniqueId("script-id"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.plan.assets.length === 4, "Plans asset list correctly");
    assert(res.plan.assets[0].type === AssetType.VOICE, "First asset is Voice");
    assert(res.plan.assets[0].priority === ProductionPriority.CRITICAL, "Supports priorities");
    console.log("   ✓ Asset planning verified.");
  }

  // ==================================================
  // 5. Dependency Resolution
  // ==================================================
  console.log("\n5. Verifying Dependency Resolution...");
  {
    const req: ProductionRequest = {
      id: getUniqueId("req-dep-res"),
      scriptId: getUniqueId("script-id"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    const deps = res.plan.assets.reduce((acc: any[], a) => [...acc, ...a.dependencies], []);
    assert(deps.length > 0, "Dependency mapping populated");
    assert(deps.some((d) => d.assetId === "voice-1"), "Subtitles depend on voice narration");
    console.log("   ✓ Dependency resolution verified.");
  }

  // ==================================================
  // 6. Timeline Generation
  // ==================================================
  console.log("\n6. Verifying Timeline Generation...");
  {
    const req: ProductionRequest = {
      id: getUniqueId("req-timeline"),
      scriptId: getUniqueId("script-id"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.timeline.scenes["scene-1"].start === 0, "Scene starts at 0s");
    assert(res.timeline.scenes["scene-1"].end === 5, "Scene 1 duration matches");
    assert(res.timeline.layers.visual.includes("vid-1"), "Layers map visuals correctly");
    console.log("   ✓ Timeline generation verified.");
  }

  // ==================================================
  // 7. Generation Queue Creation
  // ==================================================
  console.log("\n7. Verifying Generation Queue Creation...");
  {
    const req: ProductionRequest = {
      id: getUniqueId("req-queue"),
      scriptId: getUniqueId("script-id"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.queue.items.length === 4, "Queue sequences all assets");
    assert(res.queue.items[0] === "voice-1", "Queue processes voice narration before subtitles");
    console.log("   ✓ Generation queue creation verified.");
  }

  // ==================================================
  // 8. Batch Planning
  // ==================================================
  console.log("\n8. Verifying Batch Planning...");
  {
    const req: ProductionRequest = {
      id: getUniqueId("req-batch"),
      scriptId: getUniqueId("script-id"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.plan.batches.length === 2, "Splits script into production batches");
    assert(res.plan.batches[0].includes("scene-1"), "First batch contains scene 1");
    console.log("   ✓ Batch planning verified.");
  }

  // ==================================================
  // 9. Resource Estimation
  // ==================================================
  console.log("\n9. Verifying Resource Estimation...");
  {
    const req: ProductionRequest = {
      id: getUniqueId("req-resources"),
      scriptId: getUniqueId("script-id"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.reports.length === 1, "Resource estimation report generated");
    assert(res.reports[0].estimatedCost > 0, "Estimates production cost");
    assert(res.reports[0].gpuTimeSeconds > 0, "Estimates GPU rendering time");
    console.log("   ✓ Resource estimation verified.");
  }

  // ==================================================
  // 10. Production Report Generation
  // ==================================================
  console.log("\n10. Verifying Production Report Generation...");
  {
    const req: ProductionRequest = {
      id: getUniqueId("req-report"),
      scriptId: getUniqueId("script-id"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.reports[0].totalAssets === 4, "Report has total asset counts");
    assert(res.reports[0].missingAssets.length === 0, "Report tracks missing assets");
    console.log("   ✓ Production report generation verified.");
  }

  // ==================================================
  // 11. Script Integration
  // ==================================================
  console.log("\n11. Verifying Script Integration...");
  {
    await scriptEngine.initialize();
    await scriptEngine.start();

    const scriptReq: any = {
      id: "req-script-prod-test",
      type: ScriptType.TUTORIAL,
      topic: "Typescript Mixins",
      state: ScriptState.CREATED,
      timestamp: new Date(),
      options: { generateProductionPlan: true },
    };

    await scriptEngine.generate(scriptReq);

    // Verify ProductionEngine history has a linked entry created automatically
    const history = engine.getHistory();
    assert(
      history.some((h) => h.productionId === "prod-script-linked-req-script-prod-test"),
      "Linked production blueprint generated automatically when Script finished"
    );
    console.log("   ✓ Script integration verified.");
  }

  // ==================================================
  // 12. Planning Integration
  // ==================================================
  console.log("\n12. Verifying Planning Integration...");
  {
    const planningContext = {
      logger,
      config,
      registry,
      eventBus,
      memoryStore,
      productionEngine: engine,
    };
    const planningEngine = new PlanningEngine(planningContext);
    await planningEngine.initialize();
    await planningEngine.start();

    // Run decomposition with planning engine
    const planResult = await planningEngine.createPlan({
      id: "plan-prod-test",
      goal: {
        id: "g-1",
        description: "Execute production queue sequence",
        status: "pending" as any,
        priority: "HIGH" as any,
        type: "COMPOSITE" as any,
      },
    });

    assert(
      planResult.tasks.some((t: any) => t.id.includes("task-prod-")),
      "Planning engine decomposed production queue sequence goal into asset queue tasks"
    );
    console.log("   ✓ Planning integration verified.");
  }

  // ==================================================
  // 13. Decision Integration
  // ==================================================
  console.log("\n13. Verifying Decision Integration...");
  {
    const decisionContext = {
      logger,
      config,
      registry,
      eventBus,
      memoryStore,
      productionEngine: engine,
    };
    const decisionEngine = new DecisionEngine(decisionContext);

    // Pre-populate production history with expensive plan (e.g. cost = 1.5)
    const mockEngine = new ProductionBuilder()
      .withContext(decisionContext)
      .withAssetPlanner({
        planAssets: async () => [
          { id: "voice-1", type: AssetType.VOICE, status: AssetStatus.PLANNED, priority: ProductionPriority.CRITICAL, dependencies: [] },
        ],
      })
      .build();
    await mockEngine.initialize();
    await mockEngine.start();

    // Override the registered engine inside decisionContext for target test
    Object.assign(decisionContext, { productionEngine: mockEngine });

    const req: ProductionRequest = {
      id: getUniqueId("req-dec-prod-seed"),
      scriptId: getUniqueId("script-id-dec"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    const res = await mockEngine.generate(req);
    res.reports[0].estimatedCost = 1.5; // Trigger cost penalty

    const decision = new DecisionBuilder()
      .withId("dec-prod-cost-penalty")
      .withPriority("HIGH" as any)
      .withContext(decisionContext)
      .addOption({
        id: "opt-1",
        name: "Option 1",
        description: "D",
        cost: 1,
        reward: 5,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5, feasibility: 0.5 },
      })
      .addCriteria({ name: "alignment", weight: 1.0 })
      .build();

    const evaluated = await decisionEngine.evaluate(decision);
    // Feasibility should be penalized from 0.5 to 0.35 because of high estimated costs (cost > 1.0)
    assert(
      evaluated.options[0].scores!.feasibility < 0.5,
      "Decision engine successfully penalized option feasibility due to high estimated production costs"
    );
    console.log("   ✓ Decision integration verified.");
  }

  // ==================================================
  // 14. Memory Integration
  // ==================================================
  console.log("\n14. Verifying Memory Integration...");
  {
    const scriptId = getUniqueId("script-id-mem");
    const req: ProductionRequest = {
      id: getUniqueId("req-prod-mem"),
      scriptId: scriptId,
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    const memEntry = await memoryStore.get<ProductionResponse>("production-memory", `production:${scriptId}`);
    assert(memEntry !== undefined, "Saved production response into memory store namespace");
    assert(memEntry!.value.productionId.includes("req-prod-mem"), "Retrieved correct production plan from memory");
    console.log("   ✓ Memory integration verified.");
  }

  // ==================================================
  // 15. Agent Integration
  // ==================================================
  console.log("\n15. Verifying Agent Integration...");
  {
    const agentContext = {
      logger,
      config,
      registry,
      eventBus,
      memoryStore,
      jobEngine: new JobEngine(logger, eventBus),
      productionEngine: engine,
    };

    class DummyLifecycle {
      public async initialize(): Promise<void> {}
      public async execute(context: any, input?: any): Promise<any> {
        return input;
      }
      public async shutdown(): Promise<void> {}
    }

    const agent = new AgentBuilder()
      .withId("agent-production-planner")
      .withName("Production Planner Agent")
      .withRole("Strategist" as any)
      .withDescription("Test agent with production capability")
      .withVersion("1.0.0")
      .withCapabilities(["production" as any])
      .withContext(agentContext)
      .withLifecycle(new DummyLifecycle())
      .build();

    await agent.initialize();

    const req: ProductionRequest = {
      id: getUniqueId("req-agent-prod-task"),
      scriptId: getUniqueId("script-id-agent"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };

    const result = (await agent.execute(req)) as ProductionResponse;
    assert(result.productionId === req.id, "Agent executed production planner directly");
    assert(result.plan.assets.length > 0, "Agent returned production report with planned assets");
    console.log("   ✓ Agent integration verified.");
  }

  // ==================================================
  // 16. Event Publishing
  // ==================================================
  console.log("\n16. Verifying Event Publishing...");
  {
    let startedFired = false;
    let completedFired = false;

    eventBus.subscribe("ProductionStarted", async () => {
      startedFired = true;
    });

    eventBus.subscribe("ProductionCompleted", async () => {
      completedFired = true;
    });

    const req: ProductionRequest = {
      id: getUniqueId("req-events-prod"),
      scriptId: getUniqueId("script-id-events"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert(startedFired, "ProductionStarted event was published to EventBus");
    assert(completedFired, "ProductionCompleted event was published to EventBus");
    console.log("   ✓ Event publishing verified.");
  }

  // ==================================================
  // 17. Snapshot Immutability
  // ==================================================
  console.log("\n17. Verifying Snapshot Immutability...");
  {
    const reqId = getUniqueId("req-snapshot-prod");
    const req: ProductionRequest = {
      id: reqId,
      scriptId: getUniqueId("script-id-snapshot"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    const snapshot = engine.getSnapshot(reqId);
    assert(snapshot !== undefined, "Snapshot retrieved");
    assert(Object.isFrozen(snapshot), "Snapshot is frozen");

    try {
      (snapshot as any).state = ProductionState.FAILED;
      throw new Error("Should not allow property mutation on snapshot");
    } catch (e: any) {
      assert(e instanceof TypeError, "Mutating property throws TypeError");
    }
    console.log("   ✓ Snapshot immutability verified.");
  }

  // ==================================================
  // 18. Validator Rules
  // ==================================================
  console.log("\n18. Verifying Validator Rules...");
  {
    // 18.1 Empty production plan validation
    try {
      ProductionValidator.validateResponse({
        productionId: "req-invalid",
        state: ProductionState.COMPLETED,
        plan: { id: "p-1", scenes: [], assets: [], batches: [] },
        timeline: { scenes: {}, assets: {}, layers: {} },
        queue: { id: "q-1", items: [] },
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate empty plan");
    } catch (e: any) {
      assert(e instanceof ProductionValidationException, "Throws ProductionValidationException on empty plan");
    }

    // 18.2 Timeline overlap validation
    try {
      ProductionValidator.validateResponse({
        productionId: "req-overlap",
        state: ProductionState.COMPLETED,
        plan: {
          id: "p-1",
          scenes: [{ id: "scene-1", name: "S", requirements: [], durationSeconds: 10 }],
          assets: [
            { id: "asset-1", type: AssetType.VIDEO, status: AssetStatus.PLANNED, priority: ProductionPriority.NORMAL, dependencies: [] },
            { id: "asset-2", type: AssetType.VIDEO, status: AssetStatus.PLANNED, priority: ProductionPriority.NORMAL, dependencies: [] },
          ],
          batches: [],
        },
        timeline: {
          scenes: { "scene-1": { start: 0, end: 10 } },
          assets: {
            "asset-1": { start: 0, end: 8 },
            "asset-2": { start: 5, end: 10 }, // Overlaps asset-1 start time 0-8!
          },
          layers: {
            visual: ["asset-1", "asset-2"],
          },
        },
        queue: { id: "q-1", items: ["asset-1", "asset-2"] },
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate overlapping timeline");
    } catch (e: any) {
      assert(e instanceof ProductionValidationException, "Throws ProductionValidationException on overlapping timeline");
    }

    // 18.3 Queue ordering validation (dependencies sequenced after dependent items)
    try {
      ProductionValidator.validateResponse({
        productionId: "req-queue-invalid",
        state: ProductionState.COMPLETED,
        plan: {
          id: "p-1",
          scenes: [{ id: "scene-1", name: "S", requirements: [], durationSeconds: 10 }],
          assets: [
            { id: "asset-1", type: AssetType.VIDEO, status: AssetStatus.PLANNED, priority: ProductionPriority.NORMAL, dependencies: [{ assetId: "asset-2", type: "dep" }] },
            { id: "asset-2", type: AssetType.IMAGE, status: AssetStatus.PLANNED, priority: ProductionPriority.NORMAL, dependencies: [] },
          ],
          batches: [],
        },
        timeline: {
          scenes: { "scene-1": { start: 0, end: 10 } },
          assets: {
            "asset-1": { start: 5, end: 10 },
            "asset-2": { start: 0, end: 5 },
          },
          layers: {
            visual: ["asset-2"],
            visual2: ["asset-1"],
          },
        },
        queue: { id: "q-1", items: ["asset-1", "asset-2"] }, // asset-1 depends on asset-2 but asset-1 is placed first in queue!
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate invalid queue sequence");
    } catch (e: any) {
      assert(e instanceof ProductionValidationException, "Throws ProductionValidationException on invalid queue sequence");
    }

    // 18.4 Circular dependencies validation
    try {
      ProductionValidator.validateDependencies([
        { id: "asset-1", type: AssetType.VIDEO, status: AssetStatus.PLANNED, priority: ProductionPriority.NORMAL, dependencies: [{ assetId: "asset-2", type: "dep" }] },
        { id: "asset-2", type: AssetType.VIDEO, status: AssetStatus.PLANNED, priority: ProductionPriority.NORMAL, dependencies: [{ assetId: "asset-1", type: "dep" }] },
      ]);
      throw new Error("Should not validate circular asset dependencies");
    } catch (e: any) {
      assert(e instanceof ProductionValidationException, "Throws ProductionValidationException on circular dependency loop");
    }
    console.log("   ✓ Validator rules verified.");
  }

  // ==================================================
  // 19. Regression Tests
  // ==================================================
  console.log("\n19. Verifying Regression Tests...");
  {
    // Seed engines that haven't run yet so history is non-empty
    if (researchEngine.getHistory().length === 0) {
      await researchEngine.initialize();
      await researchEngine.start();
      await researchEngine.execute({
        id: "reg-research-seed",
        type: "FULL" as any,
        channelProfile: { query: "TypeScript" },
        state: "CREATED" as any,
        timestamp: new Date(),
      });
    }

    if (strategyEngine.getHistory().length === 0) {
      await strategyEngine.initialize();
      await strategyEngine.start();
      await strategyEngine.generate({
        id: "reg-strategy-seed",
        type: "FULL" as any,
        researchResponse: {
          requestId: "req-seed-1",
          state: "COMPLETED" as any,
          topics: [
            {
              id: "topic-seed",
              topic: "TypeScript",
              category: "Technology",
              growthScore: 0.8,
              competitionScore: 0.3,
              trendScore: 0.75,
              monetizationScore: 0.8,
              audienceMatchScore: 0.8,
              confidenceScore: 0.85,
              finalScore: 0.8,
              tags: ["ts"],
              metadata: {},
            },
          ],
          opportunities: [],
          reports: [],
          timestamp: new Date(),
        },
        state: "CREATED" as any,
        timestamp: new Date(),
      });
    }

    if (channelEngine.getHistory().length === 0) {
      await channelEngine.initialize();
      await channelEngine.start();
      await channelEngine.generate("reg-chan-seed", "TypeScript tutorials");
    }

    assert(researchEngine.getHistory().length > 0, "Research history exists");
    assert(strategyEngine.getHistory().length > 0, "Strategy history exists");
    assert(channelEngine.getHistory().length > 0, "Channel history exists");
    assert(scriptEngine.getHistory().length > 0, "Script history exists");
    console.log("   ✓ Regression tests verified.");
  }

  // ==================================================
  // 20. Full End-to-End Production Planning
  // ==================================================
  console.log("\n20. Verifying Full End-to-End Production Planning...");
  {
    const req: ProductionRequest = {
      id: getUniqueId("req-e2e-final"),
      scriptId: getUniqueId("script-id-final"),
      state: ProductionState.CREATED,
      timestamp: new Date(),
    };

    const res = await engine.generate(req);
    assert(res.state === ProductionState.COMPLETED, "Response state is COMPLETED");
    assert(res.plan.scenes.length === 3, "Returns all production scenes");
    assert(res.plan.assets.length === 4, "Returns all production assets");
    assert(res.timeline.scenes !== undefined, "Returns timeline layout");
    assert(res.queue.items.length === 4, "Returns generation queue sequence");
    assert(res.reports.length === 1, "Includes production cost estimate report");
    console.log("   ✓ Full end-to-end production planning verified.");
  }

  console.log("\n=== ALL 20/20 PRODUCTION ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
