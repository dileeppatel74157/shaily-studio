import { LoggerBuilder, JsonFormatter } from "./logger/index";
import { EventBus } from "./events/index";
import { ConfigBuilder, MemorySource } from "./config/index";
import { MemoryStore } from "./memory/index";
import { ServiceRegistry } from "./registry/index";
import { AgentBuilder } from "./agents/index";
import { PlanningEngine } from "./planning/index";
import { DecisionEngine, DecisionBuilder, DecisionRisk } from "./decision/index";
import { JobEngine } from "./jobs/JobEngine";
import { ResearchEngine, ResearchBuilder, ResearchState, ResearchType } from "./research/index";
import {
  StrategyEngine,
  StrategyBuilder,
  StrategyValidator,
  StrategyState,
  StrategyType,
  CalendarStatus,
  ContentPriority,
  GrowthStage,
  StrategyRequest,
  StrategyResponse,
  StrategySnapshot,
  StrategyValidationException,
  StrategyException,
} from "./strategy/index";

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
  console.log("=== START SPRINT 12.2 CONTENT STRATEGY ENGINE TESTS ===");

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

  // Mock Research Response base
  const mockResearchResponseBase: any = {
    requestId: "req-research-test-1",
    state: ResearchState.COMPLETED,
    topics: [
      {
        id: "topic-webgpu",
        topic: "WebGPU TypeScript Development",
        category: "Technology",
        growthScore: 0.95,
        competitionScore: 0.25,
        trendScore: 0.88,
        monetizationScore: 0.9,
        audienceMatchScore: 0.85,
        confidenceScore: 0.92,
        finalScore: 0.91,
        tags: ["graphics", "ts"],
        metadata: { valid: true },
      },
      {
        id: "topic-generics",
        topic: "Advanced Generics in TS",
        category: "Technology",
        growthScore: 0.85,
        competitionScore: 0.3,
        trendScore: 0.8,
        monetizationScore: 0.85,
        audienceMatchScore: 0.8,
        confidenceScore: 0.9,
        finalScore: 0.82,
        tags: ["ts", "advanced"],
        metadata: { valid: true },
      },
    ],
    opportunities: [
      {
        id: "opp-webgpu",
        topic: "WebGPU TypeScript Development",
        score: 0.92,
        type: "CONTENT_GAP" as any,
        demand: 0.95,
        competition: 0.25,
        rpmPotential: 0.9,
        contentGapDescription: "Missing guides.",
      },
    ],
    reports: [],
    timestamp: new Date(),
  };

  let mockIdCounter = 0;
  function getMockResearchResponse() {
    mockIdCounter++;
    return {
      ...mockResearchResponseBase,
      requestId: `req-research-test-${mockIdCounter}`,
    };
  }

  const engine = new StrategyBuilder()
    .withContext(platformContext)
    .withMetadata({ version: "1.0.0" })
    .build();

  // Register StrategyEngine and ResearchEngine in registry
  const token = { name: "IStrategyEngine" } as any;
  registry.register(token, engine);

  const researchEngine = new ResearchBuilder().withContext(platformContext).build();
  registry.register({ name: "IResearchEngine" } as any, researchEngine);

  // Cross-reference context strategyEngine and researchEngine
  Object.assign(platformContext, {
    strategyEngine: engine,
    researchEngine: researchEngine,
  });

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("\n1. Verifying Builder Validation...");
  {
    try {
      new StrategyBuilder().build();
      throw new Error("Should not build without context");
    } catch (e: any) {
      assert(e.message.includes("Context is required"), "Throws correct error for missing context");
    }

    const testEngine = new StrategyBuilder().withContext(platformContext).build();
    assert(testEngine instanceof StrategyEngine, "Succeeds with context");
    console.log("   ✓ Builder validation verified.");
  }

  // ==================================================
  // 2. Lifecycle Transitions
  // ==================================================
  console.log("\n2. Verifying Lifecycle Transitions...");
  {
    assert(engine.state === StrategyState.CREATED, "Starts in CREATED state");

    try {
      await engine.start();
      throw new Error("Should fail starting before initialize");
    } catch (e: any) {
      assert(e instanceof Error, "Fails transition directly from CREATED to RUNNING");
    }

    await engine.initialize();
    assert(engine.state === StrategyState.INITIALIZED, "State becomes INITIALIZED");

    await engine.start();
    assert(engine.state === StrategyState.RUNNING, "State becomes RUNNING");

    await engine.stop();
    assert(engine.state === StrategyState.STOPPED, "State becomes STOPPED");

    await engine.start();
    assert(engine.state === StrategyState.RUNNING, "State restored to RUNNING");
    console.log("   ✓ Lifecycle transitions verified.");
  }

  // ==================================================
  // 3. Content Pillar Generation
  // ==================================================
  console.log("\n3. Verifying Content Pillar Generation...");
  {
    const req: StrategyRequest = {
      id: "req-pillars",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.pillars.length === 2, "Generated exactly 2 content pillars");
    assert(res.pillars[0].name === "TypeScript Architecture", "Generated primary pillar");
    assert(res.pillars[0].supportingTopics.includes("WebGPU TypeScript Development"), "Associated supporting topics");
    console.log("   ✓ Content pillar generation verified.");
  }

  // ==================================================
  // 4. Content Series Planning
  // ==================================================
  console.log("\n4. Verifying Content Series Planning...");
  {
    const req: StrategyRequest = {
      id: "req-series",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.series.length > 0, "Generated content series");
    assert(res.series[0].name === "Advanced TypeScript Demystified", "Named series correctly");
    assert(res.series[0].episodes.length === 3, "Sequenced series episodes");
    assert(res.series[0].continuationOpportunity.length > 0, "Provided continuation opportunities");
    console.log("   ✓ Content series planning verified.");
  }

  // ==================================================
  // 5. Upload Schedule Generation
  // ==================================================
  console.log("\n5. Verifying Upload Schedule Generation...");
  {
    const req: StrategyRequest = {
      id: "req-schedule",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.schedule.frequency === "WEEKLY", "Scheduled weekly uploads");
    assert(res.schedule.bestPublishTimes.includes("Thursday 3PM EST"), "Discovered best publish times");
    console.log("   ✓ Upload schedule generation verified.");
  }

  // ==================================================
  // 6. Content Calendar Generation
  // ==================================================
  console.log("\n6. Verifying Content Calendar Generation...");
  {
    const req: StrategyRequest = {
      id: "req-calendar",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.calendar.entries.length === 2, "Calendar entries populated");
    assert(res.calendar.entries[0].id === "cal-1", "Has publish date and entry details");
    assert(res.calendar.entries[1].dependencies.includes("cal-1"), "Maintained dependency structure");
    console.log("   ✓ Content calendar generation verified.");
  }

  // ==================================================
  // 7. Priority Calculation
  // ==================================================
  console.log("\n7. Verifying Priority Calculation...");
  {
    const req: StrategyRequest = {
      id: "req-priority",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.priorities.length === 2, "Ranked strategy priorities");
    assert(res.priorities[0].score > res.priorities[1].score, "Highest final score ranks first");
    console.log("   ✓ Priority calculation verified.");
  }

  // ==================================================
  // 8. Growth Strategy Generation
  // ==================================================
  console.log("\n8. Verifying Growth Strategy Generation...");
  {
    const req: StrategyRequest = {
      id: "req-growth",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.growth.stage === GrowthStage.LAUNCH, "Identified growth stage");
    assert(res.growth.shortTermRoadmap.length > 0, "Created short-term roadmap");
    assert(res.growth.longTermRoadmap.length > 0, "Created long-term scaling path");
    console.log("   ✓ Growth strategy generation verified.");
  }

  // ==================================================
  // 9. Strategy Optimization
  // ==================================================
  console.log("\n9. Verifying Strategy Optimization...");
  {
    // Seed winning pillar in memory
    await memoryStore.set("strategy-memory", "winning-pillars", ["TypeScript Architecture"]);

    const req: StrategyRequest = {
      id: "req-opt-test",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    // Optimization stage should read winning pillars and boost/adjust roadmap
    assert(
      res.growth.shortTermRoadmap.some((r) => r.includes("Optimize series based on historically winning pillar")),
      "Successfully adjusted roadmap based on historical winnings feedback loop"
    );
    console.log("   ✓ Strategy optimization verified.");
  }

  // ==================================================
  // 10. Strategy Reports
  // ==================================================
  console.log("\n10. Verifying Strategy Reports...");
  {
    const req: StrategyRequest = {
      id: "req-reports-test",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.generate(req);
    assert(res.reports.length === 1, "Generated strategy report");
    assert(res.reports[0].roadmap.length > 0, "Contains roadmap summary");
    assert(res.reports[0].calendarSummary.includes("Scheduled"), "Contains calendar summary");
    console.log("   ✓ Strategy reports verified.");
  }

  // ==================================================
  // 11. Research Integration
  // ==================================================
  console.log("\n11. Verifying Research Integration...");
  {
    await researchEngine.initialize();
    await researchEngine.start();

    // Executing research request with generateStrategy option enabled
    const researchReq: any = {
      id: "req-res-integration-seed",
      type: "FULL" as any,
      channelProfile: { query: "TypeScript Research Integration" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
      options: { generateStrategy: true },
    };

    const resResponse = await researchEngine.execute(researchReq);

    // Verify StrategyEngine history has a linked entry created automatically
    const history = engine.getHistory();
    assert(
      history.some((h) => h.strategyId === "req-str-linked-req-res-integration-seed"),
      "Linked Strategy generated automatically when Research finished"
    );
    console.log("   ✓ Research integration verified.");
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
      strategyEngine: engine,
    };
    const planningEngine = new PlanningEngine(planningContext);
    await planningEngine.initialize();
    await planningEngine.start();

    const plan = await planningEngine.createPlan({
      id: "plan-with-strategy",
      goal: {
        id: "goal-strategy-1",
        description: "Organize strategic content upload calendar",
        priority: "HIGH" as any,
        type: "SIMPLE" as any,
        status: "PENDING" as any,
      },
    });

    assert(plan.tasks.length > 0, "Decomposed strategy plan into tasks");
    assert(
      plan.tasks.some((t) => t.name.includes("Plan Content:")),
      "Planning engine decomposed goal using strategy calendar entries"
    );
    console.log("   ✓ Planning integration verified.");
  }

  // ==================================================
  // 13. Memory Integration
  // ==================================================
  console.log("\n13. Verifying Memory Integration...");
  {
    const req: StrategyRequest = {
      id: "req-mem-seed",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    // Retrieve by queryKey which is mockResearchResponseBase.requestId (req-research-test-${mockIdCounter})
    const memEntry = await memoryStore.get<StrategyResponse>("strategy-memory", `strategy:req-research-test-${mockIdCounter}`);
    assert(memEntry !== undefined, "Saved strategy response into memory store namespace");
    assert(memEntry!.value.strategyId === "req-mem-seed", "Retrieved correct strategy from memory");
    console.log("   ✓ Memory integration verified.");
  }

  // ==================================================
  // 14. Decision Integration
  // ==================================================
  console.log("\n14. Verifying Decision Integration...");
  {
    const decisionContext = {
      logger,
      config,
      registry,
      eventBus,
      memoryStore,
      strategyEngine: engine,
    };
    const decisionEngine = new DecisionEngine(decisionContext);

    // Pre-populate history with calendar entry topic: "WebGPU TypeScript Development"
    const req: StrategyRequest = {
      id: "req-dec-opt-seed",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    // One option matches "WebGPU TypeScript Development" (priority: CRITICAL in mock)
    const decision = new DecisionBuilder()
      .withId("dec-strategy-boost")
      .withPriority("HIGH" as any)
      .withContext(decisionContext)
      .addOption({
        id: "WebGPU TypeScript Development",
        name: "WebGPU TypeScript Development",
        description: "D",
        cost: 1,
        reward: 5,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5 },
      })
      .addOption({
        id: "Neutral Topic",
        name: "Neutral Topic",
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
      evaluated.selectedOptionId === "WebGPU TypeScript Development",
      "Decision engine successfully boosted option based on Strategy Engine critical priority"
    );
    console.log("   ✓ Decision integration verified.");
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
      strategyEngine: engine,
    };

    class DummyLifecycle {
      public async initialize(): Promise<void> {}
      public async execute(context: any, input?: any): Promise<any> {
        return input;
      }
      public async shutdown(): Promise<void> {}
    }

    const agent = new AgentBuilder()
      .withId("agent-strategist")
      .withName("Strategy Agent")
      .withRole("Strategist" as any)
      .withDescription("Test agent with strategy capability")
      .withVersion("1.0.0")
      .withCapabilities(["strategy" as any])
      .withContext(agentContext)
      .withLifecycle(new DummyLifecycle())
      .build();

    await agent.initialize();

    const req: StrategyRequest = {
      id: "req-agent-strategy-task",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };

    const result = (await agent.execute(req)) as StrategyResponse;
    assert(result.strategyId === "req-agent-strategy-task", "Agent executed strategy generate directly");
    assert(result.calendar.entries.length > 0, "Agent returned strategy response with calendar entries");
    console.log("   ✓ Agent integration verified.");
  }

  // ==================================================
  // 16. Event Publishing
  // ==================================================
  console.log("\n16. Verifying Event Publishing...");
  {
    let startedFired = false;
    let completedFired = false;

    eventBus.subscribe("StrategyStarted", async () => {
      startedFired = true;
    });

    eventBus.subscribe("StrategyCompleted", async () => {
      completedFired = true;
    });

    const req: StrategyRequest = {
      id: "req-events-strategy",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert(startedFired, "StrategyStarted event was published to EventBus");
    assert(completedFired, "StrategyCompleted event was published to EventBus");
    console.log("   ✓ Event publishing verified.");
  }

  // ==================================================
  // 17. Snapshot Immutability
  // ==================================================
  console.log("\n17. Verifying Snapshot Immutability...");
  {
    const req: StrategyRequest = {
      id: "req-snapshot-strategy",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };
    await engine.generate(req);

    const snapshot = engine.getSnapshot("req-snapshot-strategy");
    assert(snapshot !== undefined, "Snapshot retrieved");
    assert(Object.isFrozen(snapshot), "Snapshot is frozen");

    try {
      (snapshot as any).state = StrategyState.FAILED;
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
    // 18.1 Empty Strategy validation
    try {
      StrategyValidator.validateResponse({
        strategyId: "req-invalid",
        state: StrategyState.COMPLETED,
        pillars: [],
        series: [],
        schedule: { frequency: "DAILY", bestPublishTimes: [] },
        calendar: { entries: [] },
        growth: { stage: GrowthStage.LAUNCH, shortTermRoadmap: [], mediumTermRoadmap: [], longTermRoadmap: [] },
        priorities: [],
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate empty strategy response");
    } catch (e: any) {
      assert(e instanceof StrategyValidationException, "Throws StrategyValidationException on empty pillars");
    }

    // 18.2 Duplicate topic validation
    try {
      const baseDate = new Date();
      StrategyValidator.validateResponse({
        strategyId: "req-dup",
        state: StrategyState.COMPLETED,
        pillars: [{ id: "p-1", name: "Pillar", description: "D", supportingTopics: [], relationshipIds: [] }],
        series: [],
        schedule: { frequency: "DAILY", bestPublishTimes: [] },
        calendar: {
          entries: [
            { id: "cal-1", topic: "Topic A", publishDate: baseDate, priority: ContentPriority.HIGH, dependencies: [], status: CalendarStatus.DRAFT },
            { id: "cal-2", topic: "Topic A", publishDate: new Date(baseDate.getTime() + 1000), priority: ContentPriority.HIGH, dependencies: [], status: CalendarStatus.DRAFT },
          ],
        },
        growth: { stage: GrowthStage.LAUNCH, shortTermRoadmap: [], mediumTermRoadmap: [], longTermRoadmap: [] },
        priorities: [],
        reports: [],
        timestamp: new Date(),
      });
      throw new Error("Should not validate duplicate topics in calendar");
    } catch (e: any) {
      assert(e instanceof StrategyValidationException, "Throws StrategyValidationException on duplicate topics");
    }

    // 18.3 Circular dependencies validation
    try {
      StrategyValidator.validateDependencies([
        { id: "cal-1", topic: "Topic A", publishDate: new Date(), priority: ContentPriority.HIGH, dependencies: ["cal-2"], status: CalendarStatus.DRAFT },
        { id: "cal-2", topic: "Topic B", publishDate: new Date(), priority: ContentPriority.HIGH, dependencies: ["cal-1"], status: CalendarStatus.DRAFT },
      ]);
      throw new Error("Should not validate circular dependencies");
    } catch (e: any) {
      assert(e instanceof StrategyValidationException, "Throws StrategyValidationException on circular dependency loop");
    }
    console.log("   ✓ Validator rules verified.");
  }

  // ==================================================
  // 19. Regression Tests
  // ==================================================
  console.log("\n19. Verifying Regression Tests...");
  {
    // Empty request ID
    try {
      const req: StrategyRequest = {
        id: "",
        type: StrategyType.FULL,
        researchResponse: getMockResearchResponse(),
        state: StrategyState.CREATED,
        timestamp: new Date(),
      };
      await engine.generate(req);
      throw new Error("Should fail on empty request ID");
    } catch (e: any) {
      assert(e instanceof StrategyValidationException, "Fails request validation on empty ID");
    }
    console.log("   ✓ Regression tests verified.");
  }

  // ==================================================
  // 20. Full End-to-End Strategy Generation
  // ==================================================
  console.log("\n20. Verifying Full End-to-End Strategy Generation...");
  {
    const req: StrategyRequest = {
      id: "req-e2e-strategy-final",
      type: StrategyType.FULL,
      researchResponse: getMockResearchResponse(),
      state: StrategyState.CREATED,
      timestamp: new Date(),
    };

    const res = await engine.generate(req);
    assert(res.state === StrategyState.COMPLETED, "Response state is COMPLETED");
    assert(res.pillars.length === 2, "Returns pillars");
    assert(res.series.length === 1, "Returns series");
    assert(res.calendar.entries.length === 2, "Returns calendar entries");
    assert(res.reports.length === 1, "Includes report");
    console.log("   ✓ Full end-to-end strategy generation verified.");
  }

  console.log("\n=== ALL 20/20 CONTENT STRATEGY ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
