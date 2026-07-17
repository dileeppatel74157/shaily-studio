import * as path from "path";
import {
  DecisionState,
  DecisionPriority,
  DecisionStrategy,
  DecisionType,
  DecisionRisk,
  DecisionStatus,
  DecisionEngine,
  DecisionBuilder,
  DecisionValidator,
  DecisionPolicy,
  DecisionException,
  DecisionValidationException,
  DecisionOutcome,
} from "./decision/index";
import { LoggerBuilder, JsonFormatter } from "./logger/index";
import { EventBus } from "./events/index";
import { ConfigBuilder, MemorySource } from "./config/index";
import { MemoryStore } from "./memory/index";
import { ServiceRegistry } from "./registry/index";
import { AgentBuilder } from "./agents/index";
import { PlanningEngine } from "./planning/index";
import { Workflow, WorkflowExecutor, WorkflowState } from "./workflow/index";

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

class DummyAgentLifecycle {
  public async initialize(): Promise<void> {}
  public async execute(context: any, input?: any): Promise<any> {
    return input;
  }
  public async shutdown(): Promise<void> {}
}

async function runTests() {
  console.log("=== START AUTONOMOUS DECISION ENGINE TESTS ===");

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

  const engine = new DecisionEngine(platformContext);

  // Register engine in registry
  const token = { name: "IDecisionEngine" } as any;
  registry.register(token, engine);

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("\n1. Verifying Decision Builder...");
  {
    const decision = new DecisionBuilder()
      .withId("dec-1")
      .withType(DecisionType.TOOL_SELECTION)
      .withPriority(DecisionPriority.HIGH)
      .withStrategy(DecisionStrategy.MULTI_ATTRIBUTIVE)
      .withContext(platformContext)
      .addOption({
        id: "opt-1",
        name: "Option 1",
        description: "Desc 1",
        cost: 2,
        reward: 8,
        risk: DecisionRisk.LOW,
      })
      .addCriteria({ name: "alignment", weight: 0.6 })
      .addCriteria({ name: "feasibility", weight: 0.4 })
      .build();

    assert(decision.id === "dec-1", "ID is correct");
    assert(decision.priority === DecisionPriority.HIGH, "Priority is correct");
    assert(decision.options.length === 1, "Has 1 option");
    assert(decision.criteria.length === 2, "Has 2 criteria");
    console.log("   ✓ Builder validated successfully.");
  }

  // ==================================================
  // 2. Lifecycle Transitions
  // ==================================================
  console.log("\n2. Verifying Lifecycle Transitions...");
  {
    const decision = new DecisionBuilder()
      .withId("dec-2")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 2, risk: DecisionRisk.LOW })
      .addCriteria({ name: "alignment", weight: 1.0 })
      .build();

    assert(decision.state === DecisionState.CREATED, "Starts in CREATED state");
    const evaluated = await engine.evaluate(decision);
    assert(evaluated.state === DecisionState.COMMITTED, "Ends in COMMITTED state");
    console.log("   ✓ Lifecycle transitions verified.");
  }

  // ==================================================
  // 3. Option Evaluation
  // ==================================================
  console.log("\n3. Verifying Option Evaluation...");
  {
    const decision = new DecisionBuilder()
      .withId("dec-3")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 2, reward: 1, risk: DecisionRisk.LOW })
      .addOption({ id: "opt-2", name: "Opt 2", description: "D", cost: 1, reward: 8, risk: DecisionRisk.LOW })
      .addCriteria({ name: "feasibility", weight: 1.0 })
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-2", "Selects option with higher feasibility");
    console.log("   ✓ Option evaluation verified.");
  }

  // ==================================================
  // 4. Weighted Scoring
  // ==================================================
  console.log("\n4. Verifying Weighted Scoring...");
  {
    const decision = new DecisionBuilder()
      .withId("dec-4")
      .withContext(platformContext)
      .addOption({
        id: "opt-1",
        name: "Opt 1",
        description: "D",
        cost: 2,
        reward: 4,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.9, feasibility: 0.3 }
      })
      .addOption({
        id: "opt-2",
        name: "Opt 2",
        description: "D",
        cost: 1,
        reward: 8,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.4, feasibility: 0.8 }
      })
      // Heavy weight on alignment
      .addCriteria({ name: "alignment", weight: 0.8 })
      .addCriteria({ name: "feasibility", weight: 0.2 })
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-1", "Alignment priority selection verified");
    console.log("   ✓ Weighted scoring verified.");
  }

  // ==================================================
  // 5. Risk Analysis
  // ==================================================
  console.log("\n5. Verifying Risk Analysis...");
  {
    const decision = new DecisionBuilder()
      .withId("dec-5")
      .withStrategy(DecisionStrategy.RISK_MINIMIZATION)
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "High Risk Opt", description: "D", cost: 1, reward: 10, risk: DecisionRisk.HIGH })
      .addOption({ id: "opt-2", name: "Low Risk Opt", description: "D", cost: 1, reward: 4, risk: DecisionRisk.LOW })
      .addCriteria({ name: "feasibility", weight: 0.5 })
      .addCriteria({ name: "riskImpact", weight: 0.5 })
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-2", "Low risk option selected under risk minimization");
    console.log("   ✓ Risk analysis verified.");
  }

  // ==================================================
  // 6. Confidence Calculation
  // ==================================================
  console.log("\n6. Verifying Confidence Calculation...");
  {
    const decision = new DecisionBuilder()
      .withId("dec-6")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 10, risk: DecisionRisk.LOW })
      .addOption({ id: "opt-2", name: "Opt 2", description: "D", cost: 5, reward: 1, risk: DecisionRisk.HIGH })
      .addCriteria({ name: "feasibility", weight: 1.0 })
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.confidence !== undefined, "Confidence evaluated");
    assert(evaluated.confidence!.score >= 0.5, "Confidence high when clear gap exists");
    console.log("   ✓ Confidence calculation verified.");
  }

  // ==================================================
  // 7. Rule Engine
  // ==================================================
  console.log("\n7. Verifying Rule Engine...");
  {
    const policy = new DecisionPolicy("p-1", "Test Policy", [
      {
        id: "r-exclude",
        name: "Exclude High Risk",
        condition: (opt) => opt.risk === DecisionRisk.HIGH,
        action: "exclude"
      }
    ]);

    const decision = new DecisionBuilder()
      .withId("dec-7")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 10, risk: DecisionRisk.HIGH })
      .addOption({ id: "opt-2", name: "Opt 2", description: "D", cost: 1, reward: 5, risk: DecisionRisk.LOW })
      .addCriteria({ name: "feasibility", weight: 1.0 })
      .addPolicy(policy)
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-2", "High risk option excluded via rule condition");
    console.log("   ✓ Rule Engine verified.");
  }

  // ==================================================
  // 8. Policy Validation
  // ==================================================
  console.log("\n8. Verifying Policy Validation...");
  {
    const policy = new DecisionPolicy("p-2", "Boost Policy", [
      {
        id: "r-boost",
        name: "Boost Reward",
        condition: (opt) => opt.reward >= 8,
        action: "boost",
        value: 0.3
      }
    ]);

    const decision = new DecisionBuilder()
      .withId("dec-8")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 9, risk: DecisionRisk.LOW })
      .addOption({ id: "opt-2", name: "Opt 2", description: "D", cost: 1, reward: 3, risk: DecisionRisk.LOW })
      .addCriteria({ name: "alignment", weight: 1.0 })
      .addPolicy(policy)
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-1", "Selected boosted option");
    console.log("   ✓ Policy validation verified.");
  }

  // ==================================================
  // 9. Constraints
  // ==================================================
  console.log("\n9. Verifying Constraints...");
  {
    const constraint = {
      id: "max-cost",
      name: "Max Cost 5",
      type: "cost" as any,
      value: 5,
      validate: (opt: any) => opt.cost <= 5
    };

    const decision = new DecisionBuilder()
      .withId("dec-9")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "High Cost", description: "D", cost: 10, reward: 20, risk: DecisionRisk.LOW })
      .addOption({ id: "opt-2", name: "Low Cost", description: "D", cost: 3, reward: 6, risk: DecisionRisk.LOW })
      .addCriteria({ name: "feasibility", weight: 1.0 })
      .addConstraint(constraint)
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-2", "Constraint filtered out expensive option");
    console.log("   ✓ Constraints verified.");
  }

  // ==================================================
  // 10. Cost Optimization
  // ==================================================
  console.log("\n10. Verifying Cost Optimization...");
  {
    const decision = new DecisionBuilder()
      .withId("dec-10")
      .withStrategy(DecisionStrategy.COST_OPTIMIZATION)
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 8, risk: DecisionRisk.LOW })
      .addOption({ id: "opt-2", name: "Opt 2", description: "D", cost: 5, reward: 9, risk: DecisionRisk.LOW })
      .addCriteria({ name: "feasibility", weight: 1.0 })
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-1", "Selects higher reward-to-cost ratio option");
    console.log("   ✓ Cost optimization verified.");
  }

  // ==================================================
  // 11. Goal Alignment
  // ==================================================
  console.log("\n11. Verifying Goal Alignment...");
  {
    const decision = new DecisionBuilder()
      .withId("dec-11")
      .withContext(platformContext)
      .addOption({
        id: "opt-1",
        name: "Opt 1",
        description: "D",
        cost: 1,
        reward: 4,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.9 }
      })
      .addOption({
        id: "opt-2",
        name: "Opt 2",
        description: "D",
        cost: 1,
        reward: 4,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.2 }
      })
      .addCriteria({ name: "alignment", weight: 1.0 })
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-1", "Highly aligned option selected");
    console.log("   ✓ Goal alignment verified.");
  }

  // ==================================================
  // 12. Alternative Selection
  // ==================================================
  console.log("\n12. Verifying Alternative Selection...");
  {
    const decision = new DecisionBuilder()
      .withId("dec-12")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 5, risk: DecisionRisk.LOW })
      .addOption({ id: "opt-2", name: "Opt 2", description: "D", cost: 1, reward: 3, risk: DecisionRisk.LOW })
      .addOption({ id: "opt-3", name: "Opt 3", description: "D", cost: 1, reward: 1, risk: DecisionRisk.LOW })
      .addCriteria({ name: "feasibility", weight: 1.0 })
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.options[0].id === "opt-1", "Rank 1 is correct");
    assert(evaluated.options[1].id === "opt-2", "Rank 2 is correct");
    assert(evaluated.options[2].id === "opt-3", "Rank 3 is correct");
    console.log("   ✓ Alternative selection verified.");
  }

  // ==================================================
  // 13. Decision History
  // ==================================================
  console.log("\n13. Verifying Decision History...");
  {
    const hist = await engine.getHistory();
    assert(hist.length >= 1, "Recorded history of previous evaluations");
    console.log("   ✓ Decision history verified.");
  }

  // ==================================================
  // 14. Retry Decisions
  // ==================================================
  console.log("\n14. Verifying Retry Decisions...");
  {
    // Simulate retry by creating and executing a decision with retriesCount incremented
    const decision = new DecisionBuilder()
      .withId("dec-14")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 5, risk: DecisionRisk.LOW })
      .addCriteria({ name: "feasibility", weight: 1.0 })
      .build();

    const retryDecision = {
      ...decision,
      retriesCount: 1,
    };

    const evaluated = await engine.evaluate(retryDecision);
    assert(evaluated.selectedOptionId === "opt-1", "Retry evaluation succeeded");
    console.log("   ✓ Retry decisions verified.");
  }

  // ==================================================
  // 15. Fallback Decisions
  // ==================================================
  console.log("\n15. Verifying Fallback Decisions...");
  {
    // Apply highly restrictive constraint that filters all options out, expecting fallback
    const constraint = {
      id: "impossible",
      name: "Impossible Limit",
      type: "custom" as any,
      value: null,
      validate: () => false
    };

    const decision = new DecisionBuilder()
      .withId("dec-15")
      .withFallbackOptionId("opt-fallback")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 5, risk: DecisionRisk.LOW })
      .addOption({ id: "opt-fallback", name: "Fallback Opt", description: "Fallback", cost: 1, reward: 1, risk: DecisionRisk.LOW })
      .addCriteria({ name: "feasibility", weight: 1.0 })
      .addConstraint(constraint)
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-fallback", "Fallback option chosen when no option matches constraints");
    console.log("   ✓ Fallback decisions verified.");
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
      jobEngine: null as any,
      memoryStore: memoryStore,
    };

    const agent = new AgentBuilder()
      .withId("agent-dec-1")
      .withName("Decision Agent")
      .withContext(agentContext)
      .withLifecycle(new DummyAgentLifecycle())
      .build();

    const options = [
      { id: "tool-1", name: "Tool 1" },
      { id: "tool-2", name: "Tool 2" },
    ];

    const chosen = await agent.selectExecutionOption(DecisionType.TOOL_SELECTION, options);
    assert(chosen !== undefined, "Agent calls selectExecutionOption");
    assert(chosen.id === "tool-1", "Selected best tool");
    console.log("   ✓ Agent integration verified.");
  }

  // ==================================================
  // 17. Planning Integration
  // ==================================================
  console.log("\n17. Verifying Planning Integration...");
  {
    const planningContext = {
      logger,
      config,
      registry,
      eventBus,
    };

    const planEngine = new PlanningEngine(planningContext);
    await planEngine.initialize();
    await planEngine.start();

    const plan = await planEngine.createPlan({
      id: "plan-dec-1",
      goal: {
        id: "goal-dec-1",
        description: "Select execute via choose-tool step",
        priority: "NORMAL" as any,
        type: "SIMPLE" as any,
        status: "PENDING" as any,
      },
      strategy: "SEQUENTIAL" as any,
    });

    assert(plan.tasks[0].choice !== undefined, "PlanningEngine delegates choice to DecisionEngine");
    assert(plan.tasks[0].choice?.targetId === "test-tool", "Correct target selected");
    console.log("   ✓ Planning integration verified.");
  }

  // ==================================================
  // 18. Workflow Integration
  // ==================================================
  console.log("\n18. Verifying Workflow Integration...");
  {
    const workflowContext = {
      logger,
      config,
      registry,
      eventBus,
      agentRegistry: {
        get: () => ({
          state: "READY",
          execute: async () => ({}),
        } as any)
      }
    };

    const workflow = new Workflow(
      "wf-dec-1",
      "Decision Workflow",
      "1.0.0",
      "Desc",
      [
        {
          id: "step-1",
          name: "Step 1",
          agentId: "agent-1",
          priority: 0,
          status: "pending" as any,
          input: {},
        }
      ],
      {},
      workflowContext as any
    );

    const exec = new WorkflowExecutor();
    await exec.execute(workflow);
    assert(workflow.state === WorkflowState.COMPLETED, "Workflow executes step and resolves choice via Decision Engine");
    console.log("   ✓ Workflow integration verified.");
  }

  // ==================================================
  // 19. Event Publishing
  // ==================================================
  console.log("\n19. Verifying Event Publishing...");
  {
    let eventReceived: any = false;
    eventBus.subscribe("DecisionMade", () => {
      eventReceived = true;
    });

    const decision = new DecisionBuilder()
      .withId("dec-19")
      .withContext(platformContext)
      .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 5, risk: DecisionRisk.LOW })
      .addCriteria({ name: "feasibility", weight: 1.0 })
      .build();

    await engine.evaluate(decision);
    assert(eventReceived === true, "Published DecisionMade event");
    console.log("   ✓ Event publishing verified.");
  }

  // ==================================================
  // 20. Snapshot Immutability
  // ==================================================
  console.log("\n20. Verifying Snapshot Immutability...");
  {
    const snap = engine.snapshot();
    assert(Object.isFrozen(snap), "Snapshot array is frozen");
    assert(Object.isFrozen(snap[0]), "Snapshot child properties are frozen");

    try {
      (snap as any)[0] = {} as any;
      throw new Error("Should not write to snapshot");
    } catch (e: any) {
      assert(e instanceof TypeError, "Mutating throws TypeError");
    }
    console.log("   ✓ Snapshot immutability verified.");
  }

  // ==================================================
  // 21. Validator Rules
  // ==================================================
  console.log("\n21. Verifying Validator Rules...");
  {
    // Empty options validation
    try {
      const dec = new DecisionBuilder()
        .withId("dec-invalid-options")
        .withContext(platformContext)
        .build();
      DecisionValidator.validate(dec);
      throw new Error("Should reject empty options");
    } catch (e: any) {
      assert(e instanceof DecisionValidationException, "Throws DecisionValidationException for empty options");
    }

    // Duplicate option ID validation
    try {
      const dec = new DecisionBuilder()
        .withId("dec-dup")
        .withContext(platformContext)
        .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 5, risk: DecisionRisk.LOW })
        .addOption({ id: "opt-1", name: "Opt 1 Duplicate", description: "D", cost: 1, reward: 5, risk: DecisionRisk.LOW })
        .addCriteria({ name: "alignment", weight: 1.0 })
        .build();
      DecisionValidator.validate(dec);
      throw new Error("Should reject duplicate option IDs");
    } catch (e: any) {
      assert(e instanceof DecisionValidationException, "Throws DecisionValidationException for duplicate IDs");
    }

    // Circular rules validation
    try {
      const policy = new DecisionPolicy("p-circular", "Circular", [
        {
          id: "r-1",
          name: "Rule 1",
          condition: () => true,
          action: "exclude",
          dependsOnRuleId: "r-2"
        },
        {
          id: "r-2",
          name: "Rule 2",
          condition: () => true,
          action: "exclude",
          dependsOnRuleId: "r-1"
        }
      ]);

      const dec = new DecisionBuilder()
        .withId("dec-circular")
        .withContext(platformContext)
        .addOption({ id: "opt-1", name: "Opt 1", description: "D", cost: 1, reward: 5, risk: DecisionRisk.LOW })
        .addCriteria({ name: "alignment", weight: 1.0 })
        .addPolicy(policy)
        .build();

      DecisionValidator.validate(dec);
      throw new Error("Should reject circular rules");
    } catch (e: any) {
      assert(e instanceof DecisionValidationException, "Throws DecisionValidationException for circular dependencies");
    }
    console.log("   ✓ Validator rules verified.");
  }

  // ==================================================
  // 22. Full Integration & Self-Optimization
  // ==================================================
  console.log("\n22. Verifying Full Integration & Self-Optimization...");
  {
    // Record multiple positive outcome results in the feedback namespace to trigger self-optimization
    const outcome1: DecisionOutcome = {
      decisionId: "dec-22-pre1",
      selectedOptionId: "opt-feed",
      success: true,
      timestamp: new Date()
    };
    await engine.recordOutcome(outcome1);

    const outcome2: DecisionOutcome = {
      decisionId: "dec-22-pre2",
      selectedOptionId: "opt-feed",
      success: true,
      timestamp: new Date()
    };
    await engine.recordOutcome(outcome2);

    // Evaluate decision containing the historically successful option vs another option
    const decision = new DecisionBuilder()
      .withId("dec-22-run")
      .withContext(platformContext)
      // Both options have exactly identical metadata and base scores
      .addOption({
        id: "opt-feed",
        name: "Historical Winner Option",
        description: "D",
        cost: 1,
        reward: 4,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5 }
      })
      .addOption({
        id: "opt-neutral",
        name: "Neutral Option",
        description: "D",
        cost: 1,
        reward: 4,
        risk: DecisionRisk.LOW,
        metadata: { alignment: 0.5 }
      })
      .addCriteria({ name: "alignment", weight: 1.0 })
      .build();

    const evaluated = await engine.evaluate(decision);
    assert(evaluated.selectedOptionId === "opt-feed", "Self-optimized selection of winner option verified");
    console.log("   ✓ Full integration and self-optimization verified.");
  }

  console.log("\n=== ALL 22/22 DECISION ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err: any) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
