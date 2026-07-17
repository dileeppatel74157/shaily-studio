import { LoggerBuilder, JsonFormatter } from "./logger/index";
import { EventBus } from "./events/index";
import { ConfigBuilder, MemorySource } from "./config/index";
import { MemoryStore } from "./memory/index";
import { ServiceRegistry } from "./registry/index";
import { AgentBuilder } from "./agents/index";
import { PlanningEngine } from "./planning/index";
import { DecisionEngine, DecisionBuilder, DecisionRisk } from "./decision/index";
import { JobEngine } from "./jobs/JobEngine";
import { ResearchEngine, ResearchBuilder, ResearchState } from "./research/index";
import { StrategyEngine, StrategyBuilder, StrategyState } from "./strategy/index";
import { ChannelEngine, ChannelBuilder, ChannelState } from "./channel/index";
import {
  ScriptEngine,
  ScriptBuilder,
  ScriptValidator,
  ScriptState,
  ScriptType,
  StoryStructure,
  SceneType,
  DialogueType,
  ScriptRequest,
  ScriptResponse,
  ScriptSnapshot,
  ScriptValidationException,
  ScriptException,
} from "./script/index";

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
  console.log("=== START SPRINT 12.4 SCRIPT INTELLIGENCE ENGINE TESTS ===");

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

  const engine = new ScriptBuilder()
    .withContext(platformContext)
    .withMetadata({ version: "1.0.0" })
    .build();

  // Register in registry
  registry.register({ name: "IScriptEngine" } as any, engine);

  const researchEngine = new ResearchBuilder().withContext(platformContext).build();
  registry.register({ name: "IResearchEngine" } as any, researchEngine);

  const strategyEngine = new StrategyBuilder().withContext(platformContext).build();
  registry.register({ name: "IStrategyEngine" } as any, strategyEngine);

  const channelEngine = new ChannelBuilder().withContext(platformContext).build();
  registry.register({ name: "IChannelEngine" } as any, channelEngine);

  // Cross-reference context properties
  Object.assign(platformContext, {
    scriptEngine: engine,
    researchEngine: researchEngine,
    strategyEngine: strategyEngine,
    channelEngine: channelEngine,
  });

  // Unique topic tracker to prevent duplicate detection triggers in testing
  let topicCounter = 0;
  function getUniqueTopic(base = "WebGPU Development") {
    topicCounter++;
    return `${base} Part ${topicCounter}`;
  }

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("\n1. Verifying Builder Validation...");
  {
    try {
      new ScriptBuilder().build();
      throw new Error("Should not build without context");
    } catch (e: any) {
      assert(e.message.includes("Context is required"), "Throws correct error for missing context");
    }

    const testEngine = new ScriptBuilder().withContext(platformContext).build();
    assert(testEngine instanceof ScriptEngine, "Succeeds with context");
    console.log("   ✓ Builder validation verified.");
  }

  // ==================================================
  // 2. Lifecycle Transitions
  // ==================================================
  console.log("\n2. Verifying Lifecycle Transitions...");
  {
    assert(engine.state === ScriptState.CREATED, "Starts in CREATED state");

    try {
      await engine.start();
      throw new Error("Should fail starting before initialize");
    } catch (e: any) {
      assert(e instanceof Error, "Fails transition directly from CREATED to RUNNING");
    }

    await engine.initialize();
    assert(engine.state === ScriptState.INITIALIZED, "State becomes INITIALIZED");

    await engine.start();
    assert(engine.state === ScriptState.RUNNING, "State becomes RUNNING");

    await engine.stop();
    assert(engine.state === ScriptState.STOPPED, "State becomes STOPPED");

    await engine.start();
    assert(engine.state === ScriptState.RUNNING, "State restored to RUNNING");
    console.log("   ✓ Lifecycle transitions verified.");
  }

  // ==================================================
  // 3. Script Architecture Generation
  // ==================================================
  console.log("\n3. Verifying Script Architecture Generation...");
  {
    const req: ScriptRequest = {
      id: "req-script-arch-3",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.scriptId === "req-script-arch-3", "Generates correct Script ID");
    assert(res.outline.durationSeconds === 60, "Has expected total duration");
    assert(res.reports.length > 0, "Outline timing report is populated");
    console.log("   ✓ Script architecture generation verified.");
  }

  // ==================================================
  // 4. Story Flow Generation
  // ==================================================
  console.log("\n4. Verifying Story Flow Generation...");
  {
    const req: ScriptRequest = {
      id: "req-script-flow-4",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.storyMap.structure === StoryStructure.PROBLEM_SOLUTION, "Has correct story structure");
    assert(res.storyMap.arcPoints.length > 0, "Maintains narrative arc points");
    assert(res.storyMap.curiosityGaps.length > 0, "Contains curiosity gaps");
    console.log("   ✓ Story flow generation verified.");
  }

  // ==================================================
  // 5. Hook Generation
  // ==================================================
  console.log("\n5. Verifying Hook Generation...");
  {
    const req: ScriptRequest = {
      id: "req-script-hook-5",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    const hooks = res.retentionPoints.filter((r) => r.timeSeconds <= 30);
    assert(hooks.length >= 3, "Contains expected hooks (3s, 10s, 30s)");
    assert(hooks.some((h) => h.type === "RetentionHook"), "Has retention hook");
    console.log("   ✓ Hook generation verified.");
  }

  // ==================================================
  // 6. Section Planning
  // ==================================================
  console.log("\n6. Verifying Section Planning...");
  {
    const req: ScriptRequest = {
      id: "req-script-sec-6",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    const sections = res.sections.map((s) => s.name);
    assert(sections.includes("INTRODUCTION"), "Sections contains INTRODUCTION");
    assert(sections.includes("MAIN"), "Sections contains MAIN");
    assert(sections.includes("CTA"), "Sections contains CTA");
    console.log("   ✓ Section planning verified.");
  }

  // ==================================================
  // 7. Scene Planning
  // ==================================================
  console.log("\n7. Verifying Scene Planning...");
  {
    const req: ScriptRequest = {
      id: "req-script-scene-7",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.scenes.length === 3, "Scene planner returned expected scenes");
    assert(res.scenes[0].type === SceneType.A_ROLL, "First scene is A-roll");
    assert(res.scenes[1].type === SceneType.SCREENSHARE, "Second scene is Screenshare");
    assert(res.scenes[1].dependencies.includes("scene-1"), "Scene dependencies are defined");
    console.log("   ✓ Scene planning verified.");
  }

  // ==================================================
  // 8. Dialogue Generation
  // ==================================================
  console.log("\n8. Verifying Dialogue Generation...");
  {
    const req: ScriptRequest = {
      id: "req-script-dialogue-8",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.dialogue.length === 3, "Dialogue engine generated expected dialogues");
    assert(res.dialogue[0].speaker === "Host", "Dialogue block has speaker name");
    assert(res.dialogue[0].text.length > 0, "Dialogue block has non-empty narration text");
    console.log("   ✓ Dialogue generation verified.");
  }

  // ==================================================
  // 9. Retention Planning
  // ==================================================
  console.log("\n9. Verifying Retention Planning...");
  {
    const req: ScriptRequest = {
      id: "req-script-retention-9",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(
      res.retentionPoints.some((r) => r.type === "Cliffhanger"),
      "Retention planners inserted cliffhanger moments"
    );
    console.log("   ✓ Retention planning verified.");
  }

  // ==================================================
  // 10. Script Optimization
  // ==================================================
  console.log("\n10. Verifying Script Optimization...");
  {
    // Seed winning story structures in memory
    await memoryStore.set("script-memory", "winning-story-structures", [StoryStructure.PROBLEM_SOLUTION]);

    const req: ScriptRequest = {
      id: "req-script-opt-10",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    // Optimizations should read winning structures and adjust emotional pacing
    assert(
      res.storyMap.emotionalPacing.includes("Optimized based on winning structure"),
      "Optimized story map emotional pacing based on memory feed"
    );
    console.log("   ✓ Script optimization verified.");
  }

  // ==================================================
  // 11. Research Integration
  // ==================================================
  console.log("\n11. Verifying Research Integration...");
  {
    await researchEngine.initialize();
    await researchEngine.start();

    // Execute research request with generateScript option enabled
    const researchReq: any = {
      id: "req-res-script-integration",
      type: "FULL" as any,
      channelProfile: { query: "Rust Language Concurrency" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
      options: { generateScript: true },
    };

    await researchEngine.execute(researchReq);

    // Verify ScriptEngine history has a linked entry created automatically
    const history = engine.getHistory();
    assert(
      history.some((h) => h.scriptId === "scr-linked-req-res-script-integration"),
      "Linked script generated automatically when Research finished"
    );
    console.log("   ✓ Research integration verified.");
  }

  // ==================================================
  // 12. Strategy Integration
  // ==================================================
  console.log("\n12. Verifying Strategy Integration...");
  {
    await strategyEngine.initialize();
    await strategyEngine.start();

    const topicName = getUniqueTopic("Strategy Calendar Topic");
    const mockResearchResponse: any = {
      requestId: "req-res-strat-script-test",
      state: ResearchState.COMPLETED,
      topics: [{ id: "t-1", topic: topicName, finalScore: 0.9, trendScore: 0.8, monetizationScore: 0.8, confidenceScore: 0.9 }],
      timestamp: new Date(),
    };

    await strategyEngine.generate({
      id: "req-strat-script-integration",
      type: "FULL" as any,
      researchResponse: mockResearchResponse,
      state: StrategyState.CREATED,
      timestamp: new Date(),
      options: { generateScriptsForCalendar: true },
    });

    // Verify ScriptEngine history has a linked entry from strategy calendar entries
    const history = engine.getHistory();
    assert(
      history.some((h) => h.scriptId.includes("scr-strat-linked-")),
      "Linked script generated automatically when Strategy calendar scheduled"
    );
    console.log("   ✓ Strategy integration verified.");
  }

  // ==================================================
  // 13. Channel Integration
  // ==================================================
  console.log("\n13. Verifying Channel Integration...");
  {
    await channelEngine.initialize();
    await channelEngine.start();

    // Generate a channel profile first to populate history
    const nicheName = "Advanced CSS Painting";
    await channelEngine.generate("chan-script-integration", nicheName);

    const req: ScriptRequest = {
      id: "req-script-chan-integration",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);

    // Verify visual color palette rules were injected into screenshare scene objectives
    const screenshareScene = res.scenes.find((s) => s.type === SceneType.SCREENSHARE);
    assert(
      screenshareScene!.objective.includes("Using palette: #1e1e2e, #cdd6f4, #89b4fa"),
      "Script Engine successfully adapted visual colors from active Channel Brand guide"
    );
    console.log("   ✓ Channel integration verified.");
  }

  // ==================================================
  // 14. Memory Integration
  // ==================================================
  console.log("\n14. Verifying Memory Integration...");
  {
    const topicName = getUniqueTopic();
    const req: ScriptRequest = {
      id: "req-script-mem-seed",
      type: ScriptType.TUTORIAL,
      topic: topicName,
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    const memEntry = await memoryStore.get<ScriptResponse>("script-memory", `script:${topicName}`);
    assert(memEntry !== undefined, "Saved script response into memory store namespace");
    assert(memEntry!.value.scriptId === "req-script-mem-seed", "Retrieved correct script from memory");
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
      scriptEngine: engine,
    };
    const decisionEngine = new DecisionEngine(decisionContext);

    // Pre-populate history with scene id: "scene-2" (Screenshare duration 30s)
    const req: ScriptRequest = {
      id: "req-dec-script-seed",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    // One option matches "scene-2" objective, which should be boosted by decision engine
    const decision = new DecisionBuilder()
      .withId("dec-script-timing-boost")
      .withPriority("HIGH" as any)
      .withContext(decisionContext)
      .addOption({
        id: "scene-2",
        name: "scene-2",
        description: "D",
        cost: 1,
        reward: 5,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5 },
      })
      .addOption({
        id: "Neutral Option",
        name: "Neutral Option",
        description: "D",
        cost: 1,
        reward: 5,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5 },
      })
      .addCriteria({ name: "alignment", weight: 1.0 })
      .build();

    const evaluated = await decisionEngine.evaluate(decision);
    assert(
      evaluated.selectedOptionId === "scene-2",
      "Decision engine successfully boosted option matching active script scene timeline"
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
      scriptEngine: engine,
    };

    class DummyLifecycle {
      public async initialize(): Promise<void> {}
      public async execute(context: any, input?: any): Promise<any> {
        return input;
      }
      public async shutdown(): Promise<void> {}
    }

    const agent = new AgentBuilder()
      .withId("agent-scriptwriter")
      .withName("Scriptwriter Agent")
      .withRole("Strategist" as any)
      .withDescription("Test agent with script capability")
      .withVersion("1.0.0")
      .withCapabilities(["script" as any])
      .withContext(agentContext)
      .withLifecycle(new DummyLifecycle())
      .build();

    await agent.initialize();

    const req: ScriptRequest = {
      id: "req-agent-script-task",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };

    const result = (await agent.execute(req)) as ScriptResponse;
    assert(result.scriptId === "req-agent-script-task", "Agent executed script generate directly");
    assert(result.scenes.length > 0, "Agent returned script response with planned scenes");
    console.log("   ✓ Agent integration verified.");
  }

  // ==================================================
  // 17. Event Publishing
  // ==================================================
  console.log("\n17. Verifying Event Publishing...");
  {
    let startedFired = false;
    let completedFired = false;

    eventBus.subscribe("ScriptStarted", async () => {
      startedFired = true;
    });

    eventBus.subscribe("ScriptCompleted", async () => {
      completedFired = true;
    });

    const req: ScriptRequest = {
      id: "req-events-script",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert(startedFired, "ScriptStarted event was published to EventBus");
    assert(completedFired, "ScriptCompleted event was published to EventBus");
    console.log("   ✓ Event publishing verified.");
  }

  // ==================================================
  // 18. Snapshot Immutability
  // ==================================================
  console.log("\n18. Verifying Snapshot Immutability...");
  {
    const req: ScriptRequest = {
      id: "req-snapshot-script",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    const snapshot = engine.getSnapshot("req-snapshot-script");
    assert(snapshot !== undefined, "Snapshot retrieved");
    assert(Object.isFrozen(snapshot), "Snapshot is frozen");

    try {
      (snapshot as any).state = ScriptState.FAILED;
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
    // 19.1 Missing sections validation
    try {
      ScriptValidator.validateResponse({
        scriptId: "req-invalid",
        state: ScriptState.COMPLETED,
        outline: { id: "o-1", title: "T", topics: [], durationSeconds: 60 },
        storyMap: { structure: StoryStructure.PROBLEM_SOLUTION, arcPoints: [], curiosityGaps: [], emotionalPacing: "", narrativeTransitions: [] },
        sections: [],
        scenes: [],
        dialogue: [],
        retentionPoints: [],
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate empty sections");
    } catch (e: any) {
      assert(e instanceof ScriptValidationException, "Throws ScriptValidationException on empty sections");
    }

    // 19.2 Timing conflict validation (Total sections duration does not match outline)
    try {
      ScriptValidator.validateResponse({
        scriptId: "req-time-conflict",
        state: ScriptState.COMPLETED,
        outline: { id: "o-1", title: "T", topics: [], durationSeconds: 60 },
        storyMap: { structure: StoryStructure.PROBLEM_SOLUTION, arcPoints: [], curiosityGaps: [], emotionalPacing: "", narrativeTransitions: [] },
        sections: [
          { id: "sec-1", name: "INTRODUCTION", durationSeconds: 20 },
          { id: "sec-2", name: "MAIN", durationSeconds: 20 },
          { id: "sec-3", name: "CTA", durationSeconds: 10 }, // Total = 50s, expected 60s
        ],
        scenes: [],
        dialogue: [],
        retentionPoints: [],
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate incorrect sum of section durations");
    } catch (e: any) {
      assert(e instanceof ScriptValidationException, "Throws ScriptValidationException on timing mismatch");
    }

    // 19.3 Invalid ordering validation
    try {
      ScriptValidator.validateResponse({
        scriptId: "req-order-conflict",
        state: ScriptState.COMPLETED,
        outline: { id: "o-1", title: "T", topics: [], durationSeconds: 60 },
        storyMap: { structure: StoryStructure.PROBLEM_SOLUTION, arcPoints: [], curiosityGaps: [], emotionalPacing: "", narrativeTransitions: [] },
        sections: [
          { id: "sec-1", name: "MAIN", durationSeconds: 30 },
          { id: "sec-2", name: "INTRODUCTION", durationSeconds: 20 }, // Main comes before Introduction!
          { id: "sec-3", name: "CTA", durationSeconds: 10 },
        ],
        scenes: [],
        dialogue: [],
        retentionPoints: [],
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate invalid section ordering");
    } catch (e: any) {
      assert(e instanceof ScriptValidationException, "Throws ScriptValidationException on invalid ordering");
    }

    // 19.4 Circular dependencies in scenes validation
    try {
      ScriptValidator.validateDependencies([
        { id: "scene-1", type: SceneType.A_ROLL, objective: "O", durationSeconds: 20, transition: "Cut", dependencies: ["scene-2"] },
        { id: "scene-2", type: SceneType.SCREENSHARE, objective: "O", durationSeconds: 20, transition: "Cut", dependencies: ["scene-1"] },
      ]);
      throw new Error("Should not validate circular scene dependencies");
    } catch (e: any) {
      assert(e instanceof ScriptValidationException, "Throws ScriptValidationException on circular dependency loop");
    }
    console.log("   ✓ Validator rules verified.");
  }

  // ==================================================
  // 20. Full End-to-End Script Blueprint Generation
  // ==================================================
  console.log("\n20. Verifying Full End-to-End Script Blueprint Generation...");
  {
    const req: ScriptRequest = {
      id: "req-e2e-script-final",
      type: ScriptType.TUTORIAL,
      topic: getUniqueTopic(),
      state: ScriptState.CREATED,
      timestamp: new Date(),
    };

    const res = await engine.generate(req);
    assert(res.state === ScriptState.COMPLETED, "Response state is COMPLETED");
    assert(res.outline !== undefined, "Returns script outline");
    assert(res.storyMap !== undefined, "Returns story map");
    assert(res.sections.length === 3, "Returns script sections");
    assert(res.scenes.length === 3, "Returns script scenes");
    assert(res.dialogue.length === 3, "Returns dialogue narration timeline");
    assert(res.reports.length === 1, "Includes script timing/outline report");
    console.log("   ✓ Full end-to-end script blueprint generation verified.");
  }

  console.log("\n=== ALL 20/20 SCRIPT INTELLIGENCE ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
