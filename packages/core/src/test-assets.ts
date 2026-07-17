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
  AssetEngine,
  AssetBuilder,
  AssetValidator,
  AssetState,
  AssetType,
  PromptType,
  MediaType,
  VisualStyle,
  AssetRequest,
  AssetResponse,
  ProductionSnapshot,
  AssetValidationException,
  AssetException,
} from "./assets/index";

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
  console.log("=== START SPRINT 12.5 ASSET PLANNING ENGINE TESTS ===");

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

  const engine = new AssetBuilder()
    .withContext(platformContext)
    .withMetadata({ version: "1.0.0" })
    .build();

  // Register in registry
  registry.register({ name: "IAssetEngine" } as any, engine);

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
    assetEngine: engine,
    researchEngine: researchEngine,
    strategyEngine: strategyEngine,
    channelEngine: channelEngine,
    scriptEngine: scriptEngine,
  });

  // Unique topic tracker to prevent duplicate detection triggers in testing
  let trackerId = 0;
  function getUniqueId(base = "AssetTest") {
    trackerId++;
    return `${base}-${trackerId}`;
  }

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("\n1. Verifying Builder Validation...");
  {
    try {
      new AssetBuilder().build();
      throw new Error("Should not build without context");
    } catch (e: any) {
      assert(e.message.includes("Context is required"), "Throws correct error for missing context");
    }

    const testEngine = new AssetBuilder().withContext(platformContext).build();
    assert(testEngine instanceof AssetEngine, "Succeeds with context");
    console.log("   ✓ Builder validation verified.");
  }

  // ==================================================
  // 2. Lifecycle Transitions
  // ==================================================
  console.log("\n2. Verifying Lifecycle Transitions...");
  {
    assert(engine.state === AssetState.CREATED, "Starts in CREATED state");

    try {
      await engine.start();
      throw new Error("Should fail starting before initialize");
    } catch (e: any) {
      assert(e instanceof Error, "Fails transition directly from CREATED to RUNNING");
    }

    await engine.initialize();
    assert(engine.state === AssetState.INITIALIZED, "State becomes INITIALIZED");

    await engine.start();
    assert(engine.state === AssetState.RUNNING, "State becomes RUNNING");

    await engine.stop();
    assert(engine.state === AssetState.STOPPED, "State becomes STOPPED");

    await engine.start();
    assert(engine.state === AssetState.RUNNING, "State restored to RUNNING");
    console.log("   ✓ Lifecycle transitions verified.");
  }

  // ==================================================
  // 3. Asset Planning Generation
  // ==================================================
  console.log("\n3. Verifying Asset Planning Generation...");
  {
    const req: AssetRequest = {
      id: getUniqueId("req-asset-gen"),
      scriptId: getUniqueId("script-id"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.assets.length === 3, "Generates hierarchy of assets");
    assert(res.assets[0].priority === "HIGH", "Supports priorities");
    assert(res.assets[0].version === 1, "Tracks version counts");
    console.log("   ✓ Asset planning generation verified.");
  }

  // ==================================================
  // 4. Scene Asset Mapping
  // ==================================================
  console.log("\n4. Verifying Scene Asset Mapping...");
  {
    const req: AssetRequest = {
      id: getUniqueId("req-scene-map"),
      scriptId: getUniqueId("script-id"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.groups.length === 3, "Maps assets into scene groups");
    assert(res.groups[0].name.includes("Scene 1"), "Correct scene name mapped");
    assert(res.groups[0].assetIds.includes("asset-1"), "Asset linked to group");
    console.log("   ✓ Scene asset mapping verified.");
  }

  // ==================================================
  // 5. Prompt Generation
  // ==================================================
  console.log("\n5. Verifying Prompt Generation...");
  {
    const req: AssetRequest = {
      id: getUniqueId("req-prompts"),
      scriptId: getUniqueId("script-id"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.assets[0].prompts.length > 0, "Asset has generated prompts");
    assert(
      res.assets[0].prompts[0].type === PromptType.IMAGE_MODEL,
      "Prompt has correct model target type"
    );
    console.log("   ✓ Prompt generation verified.");
  }

  // ==================================================
  // 6. Visual Style Generation
  // ==================================================
  console.log("\n6. Verifying Visual Style Generation...");
  {
    const req: AssetRequest = {
      id: getUniqueId("req-style"),
      scriptId: getUniqueId("script-id"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.styleGuide.visualStyle === VisualStyle.DARK_MODE, "Has visual style set");
    assert(res.styleGuide.aspectRatio === "16:9", "Has aspect ratio set");
    assert(res.styleGuide.resolution.includes("3840x2160"), "Has render resolution set");
    console.log("   ✓ Visual style generation verified.");
  }

  // ==================================================
  // 7. Character Planning
  // ==================================================
  console.log("\n7. Verifying Character Planning...");
  {
    const req: AssetRequest = {
      id: getUniqueId("req-char"),
      scriptId: getUniqueId("script-id"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.characters.length > 0, "Character profiles generated");
    assert(res.characters[0].id === "char-host", "Presenter Host is set");
    assert(res.characters[0].voiceId.includes("voice"), "Voice identity is set");
    console.log("   ✓ Character planning verified.");
  }

  // ==================================================
  // 8. Media Timeline Generation
  // ==================================================
  console.log("\n8. Verifying Media Timeline Generation...");
  {
    const req: AssetRequest = {
      id: getUniqueId("req-timeline"),
      scriptId: getUniqueId("script-id"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.timeline.shots.length > 0, "Shots timeline exists");
    assert(res.timeline.assetTimings["asset-1"].duration === 20, "Has asset display times");
    assert(res.timeline.overlayTimings["text-overlay-1"].start === 2, "Tracks text layer overlay timings");
    console.log("   ✓ Media timeline generation verified.");
  }

  // ==================================================
  // 9. Dependency Graph Generation
  // ==================================================
  console.log("\n9. Verifying Dependency Graph Generation...");
  {
    const req: AssetRequest = {
      id: getUniqueId("req-graph"),
      scriptId: getUniqueId("script-id"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.graph.nodeDependencies["asset-2"].includes("asset-1"), "Asset 2 depends on Asset 1");
    assert(res.graph.generationOrder[0] === "asset-1", "Asset 1 is sequenced first");
    console.log("   ✓ Dependency graph generation verified.");
  }

  // ==================================================
  // 10. Production Optimization
  // ==================================================
  console.log("\n10. Verifying Production Optimization...");
  {
    // Seed winning visual styles in memory
    await memoryStore.set("asset-memory", "winning-visual-styles", [VisualStyle.DARK_MODE]);

    const req: AssetRequest = {
      id: getUniqueId("req-opt"),
      scriptId: getUniqueId("script-id"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(
      res.styleGuide.renderQuality.includes("Optimized preset"),
      "Optimized style presets based on memory feedback loops"
    );
    console.log("   ✓ Production optimization verified.");
  }

  // ==================================================
  // 11. Script Integration
  // ==================================================
  console.log("\n11. Verifying Script Integration...");
  {
    await scriptEngine.initialize();
    await scriptEngine.start();

    const scriptReq: any = {
      id: "req-script-assets-test",
      type: ScriptType.TUTORIAL,
      topic: "Typescript Generics",
      state: ScriptState.CREATED,
      timestamp: new Date(),
      options: { generateAssetPlan: true },
    };

    await scriptEngine.generate(scriptReq);

    // Verify AssetEngine history has a linked entry created automatically
    const history = engine.getHistory();
    assert(
      history.some((h) => h.productionId === "ass-script-linked-req-script-assets-test"),
      "Linked production assets planned automatically when Script finished"
    );
    console.log("   ✓ Script integration verified.");
  }

  // ==================================================
  // 12. Channel Integration
  // ==================================================
  console.log("\n12. Verifying Channel Integration...");
  {
    await channelEngine.initialize();
    await channelEngine.start();

    // Generate a channel profile first to populate history
    const nicheName = "Advanced CSS Painting Part 2";
    await channelEngine.generate("chan-asset-integration", nicheName);

    const req: AssetRequest = {
      id: getUniqueId("req-style-channel"),
      scriptId: getUniqueId("script-id"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);

    // Verify visual color palette rules were injected into StyleGuide
    assert(
      res.styleGuide.colorPalette.includes("#1e1e2e"),
      "Asset Engine successfully adapted visual colors from active Channel Brand guide"
    );
    console.log("   ✓ Channel integration verified.");
  }

  // ==================================================
  // 13. Strategy Integration
  // ==================================================
  console.log("\n13. Verifying Strategy Integration...");
  {
    await strategyEngine.initialize();
    await strategyEngine.start();

    const mockResearchResponse: any = {
      requestId: "req-res-strat-assets-test",
      state: ResearchState.COMPLETED,
      topics: [{ id: "t-1", topic: "Symmetric Cryptography", finalScore: 0.9, trendScore: 0.8, monetizationScore: 0.8, confidenceScore: 0.9 }],
      timestamp: new Date(),
    };

    await strategyEngine.generate({
      id: "req-strat-assets-integration",
      type: "FULL" as any,
      researchResponse: mockResearchResponse,
      state: StrategyState.CREATED,
      timestamp: new Date(),
      options: { generateAssetPlansForCalendar: true },
    });

    // Verify AssetEngine history has a linked entry from strategy calendar entries
    const history = engine.getHistory();
    assert(
      history.some((h) => h.productionId.includes("ass-strat-linked-")),
      "Linked production assets generated automatically when Strategy calendar scheduled"
    );
    console.log("   ✓ Strategy integration verified.");
  }

  // ==================================================
  // 14. Memory Integration
  // ==================================================
  console.log("\n14. Verifying Memory Integration...");
  {
    const scriptId = getUniqueId("script-id-mem");
    const req: AssetRequest = {
      id: getUniqueId("req-asset-mem"),
      scriptId: scriptId,
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    const memEntry = await memoryStore.get<AssetResponse>("asset-memory", `assets:${scriptId}`);
    assert(memEntry !== undefined, "Saved asset response into memory store namespace");
    assert(memEntry!.value.productionId.includes("req-asset-mem"), "Retrieved correct asset plan from memory");
    console.log("   ✓ Memory integration verified.");
  }

  // ==================================================
  // 15. Decision Integration
  // ==================================================
  console.log("\n15. Verifying Decision Integration...");
  {
    const decisionContext = {
      logger,
      config,
      registry,
      eventBus,
      memoryStore,
      assetEngine: engine,
    };
    const decisionEngine = new DecisionEngine(decisionContext);

    // Pre-populate asset history with expensive plan (e.g. costs = 1.5 > 1.0)
    const mockEngine = new AssetBuilder()
      .withContext(decisionContext)
      .withPromptEngine({
        generatePrompts: async () => [{ type: PromptType.IMAGE_MODEL, promptText: "Expensive", version: 1 }],
      })
      .build();
    await mockEngine.initialize();
    await mockEngine.start();

    // Override the registered engine inside decisionContext for target test
    Object.assign(decisionContext, { assetEngine: mockEngine });

    const req: AssetRequest = {
      id: getUniqueId("req-dec-assets-seed"),
      scriptId: getUniqueId("script-id-dec"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    const res = await mockEngine.generate(req);
    res.reports[0].totalCostEstimate = 1.5; // Override cost to trigger penalty

    const decision = new DecisionBuilder()
      .withId("dec-assets-cost-penalty")
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
    // Option feasibility should be penalized because of high asset costs (0.5 - 0.1 = 0.4)
    assert(
      evaluated.options[0].scores!.feasibility < 0.5,
      "Decision engine successfully penalized option feasibility due to high media asset costs"
    );
    console.log("   ✓ Decision integration verified.");
  }

  // ==================================================
  // 16. Agent Integration
  // ==================================================
  console.log("\n16. Verifying Agent Integration...");
  {
    const agentContext = {
      logger,
      config,
      registry,
      eventBus,
      memoryStore,
      jobEngine: new JobEngine(logger, eventBus),
      assetEngine: engine,
    };

    class DummyLifecycle {
      public async initialize(): Promise<void> {}
      public async execute(context: any, input?: any): Promise<any> {
        return input;
      }
      public async shutdown(): Promise<void> {}
    }

    const agent = new AgentBuilder()
      .withId("agent-mediaplanner")
      .withName("Media Production Planner Agent")
      .withRole("Strategist" as any)
      .withDescription("Test agent with assets planning capability")
      .withVersion("1.0.0")
      .withCapabilities(["assets" as any])
      .withContext(agentContext)
      .withLifecycle(new DummyLifecycle())
      .build();

    await agent.initialize();

    const req: AssetRequest = {
      id: getUniqueId("req-agent-assets-task"),
      scriptId: getUniqueId("script-id-agent"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };

    const result = (await agent.execute(req)) as AssetResponse;
    assert(result.productionId === req.id, "Agent executed asset planner directly");
    assert(result.assets.length > 0, "Agent returned production report with planned assets");
    console.log("   ✓ Agent integration verified.");
  }

  // ==================================================
  // 17. Event Publishing
  // ==================================================
  console.log("\n17. Verifying Event Publishing...");
  {
    let startedFired = false;
    let completedFired = false;

    eventBus.subscribe("AssetPlanningStarted", async () => {
      startedFired = true;
    });

    eventBus.subscribe("AssetPlanningCompleted", async () => {
      completedFired = true;
    });

    const req: AssetRequest = {
      id: getUniqueId("req-events-asset"),
      scriptId: getUniqueId("script-id-events"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert(startedFired, "AssetPlanningStarted event was published to EventBus");
    assert(completedFired, "AssetPlanningCompleted event was published to EventBus");
    console.log("   ✓ Event publishing verified.");
  }

  // ==================================================
  // 18. Snapshot Immutability
  // ==================================================
  console.log("\n18. Verifying Snapshot Immutability...");
  {
    const reqId = getUniqueId("req-snapshot-asset");
    const req: AssetRequest = {
      id: reqId,
      scriptId: getUniqueId("script-id-snapshot"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    const snapshot = engine.getSnapshot(reqId);
    assert(snapshot !== undefined, "Snapshot retrieved");
    assert(Object.isFrozen(snapshot), "Snapshot is frozen");

    try {
      (snapshot as any).state = AssetState.FAILED;
      throw new Error("Should not allow property mutation on snapshot");
    } catch (e: any) {
      assert(e instanceof TypeError, "Mutating property throws TypeError");
    }
    console.log("   ✓ Snapshot immutability verified.");
  }

  // ==================================================
  // 19. Validator Rules
  // ==================================================
  console.log("\n19. Verifying Validator Rules...");
  {
    // 19.1 Missing style guide fields validation
    try {
      AssetValidator.validateResponse({
        productionId: "req-invalid",
        state: AssetState.COMPLETED,
        assets: [],
        groups: [],
        styleGuide: {
          visualStyle: undefined as any, // Missing
          colorPalette: [],
          lightingSpec: "",
          cameraLanguage: "",
          compositionRules: [],
          lensSuggestions: [],
          aspectRatio: "",
          resolution: "",
          renderQuality: "",
        },
        characters: [],
        timeline: { shots: [], assetTimings: {}, layerTimings: {}, transitionTimings: {}, overlayTimings: {}, subtitleTimings: {} },
        graph: { nodeDependencies: {}, generationOrder: [], parallelSlots: [] },
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate style guide with missing fields");
    } catch (e: any) {
      assert(e instanceof AssetValidationException, "Throws AssetValidationException on missing style data");
    }

    // 19.2 Empty prompts validation
    try {
      AssetValidator.validateResponse({
        productionId: "req-empty-prompts",
        state: AssetState.COMPLETED,
        assets: [
          { id: "asset-1", type: AssetType.IMAGE, name: "Name", priority: "NORMAL", version: 1, prompts: [], dependencies: [] }, // No prompts!
        ],
        groups: [],
        styleGuide: {
          visualStyle: VisualStyle.DARK_MODE,
          colorPalette: ["#000000"],
          lightingSpec: "",
          cameraLanguage: "",
          compositionRules: [],
          lensSuggestions: [],
          aspectRatio: "16:9",
          resolution: "1080p",
          renderQuality: "",
        },
        characters: [],
        timeline: { shots: [], assetTimings: {}, layerTimings: {}, transitionTimings: {}, overlayTimings: {}, subtitleTimings: {} },
        graph: { nodeDependencies: {}, generationOrder: [], parallelSlots: [] },
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate asset without prompts");
    } catch (e: any) {
      assert(e instanceof AssetValidationException, "Throws AssetValidationException on empty prompts array");
    }

    // 19.3 Circular dependencies in assets validation
    try {
      AssetValidator.validateDependencies([
        { id: "asset-1", type: AssetType.IMAGE, name: "A", priority: "NORMAL", version: 1, prompts: [], dependencies: ["asset-2"] },
        { id: "asset-2", type: AssetType.IMAGE, name: "B", priority: "NORMAL", version: 1, prompts: [], dependencies: ["asset-1"] },
      ]);
      throw new Error("Should not validate circular asset dependencies");
    } catch (e: any) {
      assert(e instanceof AssetValidationException, "Throws AssetValidationException on circular dependency loop");
    }
    console.log("   ✓ Validator rules verified.");
  }

  // ==================================================
  // 20. Full End-to-End Production Planning Generation
  // ==================================================
  console.log("\n20. Verifying Full End-to-End Production Planning Generation...");
  {
    const req: AssetRequest = {
      id: getUniqueId("req-e2e-final"),
      scriptId: getUniqueId("script-id-final"),
      state: AssetState.CREATED,
      timestamp: new Date(),
    };

    const res = await engine.generate(req);
    assert(res.state === AssetState.COMPLETED, "Response state is COMPLETED");
    assert(res.assets.length === 3, "Returns all production assets");
    assert(res.groups.length === 3, "Returns asset grouping");
    assert(res.styleGuide !== undefined, "Returns visual style guide spec");
    assert(res.characters.length === 1, "Returns avatar/presenter spec");
    assert(res.timeline.shots.length === 3, "Returns timeline planner layout");
    assert(res.graph.generationOrder.length === 3, "Returns dependency graph execution order");
    assert(res.reports.length === 1, "Includes production cost/render time estimate report");
    console.log("   ✓ Full end-to-end production planning generation verified.");
  }

  console.log("\n=== ALL 20/20 ASSET PLANNING ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
