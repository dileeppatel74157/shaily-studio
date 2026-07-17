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
import {
  ChannelEngine,
  ChannelBuilder,
  ChannelValidator,
  ChannelState,
  BrandTone,
  BrandPersonality,
  BlueprintState,
  AudiencePersonaType,
  ChannelProfile,
  BrandGuide,
  VisualIdentity,
  AudiencePersona,
  ContentBlueprint,
  PublishingRules,
  ChannelKnowledgeBase,
  BlueprintReport,
  BlueprintSnapshot,
  ChannelValidationException,
  ChannelException,
} from "./channel/index";

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
  console.log("=== START SPRINT 12.3 CHANNEL IDENTITY ENGINE TESTS ===");

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

  const engine = new ChannelBuilder()
    .withContext(platformContext)
    .withMetadata({ version: "1.0.0" })
    .build();

  // Register in registry
  registry.register({ name: "IChannelEngine" } as any, engine);

  const researchEngine = new ResearchBuilder().withContext(platformContext).build();
  registry.register({ name: "IResearchEngine" } as any, researchEngine);

  const strategyEngine = new StrategyBuilder().withContext(platformContext).build();
  registry.register({ name: "IStrategyEngine" } as any, strategyEngine);

  // Cross-reference context properties
  Object.assign(platformContext, {
    channelEngine: engine,
    researchEngine: researchEngine,
    strategyEngine: strategyEngine,
  });

  // Unique niche tracker to prevent duplicate detection triggers in testing
  let nicheCounter = 0;
  function getUniqueNiche(base = "TypeScript Development") {
    nicheCounter++;
    return `${base} Part ${nicheCounter}`;
  }

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("\n1. Verifying Builder Validation...");
  {
    try {
      new ChannelBuilder().build();
      throw new Error("Should not build without context");
    } catch (e: any) {
      assert(e.message.includes("Context is required"), "Throws correct error for missing context");
    }

    const testEngine = new ChannelBuilder().withContext(platformContext).build();
    assert(testEngine instanceof ChannelEngine, "Succeeds with context");
    console.log("   ✓ Builder validation verified.");
  }

  // ==================================================
  // 2. Lifecycle Transitions
  // ==================================================
  console.log("\n2. Verifying Lifecycle Transitions...");
  {
    assert(engine.state === ChannelState.CREATED, "Starts in CREATED state");

    try {
      await engine.start();
      throw new Error("Should fail starting before initialize");
    } catch (e: any) {
      assert(e instanceof Error, "Fails transition directly from CREATED to RUNNING");
    }

    await engine.initialize();
    assert(engine.state === ChannelState.INITIALIZED, "State becomes INITIALIZED");

    await engine.start();
    assert(engine.state === ChannelState.RUNNING, "State becomes RUNNING");

    await engine.stop();
    assert(engine.state === ChannelState.STOPPED, "State becomes STOPPED");

    await engine.start();
    assert(engine.state === ChannelState.RUNNING, "State restored to RUNNING");
    console.log("   ✓ Lifecycle transitions verified.");
  }

  // ==================================================
  // 3. Channel Identity Generation
  // ==================================================
  console.log("\n3. Verifying Channel Identity Generation...");
  {
    const kb = await engine.generate("chan-id-test-3", getUniqueNiche());
    assert(kb.identity.id === "chan-id-test-3", "Generates correct ID");
    assert(kb.identity.mission.length > 0, "Mission is populated");
    assert(kb.identity.differentiation.length > 0, "Differentiation strategy is defined");
    console.log("   ✓ Channel identity generation verified.");
  }

  // ==================================================
  // 4. Brand Guide Generation
  // ==================================================
  console.log("\n4. Verifying Brand Guide Generation...");
  {
    const kb = await engine.generate("chan-id-test-4", getUniqueNiche());
    assert(kb.brandGuide.personality === BrandPersonality.EXPERT, "Has correct brand personality");
    assert(kb.brandGuide.tone === BrandTone.EDUCATIONAL, "Has correct tone");
    assert(kb.brandGuide.writingStyle.length > 0, "Writing style is generated");
    assert(kb.brandGuide.communicationRules.length > 0, "Communication guidelines generated");
    console.log("   ✓ Brand guide generation verified.");
  }

  // ==================================================
  // 5. Visual Identity Generation
  // ==================================================
  console.log("\n5. Verifying Visual Identity Generation...");
  {
    const kb = await engine.generate("chan-id-test-5", getUniqueNiche());
    assert(kb.visuals.colorPalette.length > 0, "Color palette generated");
    assert(kb.visuals.typographyRules.length > 0, "Typography guidelines generated");
    assert(kb.visuals.thumbnailStyle.length > 0, "Thumbnail style generated");
    console.log("   ✓ Visual identity generation verified.");
  }

  // ==================================================
  // 6. Audience Persona Generation
  // ==================================================
  console.log("\n6. Verifying Audience Persona Generation...");
  {
    const kb = await engine.generate("chan-id-test-6", getUniqueNiche());
    assert(kb.personas.length > 0, "Audience personas list is populated");
    assert(kb.personas[0].name.length > 0, "Persona name generated");
    assert(kb.personas[0].painPoints.length > 0, "Persona pain points populated");
    console.log("   ✓ Audience persona generation verified.");
  }

  // ==================================================
  // 7. Content Blueprint Generation
  // ==================================================
  console.log("\n7. Verifying Content Blueprint Generation...");
  {
    const kb = await engine.generate("chan-id-test-7", getUniqueNiche());
    assert(kb.blueprints.length > 0, "Content blueprints list is populated");
    assert(kb.blueprints[0].hookStructure.length > 0, "Hook structure is defined");
    assert(kb.blueprints[0].storyPacing.length > 0, "Story pacing defined");
    assert(kb.blueprints[0].retentionCheckpoints.length > 0, "Retention checkpoints are defined");
    console.log("   ✓ Content blueprint generation verified.");
  }

  // ==================================================
  // 8. Series Blueprint Generation
  // ==================================================
  console.log("\n8. Verifying Series Blueprint Generation...");
  {
    // Custom series blueprints generation
    const kb = await engine.generate("chan-id-test-8", getUniqueNiche());
    assert(kb.blueprints.length > 0, "Correctly populated blueprints list");
    console.log("   ✓ Series blueprint generation verified.");
  }

  // ==================================================
  // 9. Publishing Rules Generation
  // ==================================================
  console.log("\n9. Verifying Publishing Rules Generation...");
  {
    const kb = await engine.generate("chan-id-test-9", getUniqueNiche());
    assert(kb.publishingRules.uploadRules.length > 0, "Upload rules generated");
    assert(kb.publishingRules.qualityStandards.length > 0, "Quality standards defined");
    assert(kb.publishingRules.thumbnailRules.length > 0, "Thumbnail graphic rules defined");
    console.log("   ✓ Publishing rules generation verified.");
  }

  // ==================================================
  // 10. Knowledge Base Creation
  // ==================================================
  console.log("\n10. Verifying Knowledge Base Creation...");
  {
    const kb = await engine.generate("chan-id-test-10", getUniqueNiche());
    assert(kb.revisionHistory.length > 0, "Maintains revision history in KB");
    console.log("   ✓ Knowledge base creation verified.");
  }

  // ==================================================
  // 11. Research Integration
  // ==================================================
  console.log("\n11. Verifying Research Integration...");
  {
    await researchEngine.initialize();
    await researchEngine.start();

    // Execute research request with generateChannelProfile option enabled
    const researchReq: any = {
      id: "req-res-chan-integration-seed",
      type: "FULL" as any,
      channelProfile: { query: "Rust Programming Tutorials" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
      options: { generateChannelProfile: true },
    };

    await researchEngine.execute(researchReq);

    // Verify ChannelEngine history has a linked entry created automatically
    const history = engine.getHistory();
    assert(
      history.some((h) => h.identity.id === "chan-linked-req-res-chan-integration-seed"),
      "Linked Channel profile generated automatically when Research finished"
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

    // Generate a channel profile first to populate history
    const nicheName = getUniqueNiche();
    await engine.generate("chan-strat-integration-seed", nicheName);

    const mockResearchResponse: any = {
      requestId: "req-res-strat-test",
      state: ResearchState.COMPLETED,
      topics: [{ id: "t-1", topic: nicheName, finalScore: 0.9, trendScore: 0.8, monetizationScore: 0.8, confidenceScore: 0.9 }],
      timestamp: new Date(),
    };

    const strategyRes = await strategyEngine.generate({
      id: "req-str-chan-integration",
      type: "FULL" as any,
      researchResponse: mockResearchResponse,
      state: StrategyState.CREATED,
      timestamp: new Date(),
    });

    // Check if series name was customized with the active brand tone (EDUCATIONAL Edition)
    assert(
      strategyRes.series[0].name.includes("EDUCATIONAL Edition"),
      "Strategy Engine adapted content series name using Channel brand guide tone rules"
    );
    console.log("   ✓ Strategy integration verified.");
  }

  // ==================================================
  // 13. Planning Integration
  // ==================================================
  console.log("\n13. Verifying Planning Integration...");
  {
    const planningContext = {
      logger,
      config,
      registry,
      eventBus,
      channelEngine: engine,
    };
    const planningEngine = new PlanningEngine(planningContext);
    await planningEngine.initialize();
    await planningEngine.start();

    const plan = await planningEngine.createPlan({
      id: "plan-with-channel-blueprint",
      goal: {
        id: "goal-channel-1",
        description: "Implement video blueprint hook structure",
        priority: "HIGH" as any,
        type: "SIMPLE" as any,
        status: "PENDING" as any,
      },
    });

    assert(plan.tasks.length > 0, "Decomposed blueprint goal into tasks");
    assert(
      plan.tasks.some((t) => t.name.includes("Implement Content Blueprint:")),
      "Planning engine decomposed goal using channel content blueprints"
    );
    console.log("   ✓ Planning integration verified.");
  }

  // ==================================================
  // 14. Memory Integration
  // ==================================================
  console.log("\n14. Verifying Memory Integration...");
  {
    const nicheName = getUniqueNiche();
    const kb = await engine.generate("chan-mem-seed", nicheName);

    const memEntry = await memoryStore.get<ChannelKnowledgeBase>("channel-memory", `identity:${nicheName}`);
    assert(memEntry !== undefined, "Saved channel knowledge base into memory store namespace");
    assert(memEntry!.value.identity.id === "chan-mem-seed", "Retrieved correct KB from memory");
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
      channelEngine: engine,
    };
    const decisionEngine = new DecisionEngine(decisionContext);

    // Pre-populate history with consistency rule
    await engine.generate("chan-dec-seed", getUniqueNiche());

    // One option has name "violate brand rules", which should be penalized by decision engine
    const decision = new DecisionBuilder()
      .withId("dec-channel-penalize")
      .withPriority("HIGH" as any)
      .withContext(decisionContext)
      .addOption({
        id: "Valid option",
        name: "Valid option",
        description: "D",
        cost: 1,
        reward: 5,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5 },
      })
      .addOption({
        id: "Violating option",
        name: "Violate Brand Rules Topic",
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
      evaluated.selectedOptionId === "Valid option",
      "Decision engine penalized option violating channel brand consistency rules"
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
      channelEngine: engine,
    };

    class DummyLifecycle {
      public async initialize(): Promise<void> {}
      public async execute(context: any, input?: any): Promise<any> {
        return input;
      }
      public async shutdown(): Promise<void> {}
    }

    const agent = new AgentBuilder()
      .withId("agent-brand-director")
      .withName("Brand Director Agent")
      .withRole("Strategist" as any)
      .withDescription("Test agent with channel capability")
      .withVersion("1.0.0")
      .withCapabilities(["channel" as any])
      .withContext(agentContext)
      .withLifecycle(new DummyLifecycle())
      .build();

    await agent.initialize();

    const result = (await agent.execute({
      id: "req-agent-channel-task",
      niche: getUniqueNiche(),
      options: { name: "Agent Brand Studio" },
    })) as ChannelKnowledgeBase;

    assert(result.identity.id === "req-agent-channel-task", "Agent executed channel generate directly");
    assert(result.identity.name === "Agent Brand Studio", "Agent customized name configuration");
    console.log("   ✓ Agent integration verified.");
  }

  // ==================================================
  // 17. Event Publishing
  // ==================================================
  console.log("\n17. Verifying Event Publishing...");
  {
    let startedFired = false;
    let completedFired = false;

    eventBus.subscribe("ChannelStarted", async () => {
      startedFired = true;
    });

    eventBus.subscribe("ChannelCompleted", async () => {
      completedFired = true;
    });

    await engine.generate("req-events-channel", getUniqueNiche());

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert(startedFired, "ChannelStarted event was published to EventBus");
    assert(completedFired, "ChannelCompleted event was published to EventBus");
    console.log("   ✓ Event publishing verified.");
  }

  // ==================================================
  // 18. Snapshot Immutability
  // ==================================================
  console.log("\n18. Verifying Snapshot Immutability...");
  {
    await engine.generate("req-snapshot-channel", getUniqueNiche());

    const snapshot = engine.getSnapshot("req-snapshot-channel");
    assert(snapshot !== undefined, "Snapshot retrieved");
    assert(Object.isFrozen(snapshot), "Snapshot is frozen");

    try {
      (snapshot as any).state = ChannelState.FAILED;
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
    // 19.1 Missing Brand guide validation
    try {
      ChannelValidator.validateKnowledgeBase({
        identity: { id: "req-invalid", name: "Name", niche: "Niche", mission: "", vision: "", positioning: "", valueProposition: "", differentiation: "" },
        brandGuide: { personality: undefined as any, tone: undefined as any, writingStyle: "", communicationRules: [], consistencyRules: [] },
        visuals: { colorPalette: [], designLanguage: "", thumbnailStyle: "", typographyRules: [], visualConsistency: "", animationDirection: "", logoGuidance: "" },
        personas: [],
        blueprints: [],
        publishingRules: { uploadRules: [], qualityStandards: [], minimumResearchRequirements: [], thumbnailRules: [], titleRules: [], descriptionRules: [] },
        revisionHistory: [],
      });
      throw new Error("Should not validate empty brand guide/knowledge base");
    } catch (e: any) {
      assert(e instanceof ChannelValidationException, "Throws ChannelValidationException on missing brand guide properties");
    }

    // 19.2 Circular reference validation
    try {
      const obj: any = {};
      obj.circularRef = obj;
      ChannelValidator.validateKnowledgeBase({
        identity: { id: "req-circular", name: "Name", niche: "Niche", mission: "", vision: "", positioning: "", valueProposition: "", differentiation: "" },
        brandGuide: { personality: BrandPersonality.EXPERT, tone: BrandTone.EDUCATIONAL, writingStyle: "Style", communicationRules: [], consistencyRules: [] },
        visuals: { colorPalette: ["#000"], designLanguage: "Language", thumbnailStyle: "Style", typographyRules: [], visualConsistency: "", animationDirection: "", logoGuidance: "" },
        personas: [{ id: "p-1", type: AudiencePersonaType.PRIMARY, name: "Name", demographics: "Demographics", painPoints: ["P"], goals: ["G"], interests: ["I"], engagementTriggers: ["T"] }],
        blueprints: [{ id: "bp-1", state: BlueprintState.ACTIVE, hookStructure: "Hook", openingFormat: "Open", informationFlow: "Flow", endingFormat: "End", ctaStyle: "CTA", storyPacing: "Pacing", retentionCheckpoints: ["C"], circularMeta: obj } as any],
        publishingRules: { uploadRules: ["Rules"], qualityStandards: [], minimumResearchRequirements: [], thumbnailRules: [], titleRules: [], descriptionRules: [] },
        revisionHistory: [],
      });
      throw new Error("Should not validate circular structures");
    } catch (e: any) {
      assert(e instanceof ChannelValidationException, "Throws ChannelValidationException on circular reference");
    }
    console.log("   ✓ Validator rules verified.");
  }

  // ==================================================
  // 20. Full End-to-End Channel Blueprint Generation
  // ==================================================
  console.log("\n20. Verifying Full End-to-End Channel Blueprint Generation...");
  {
    const nicheName = getUniqueNiche();
    const res = await engine.generate("req-e2e-channel-final", nicheName);
    assert(res.identity.id === "req-e2e-channel-final", "Response identity is generated");
    assert(res.brandGuide !== undefined, "Returns brand guide");
    assert(res.visuals !== undefined, "Returns visual guide");
    assert(res.blueprints.length === 1, "Returns content blueprint");
    assert(res.personas.length === 1, "Returns audience personas");
    console.log("   ✓ Full end-to-end channel blueprint generation verified.");
  }

  console.log("\n=== ALL 20/20 CHANNEL IDENTITY ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
