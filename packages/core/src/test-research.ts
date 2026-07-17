import { LoggerBuilder, JsonFormatter } from "./logger/index";
import { EventBus } from "./events/index";
import { ConfigBuilder, MemorySource } from "./config/index";
import { MemoryStore } from "./memory/index";
import { ServiceRegistry } from "./registry/index";
import { AgentBuilder } from "./agents/index";
import { PlanningEngine } from "./planning/index";
import { DecisionEngine, DecisionBuilder, DecisionRisk } from "./decision/index";
import { JobEngine } from "./jobs/JobEngine";
import {
  ResearchEngine,
  ResearchBuilder,
  ResearchValidator,
  ResearchState,
  ResearchType,
  ResearchRequest,
  ResearchResponse,
  ResearchSnapshot,
  TrendType,
  OpportunityType,
  KeywordType,
  AudienceType,
  ResearchValidationException,
  ResearchException,
} from "./research/index";

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
  console.log("=== START SPRINT 12.1 RESEARCH INTELLIGENCE ENGINE TESTS ===");

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

  const trendProvider = {
    discoverTrends: async (profile: any) => ({
      trendingTopics: [
        { topic: "WebGPU TypeScript Development", growthScore: 0.9, competitionScore: 0.25, trendScore: 0.88, type: TrendType.TRENDING },
      ],
      risingTopics: [
        { topic: "Advanced Generics in TS", growthScore: 0.78, competitionScore: 0.3, trendScore: 0.8, type: TrendType.RISING },
      ],
      evergreenTopics: [
        { topic: "TypeScript Build Optimizations", growthScore: 0.65, competitionScore: 0.4, trendScore: 0.7, type: TrendType.EVERGREEN },
      ],
      seasonalOpportunities: [
        { topic: "TypeScript in 2027 Preview", growthScore: 0.7, competitionScore: 0.2, trendScore: 0.75, type: TrendType.SEASONAL },
      ],
    }),
  };

  const competitorAnalyzer = {
    analyzeCompetitors: async (profile: any) => [
      {
        competitorName: "TechMaster TS",
        uploadFrequency: "Weekly",
        videoStyle: ["Coding Walkthroughs", "Deep Dives"],
        averageViews: 150000,
        averageEngagement: 0.09,
        thumbnailPatterns: ["Clean code screenshot", "Bold typography"],
        titlePatterns: ["Understand X in 10 minutes", "Advanced Y Tips"],
        publishingTime: ["Wednesday 2PM EST"],
      },
    ],
  };

  const opportunityFinder = {
    findOpportunities: async (trends: any, competitors: any) => [
      {
        id: "opp-webgpu",
        topic: "WebGPU TypeScript Development",
        score: 0.92,
        type: OpportunityType.CONTENT_GAP,
        demand: 0.95,
        competition: 0.25,
        rpmPotential: 0.88,
        contentGapDescription: "High growth search queries but very few high quality video tutorials.",
      },
      {
        id: "opp-generics",
        topic: "Advanced Generics in TS",
        score: 0.82,
        type: OpportunityType.LOW_COMPETITION,
        demand: 0.8,
        competition: 0.3,
        rpmPotential: 0.75,
        contentGapDescription: "Medium competition but high monetization potential.",
      },
    ],
  };

  const keywordAnalyzer = {
    analyzeKeywords: async (topics: string[]) => [
      {
        primaryKeywords: ["webgpu tutorial", "typescript webgpu"],
        secondaryKeywords: ["advanced webgpu programming"],
        longTailKeywords: ["how to use webgpu with advanced typescript generic helpers"],
        searchIntent: "informational",
        difficultyScore: 0.25,
        keywordType: KeywordType.PRIMARY,
      },
    ],
  };

  const audienceAnalyzer = {
    analyzeAudience: async (profile: any) => ({
      interests: ["TypeScript", "WebGPU", "High Performance Web Development"],
      painPoints: ["Lack of clear documentation", "Complex generic type errors"],
      commonQuestions: ["How do I initialize WebGPU with TypeScript?"],
      viewingBehavior: "Prefers detailed code-along tutorials",
      preferredContentLength: "15-20 minutes",
      audienceType: AudienceType.CORE,
    }),
  };

  const engine = new ResearchBuilder()
    .withContext(platformContext)
    .withTrendProvider(trendProvider)
    .withCompetitorAnalyzer(competitorAnalyzer)
    .withOpportunityFinder(opportunityFinder)
    .withKeywordAnalyzer(keywordAnalyzer)
    .withAudienceAnalyzer(audienceAnalyzer)
    .withMetadata({ version: "1.0.0" })
    .build();

  // Register in ServiceRegistry
  const token = { name: "IResearchEngine" } as any;
  registry.register(token, engine);

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("\n1. Verifying Builder Validation...");
  {
    try {
      new ResearchBuilder().build();
      throw new Error("Should not build without context");
    } catch (e: any) {
      assert(e.message.includes("Context is required"), "Throws correct error for missing context");
    }

    const testEngine = new ResearchBuilder().withContext(platformContext).build();
    assert(testEngine instanceof ResearchEngine, "Succeeds with context");
    console.log("   ✓ Builder validation verified.");
  }

  // ==================================================
  // 2. Lifecycle Transitions
  // ==================================================
  console.log("\n2. Verifying Lifecycle Transitions...");
  {
    assert(engine.state === ResearchState.CREATED, "Starts in CREATED state");

    // Invalid transition before initialization
    try {
      await engine.start();
      throw new Error("Should not start before initializing");
    } catch (e: any) {
      assert(e instanceof Error, "Throws error for invalid start transition");
    }

    await engine.initialize();
    assert(engine.state === ResearchState.INITIALIZED, "State becomes INITIALIZED");

    await engine.start();
    assert(engine.state === ResearchState.RUNNING, "State becomes RUNNING");

    // Try to stop
    await engine.stop();
    assert(engine.state === ResearchState.STOPPED, "State becomes STOPPED");

    // Return to RUNNING
    await engine.start();
    assert(engine.state === ResearchState.RUNNING, "Restored to RUNNING");
    console.log("   ✓ Lifecycle transitions verified.");
  }

  // ==================================================
  // 3. Trend Discovery
  // ==================================================
  console.log("\n3. Verifying Trend Discovery...");
  {
    const req: ResearchRequest = {
      id: "req-trends",
      type: ResearchType.TRENDS,
      channelProfile: { query: "TypeScript Trends Test" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.execute(req);
    assert(res.trendAnalysis !== undefined, "Trend analysis is returned");
    assert(res.trendAnalysis!.trendingTopics.length > 0, "Discovered trending topics");
    assert(res.trendAnalysis!.risingTopics[0].topic.includes("Advanced Generics"), "Discovered rising topic");
    console.log("   ✓ Trend discovery verified.");
  }

  // ==================================================
  // 4. Competitor Analysis
  // ==================================================
  console.log("\n4. Verifying Competitor Analysis...");
  {
    const req: ResearchRequest = {
      id: "req-comps",
      type: ResearchType.COMPETITORS,
      channelProfile: { query: "TypeScript Competitors Test" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.execute(req);
    assert(res.competitorProfile !== undefined, "Competitor profiles returned");
    assert(res.competitorProfile![0].competitorName === "TechMaster TS", "Correct competitor analyzed");
    assert(res.competitorProfile![0].uploadFrequency === "Weekly", "Analyzed upload frequency");
    assert(res.competitorProfile![0].averageViews === 150000, "Analyzed average views");
    console.log("   ✓ Competitor analysis verified.");
  }

  // ==================================================
  // 5. Opportunity Discovery
  // ==================================================
  console.log("\n5. Verifying Opportunity Discovery...");
  {
    const req: ResearchRequest = {
      id: "req-opps",
      type: ResearchType.OPPORTUNITIES,
      channelProfile: { query: "TypeScript Opportunities Test" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.execute(req);
    assert(res.opportunities.length > 0, "Opportunities discovered");
    const opp = res.opportunities.find((o) => o.id === "opp-webgpu")!;
    assert(opp.score === 0.92, "Includes growth/opportunity score");
    assert(opp.type === OpportunityType.CONTENT_GAP, "Identifies correct opportunity type");
    assert(opp.competition === 0.25, "Identifies low competition");
    console.log("   ✓ Opportunity discovery verified.");
  }

  // ==================================================
  // 6. Keyword Analysis
  // ==================================================
  console.log("\n6. Verifying Keyword Analysis...");
  {
    const req: ResearchRequest = {
      id: "req-keywords",
      type: ResearchType.KEYWORDS,
      channelProfile: { query: "TypeScript Keywords Test" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.execute(req);
    assert(res.keywordAnalysis !== undefined, "Keyword analysis returned");
    assert(res.keywordAnalysis![0].primaryKeywords.includes("webgpu tutorial"), "Identified primary keywords");
    assert(res.keywordAnalysis![0].difficultyScore === 0.25, "Calculated difficulty score");
    console.log("   ✓ Keyword analysis verified.");
  }

  // ==================================================
  // 7. Audience Analysis
  // ==================================================
  console.log("\n7. Verifying Audience Analysis...");
  {
    const req: ResearchRequest = {
      id: "req-audience",
      type: ResearchType.AUDIENCE,
      channelProfile: { query: "TypeScript Audience Test" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.execute(req);
    assert(res.audienceInsight !== undefined, "Audience insight returned");
    assert(res.audienceInsight!.interests.includes("TypeScript"), "Identified audience interests");
    assert(res.audienceInsight!.painPoints.includes("Complex generic type errors"), "Identified pain points");
    console.log("   ✓ Audience analysis verified.");
  }

  // ==================================================
  // 8. Topic Clustering
  // ==================================================
  console.log("\n8. Verifying Topic Clustering...");
  {
    const req: ResearchRequest = {
      id: "req-clustering",
      type: ResearchType.FULL,
      channelProfile: { query: "TypeScript Clustering Test" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.execute(req);
    assert(res.topicClusters !== undefined, "Topic clusters generated");
    assert(res.topicClusters!.length > 0, "Identified at least one content cluster");
    assert(res.topicClusters![0].type === "Content Pillar", "Clustered into Content Pillar");
    console.log("   ✓ Topic clustering verified.");
  }

  // ==================================================
  // 9. Scoring Engine
  // ==================================================
  console.log("\n9. Verifying Scoring Engine...");
  {
    const req: ResearchRequest = {
      id: "req-scoring",
      type: ResearchType.FULL,
      channelProfile: { query: "TypeScript Scoring Test" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.execute(req);
    assert(res.topics.length > 0, "Topics scored and outputted");
    // Verify scores sorted descending
    for (let i = 0; i < res.topics.length - 1; i++) {
      assert(
        res.topics[i].finalScore >= res.topics[i + 1].finalScore,
        "Topics sorted in descending order of finalScore"
      );
    }
    // Verify scores are within range [0, 1]
    for (const topic of res.topics) {
      assert(topic.finalScore >= 0 && topic.finalScore <= 1, "Final score is inside [0, 1]");
      assert(topic.monetizationScore >= 0 && topic.monetizationScore <= 1, "Monetization score is inside [0, 1]");
    }
    console.log("   ✓ Scoring engine verified.");
  }

  // ==================================================
  // 10. Research Reports
  // ==================================================
  console.log("\n10. Verifying Research Reports...");
  {
    const req: ResearchRequest = {
      id: "req-reports",
      type: ResearchType.FULL,
      channelProfile: { query: "TypeScript Reports Test" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.execute(req);
    assert(res.reports.length > 0, "Immutable report generated");
    assert(res.reports[0].bestTopics.length > 0, "Reports best topics");
    assert(res.reports[0].recommendedNextActions.length > 0, "Provides next actions");
    console.log("   ✓ Research reports verified.");
  }

  // ==================================================
  // 11. Memory Integration
  // ==================================================
  console.log("\n11. Verifying Memory Integration...");
  {
    const req: ResearchRequest = {
      id: "req-memory-check",
      type: ResearchType.FULL,
      channelProfile: { query: "MemoryQuery" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    const res = await engine.execute(req);

    // Retrieve from MemoryStore
    const entry = await memoryStore.get<ResearchResponse>("research-memory", "research:MemoryQuery");
    assert(entry !== undefined, "Research output saved to memory store");
    assert(entry!.value.requestId === "req-memory-check", "Retrieved correct request payload from memory");
    console.log("   ✓ Memory integration verified.");
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
      researchEngine: engine,
    };
    const planningEngine = new PlanningEngine(planningContext);
    await planningEngine.initialize();
    await planningEngine.start();

    // Generate a plan that mentions "research" to trigger the ResearchEngine integration
    const plan = await planningEngine.createPlan({
      id: "plan-with-research",
      goal: {
        id: "goal-1",
        description: "Decompose a research-driven content strategy",
        priority: "HIGH" as any,
        type: "SIMPLE" as any,
        status: "PENDING" as any,
      },
    });

    assert(plan.tasks.length > 0, "Plan generated tasks");
    // Ensure tasks are data-driven opportunity topics from ResearchEngine
    assert(
      plan.tasks.some((t) => t.name.includes("Research Opportunity:")),
      "Planning engine queried ResearchEngine to build data-driven subtasks"
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
      researchEngine: engine,
    };
    const decisionEngine = new DecisionEngine(decisionContext);

    // Evaluate options. One option matches the high-scoring research topic name exactly.
    const decision = new DecisionBuilder()
      .withId("dec-research-boost")
      .withPriority("HIGH" as any)
      .withContext(decisionContext)
      .addOption({
        id: "WebGPU TypeScript Development",
        name: "WebGPU TypeScript Development",
        description: "Focus on WebGPU tutorial series",
        cost: 1,
        reward: 5,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5 },
      })
      .addOption({
        id: "Neutral Topic",
        name: "Neutral Topic",
        description: "Focus on unrelated framework tutorial",
        cost: 1,
        reward: 5,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5 },
      })
      .addCriteria({ name: "alignment", weight: 1.0 })
      .build();

    const evaluated = await decisionEngine.evaluate(decision);
    // Since "WebGPU TypeScript Development" is boosted by research scores, it should be selected.
    assert(
      evaluated.selectedOptionId === "WebGPU TypeScript Development",
      "Decision engine successfully boosted option based on Research Engine scores"
    );
    console.log("   ✓ Decision integration verified.");
  }

  // ==================================================
  // 14. Agent Integration
  // ==================================================
  console.log("\n14. Verifying Agent Integration...");
  {
    const agentContext = {
      logger,
      config,
      registry,
      eventBus,
      memoryStore,
      jobEngine: new JobEngine(logger, eventBus),
      researchEngine: engine,
    };

    class DummyLifecycle {
      public async initialize(): Promise<void> {}
      public async execute(context: any, input?: any): Promise<any> {
        return input;
      }
      public async shutdown(): Promise<void> {}
    }

    const agent = new AgentBuilder()
      .withId("agent-researcher")
      .withName("Research Agent")
      .withRole("Researcher" as any)
      .withDescription("Test agent with research capability")
      .withVersion("1.0.0")
      .withCapabilities(["research" as any])
      .withContext(agentContext)
      .withLifecycle(new DummyLifecycle())
      .build();

    await agent.initialize();

    const req: ResearchRequest = {
      id: "req-agent-task",
      type: ResearchType.FULL,
      channelProfile: { query: "Agent Task Query" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };

    const result = (await agent.execute(req)) as ResearchResponse;
    assert(result.requestId === "req-agent-task", "Agent executed research request directly");
    assert(result.topics.length > 0, "Agent returned research response with topics");
    console.log("   ✓ Agent integration verified.");
  }

  // ==================================================
  // 15. Event Publishing
  // ==================================================
  console.log("\n15. Verifying Event Publishing...");
  {
    let startedFired = false;
    let completedFired = false;

    eventBus.subscribe("ResearchStarted", async (evt) => {
      startedFired = true;
    });

    eventBus.subscribe("ResearchCompleted", async (evt) => {
      completedFired = true;
    });

    const req: ResearchRequest = {
      id: "req-events-pub",
      type: ResearchType.FULL,
      channelProfile: { query: "EventsPubQuery" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    await engine.execute(req);

    // Wait a brief tick for async subscribers
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert(startedFired, "ResearchStarted event was published to EventBus");
    assert(completedFired, "ResearchCompleted event was published to EventBus");
    console.log("   ✓ Event publishing verified.");
  }

  // ==================================================
  // 16. Snapshot Immutability
  // ==================================================
  console.log("\n16. Verifying Snapshot Immutability...");
  {
    const req: ResearchRequest = {
      id: "req-snapshot-immutable",
      type: ResearchType.FULL,
      channelProfile: { query: "SnapshotQuery" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    await engine.execute(req);

    const snapshot = engine.getSnapshot("req-snapshot-immutable");
    assert(snapshot !== undefined, "Snapshot retrieved");
    assert(Object.isFrozen(snapshot), "Snapshot is frozen");

    // Test immutability
    try {
      (snapshot as any).state = ResearchState.FAILED;
      throw new Error("Should not allow property mutation on snapshot");
    } catch (e: any) {
      assert(e instanceof TypeError, "Mutating property throws TypeError");
    }
    console.log("   ✓ Snapshot immutability verified.");
  }

  // ==================================================
  // 17. Validator Rules
  // ==================================================
  console.log("\n17. Verifying Validator Rules...");
  {
    // 17.1 Missing profile
    try {
      ResearchValidator.validateRequest({
        id: "req-invalid",
        type: ResearchType.FULL,
        channelProfile: {},
        state: ResearchState.CREATED,
        timestamp: new Date(),
      });
      throw new Error("Should not validate empty channel profile");
    } catch (e: any) {
      assert(e instanceof ResearchValidationException, "Throws ResearchValidationException");
    }

    // 17.2 Invalid scores
    try {
      ResearchValidator.validateTopic({
        id: "topic-invalid",
        topic: "Invalid Topic",
        category: "Tech",
        growthScore: 1.5, // Invalid > 1
        competitionScore: 0.5,
        trendScore: 0.5,
        monetizationScore: 0.5,
        audienceMatchScore: 0.5,
        confidenceScore: 0.5,
        finalScore: 0.5,
        tags: [],
        metadata: { valid: true },
      });
      throw new Error("Should reject out-of-bounds score (> 1.0)");
    } catch (e: any) {
      assert(e instanceof ResearchValidationException, "Throws ResearchValidationException");
    }

    // 17.3 Circular reference
    const circularObj: any = { name: "Root" };
    circularObj.self = circularObj;
    try {
      ResearchValidator.detectCircularReferences(circularObj, "circular");
      throw new Error("Should detect circular references");
    } catch (e: any) {
      assert(e instanceof ResearchValidationException, "Throws error on circular reference");
    }
    console.log("   ✓ Validator rules verified.");
  }

  // ==================================================
  // 18. Duplicate Prevention
  // ==================================================
  console.log("\n18. Verifying Duplicate Prevention...");
  {
    // Reuse identical profile without allowCached option
    const req1: ResearchRequest = {
      id: "req-dup-1",
      type: ResearchType.FULL,
      channelProfile: { query: "DuplicatePreventionQuery" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };
    await engine.execute(req1);

    const req2: ResearchRequest = {
      id: "req-dup-2",
      type: ResearchType.FULL,
      channelProfile: { query: "DuplicatePreventionQuery" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };

    try {
      await engine.execute(req2);
      throw new Error("Should fail due to duplicate topic query");
    } catch (e: any) {
      assert(e instanceof ResearchException, "Throws ResearchException on duplicate request");
    }
    console.log("   ✓ Duplicate prevention verified.");
  }

  // ==================================================
  // 19. Regression Tests
  // ==================================================
  console.log("\n19. Verifying Regression Tests...");
  {
    // Empty request ID
    try {
      const req: ResearchRequest = {
        id: "",
        type: ResearchType.FULL,
        channelProfile: { query: "Test" },
        state: ResearchState.CREATED,
        timestamp: new Date(),
      };
      await engine.execute(req);
      throw new Error("Should fail on empty request ID");
    } catch (e: any) {
      assert(e instanceof ResearchValidationException, "Fails request validation on empty ID");
    }
    console.log("   ✓ Regression tests verified.");
  }

  // ==================================================
  // 20. Full End-to-End Research Execution
  // ==================================================
  console.log("\n20. Verifying Full End-to-End Research Execution...");
  {
    const req: ResearchRequest = {
      id: "req-e2e-final",
      type: ResearchType.FULL,
      channelProfile: { query: "E2EQuery" },
      state: ResearchState.CREATED,
      timestamp: new Date(),
    };

    const res = await engine.execute(req);
    assert(res.state === ResearchState.COMPLETED, "Response state is COMPLETED");
    assert(res.topics.length === 2, "Returns all discovered topics");
    assert(res.opportunities.length === 2, "Returns all opportunities");
    assert(res.reports.length === 1, "Includes final report");
    assert(res.keywordAnalysis !== undefined, "Includes keywords");
    assert(res.audienceInsight !== undefined, "Includes audience insight");
    console.log("   ✓ Full end-to-end research execution verified.");
  }

  console.log("\n=== ALL 20/20 RESEARCH INTELLIGENCE ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
