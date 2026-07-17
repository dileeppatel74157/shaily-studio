import {
  ExecutionState,
  ExecutionSupervisor,
  ExecutionBuilder,
  LimitExceededException,
  BudgetExceededException,
  SupervisorValidationException,
} from "./supervisor/index";
import { ExecutionValidator } from "./supervisor/ExecutionValidator";
import { deepFreeze } from "./supervisor/types";
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
  console.log("=== START AUTONOMOUS EXECUTION SUPERVISOR TESTS ===");

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

  const supervisor = new ExecutionSupervisor(platformContext);
  registry.register({ name: "IExecutionSupervisor" } as any, supervisor);

  const defaultPolicy = {
    id: "pol-1",
    name: "Default Test Policy",
    limits: {
      maxTokens: 1000,
      maxCost: 5,
      maxExecutionTimeMs: 1000,
      maxWorkflowDepth: 3,
      maxRecursion: 3,
      maxParallelJobs: 3,
      maxRetries: 3,
      maxAiCalls: 5,
      maxToolCalls: 5,
    },
    budget: {
      tokens: 1000,
      cost: 5,
      executionTimeMs: 1000,
      apiCalls: 5,
      providerUsage: {},
    },
    allowedRecoveries: ["retry", "rollback", "resume", "restart"] as any[],
  };

  // ==================================================
  // 1. Builder Validation
  // ==================================================
  console.log("\n1. Verifying Execution Builder...");
  {
    const session = new ExecutionBuilder()
      .withId("session-1")
      .withType("agent")
      .withPolicy(defaultPolicy as any)
      .withContext(platformContext)
      .build();

    assert(session.id === "session-1", "ID matches");
    assert(session.type === "agent", "Type matches");
    assert(session.state === ExecutionState.CREATED, "Starts in CREATED");
    assert(session.checkpoints.length === 0, "No checkpoints initial");
    console.log("   ✓ Builder validated successfully.");
  }

  // ==================================================
  // 2. Lifecycle State Transitions
  // ==================================================
  console.log("\n2. Verifying Lifecycle State Transitions...");
  {
    const session = new ExecutionBuilder()
      .withId("session-2")
      .withType("workflow")
      .withPolicy(defaultPolicy as any)
      .withContext(platformContext)
      .build();

    await supervisor.registerSession(session);
    await supervisor.updateSessionState("session-2", ExecutionState.RUNNING);
    await supervisor.updateSessionState("session-2", ExecutionState.PAUSED);
    await supervisor.updateSessionState("session-2", ExecutionState.RUNNING);
    await supervisor.updateSessionState("session-2", ExecutionState.COMPLETED);

    const snap = supervisor.snapshot();
    const snapItem = snap.find((s) => s.sessionId === "session-2");
    assert(snapItem !== undefined, "Snapshot found");
    assert(snapItem!.state === ExecutionState.COMPLETED, "State resolved to COMPLETED");
    console.log("   ✓ Lifecycle state transitions verified.");
  }

  // ==================================================
  // 3. Monitoring Session Types
  // ==================================================
  console.log("\n3. Verifying Monitoring Session Types...");
  {
    const types: Array<"agent" | "workflow" | "tool" | "ai" | "decision" | "skill"> = [
      "agent", "workflow", "tool", "ai", "decision", "skill"
    ];

    for (const t of types) {
      const session = new ExecutionBuilder()
        .withId(`session-monitoring-${t}`)
        .withType(t)
        .withPolicy(defaultPolicy as any)
        .withContext(platformContext)
        .build();
      await supervisor.registerSession(session);
    }

    const snap = supervisor.snapshot();
    for (const t of types) {
      assert(snap.some((s) => s.sessionId === `session-monitoring-${t}` && s.type === t), `Monitoring of ${t} verified`);
    }
    console.log("   ✓ Monitoring session types verified.");
  }

  // ==================================================
  // 4. Checkpoints saving and restoring
  // ==================================================
  console.log("\n4. Verifying Checkpoints...");
  {
    const session = new ExecutionBuilder()
      .withId("session-chk-test")
      .withType("agent")
      .withPolicy(defaultPolicy as any)
      .withContext(platformContext)
      .build();

    await supervisor.registerSession(session);
    await supervisor.updateSessionState("session-chk-test", ExecutionState.RUNNING);

    const chk = await supervisor.createCheckpoint("session-chk-test", { var1: "hello", step: 3 }, 30);
    assert(chk.id !== undefined, "Created checkpoint ID");
    assert(chk.progress === 30, "Progress stored correctly");
    assert(chk.variables.var1 === "hello", "Variables saved");

    const restored = await supervisor.restoreCheckpoint("session-chk-test", chk.id);
    assert(restored.id === chk.id, "Restored checkpoint matches");
    console.log("   ✓ Checkpoints verified.");
  }

  // ==================================================
  // 5. Recovery Actions (Retry)
  // ==================================================
  console.log("\n5. Verifying Retry Recovery Strategy...");
  {
    const policy = {
      ...defaultPolicy,
      id: "pol-retry",
      allowedRecoveries: ["retry"],
    };

    const session = new ExecutionBuilder()
      .withId("session-rec-retry")
      .withType("agent")
      .withPolicy(policy as any)
      .withContext(platformContext)
      .build();

    await supervisor.registerSession(session);
    await supervisor.updateSessionState("session-rec-retry", ExecutionState.RUNNING);

    await supervisor.recordFailure("session-rec-retry", new Error("Execution failure"));
    const recovered = await supervisor.executeRecovery("session-rec-retry");
    assert(recovered === true, "Retry recovery successful");

    const snap = supervisor.snapshot();
    const snapItem = snap.find((s) => s.sessionId === "session-rec-retry");
    assert(snapItem!.state === ExecutionState.RUNNING, "State resumed to RUNNING");
    assert(snapItem!.recoveryHistory[0].strategy === "retry", "Recorded retry strategy");
    console.log("   ✓ Retry recovery verified.");
  }

  // ==================================================
  // 6. Recovery Actions (Rollback & Resume)
  // ==================================================
  console.log("\n6. Verifying Rollback and Resume Recovery...");
  {
    const policy = {
      ...defaultPolicy,
      id: "pol-roll",
      allowedRecoveries: ["rollback", "resume"],
    };

    const session = new ExecutionBuilder()
      .withId("session-rec-roll")
      .withType("workflow")
      .withPolicy(policy as any)
      .withContext(platformContext)
      .build();

    await supervisor.registerSession(session);
    await supervisor.updateSessionState("session-rec-roll", ExecutionState.RUNNING);

    const chk = await supervisor.createCheckpoint("session-rec-roll", { data: 42 }, 50);
    await supervisor.recordFailure("session-rec-roll", new Error("DB Error"));

    const recovered = await supervisor.executeRecovery("session-rec-roll");
    assert(recovered === true, "Rollback successful");

    const snap = supervisor.snapshot();
    const snapItem = snap.find((s) => s.sessionId === "session-rec-roll");
    assert(snapItem!.checkpoints.length === 1, "Has 1 checkpoint");
    assert(snapItem!.recoveryHistory[0].strategy === "rollback", "Rolled back to checkpoint");
    assert(snapItem!.recoveryHistory[0].checkpointId === chk.id, "Correct checkpoint restored");
    console.log("   ✓ Rollback & Resume recovery verified.");
  }

  // ==================================================
  // 7. Token Limits
  // ==================================================
  console.log("\n7. Verifying Token Limits...");
  {
    const policy = {
      ...defaultPolicy,
      id: "pol-tokens",
      limits: {
        ...defaultPolicy.limits,
        maxTokens: 50,
      },
    };

    const session = new ExecutionBuilder()
      .withId("session-tokens-limit")
      .withType("ai")
      .withPolicy(policy as any)
      .withContext(platformContext)
      .build();

    await supervisor.registerSession(session);
    await supervisor.updateSessionState("session-tokens-limit", ExecutionState.RUNNING);

    try {
      await supervisor.consumeBudget("session-tokens-limit", 100, 0.0);
      throw new Error("Should reject token limit excess");
    } catch (e: any) {
      assert(e instanceof LimitExceededException, "Throws LimitExceededException");
      assert(e.message.includes("maxTokens"), "Indicates token limit violation");
    }
    console.log("   ✓ Token limits verified.");
  }

  // ==================================================
  // 8. Cost Limits
  // ==================================================
  console.log("\n8. Verifying Cost Limits...");
  {
    const policy = {
      ...defaultPolicy,
      id: "pol-cost",
      budget: {
        ...defaultPolicy.budget,
        cost: 1.0,
      },
    };

    const session = new ExecutionBuilder()
      .withId("session-cost-limit")
      .withType("tool")
      .withPolicy(policy as any)
      .withContext(platformContext)
      .build();

    await supervisor.registerSession(session);
    await supervisor.updateSessionState("session-cost-limit", ExecutionState.RUNNING);

    try {
      await supervisor.consumeBudget("session-cost-limit", 0, 5.0);
      throw new Error("Should reject budget cost excess");
    } catch (e: any) {
      assert(e instanceof BudgetExceededException, "Throws BudgetExceededException");
      assert(e.message.includes("cost"), "Indicates cost budget violation");
    }
    console.log("   ✓ Cost limits verified.");
  }

  // ==================================================
  // 9. Timeout Handling
  // ==================================================
  console.log("\n9. Verifying Timeout Handling...");
  {
    const policy = {
      ...defaultPolicy,
      id: "pol-time",
      limits: {
        ...defaultPolicy.limits,
        maxExecutionTimeMs: 1, // trigger immediately on check
      },
    };

    const session = new ExecutionBuilder()
      .withId("session-timeout")
      .withType("agent")
      .withPolicy(policy as any)
      .withContext(platformContext)
      .build();

    await supervisor.registerSession(session);
    await supervisor.updateSessionState("session-timeout", ExecutionState.RUNNING);

    // Sleep for 2ms
    await new Promise((r) => setTimeout(r, 2));

    try {
      await supervisor.consumeBudget("session-timeout", 0, 0.0);
      throw new Error("Should reject duration timeout");
    } catch (e: any) {
      assert(e instanceof LimitExceededException, "Throws LimitExceededException for timeout");
      assert(e.message.includes("maxExecutionTimeMs"), "Indicates duration limit exceeded");
    }
    console.log("   ✓ Timeout handling verified.");
  }

  // ==================================================
  // 10. Health Monitoring
  // ==================================================
  console.log("\n10. Verifying Health Monitoring...");
  {
    const report = await supervisor.getReport();
    assert(report.health.latencyMs > 0, "Reports latency indicators");
    assert(report.health.memoryUsageBytes > 0, "Reports memory usage");
    assert(report.timestamp instanceof Date, "Gives current report timestamp");
    console.log("   ✓ Health monitoring verified.");
  }

  // ==================================================
  // 11. Event Publishing
  // ==================================================
  console.log("\n11. Verifying Event Publishing...");
  {
    let checkpointEvent: any = false;
    eventBus.subscribe("ExecutionCheckpointCreated", () => {
      checkpointEvent = true;
    });

    const session = new ExecutionBuilder()
      .withId("session-evt-chk")
      .withType("agent")
      .withPolicy(defaultPolicy as any)
      .withContext(platformContext)
      .build();

    await supervisor.registerSession(session);
    await supervisor.updateSessionState("session-evt-chk", ExecutionState.RUNNING);
    await supervisor.createCheckpoint("session-evt-chk", { x: 10 }, 40);

    assert(checkpointEvent === true, "Fired ExecutionCheckpointCreated");
    console.log("   ✓ Event publishing verified.");
  }

  // ==================================================
  // 12. Snapshot Immutability
  // ==================================================
  console.log("\n12. Verifying Snapshot Immutability...");
  {
    const snap = supervisor.snapshot();
    assert(Object.isFrozen(snap), "Snapshot array is frozen");
    assert(Object.isFrozen(snap[0]), "Snapshot item is frozen");

    try {
      (snap as any)[0] = {} as any;
      throw new Error("Should not write to snapshot");
    } catch (e: any) {
      assert(e instanceof TypeError, "Mutating throws TypeError");
    }
    console.log("   ✓ Snapshot immutability verified.");
  }

  // ==================================================
  // 13. Validator Rules (circular checks)
  // ==================================================
  console.log("\n13. Verifying Validator Rules...");
  {
    // Transition check
    try {
      ExecutionValidator.validateTransition(ExecutionState.COMPLETED, ExecutionState.RUNNING);
      throw new Error("Should reject transition from COMPLETED to RUNNING");
    } catch (e: any) {
      assert(e instanceof SupervisorValidationException, "Throws SupervisorValidationException for state paths");
    }

    // Checkpoint check
    try {
      ExecutionValidator.validateCheckpoint({
        id: "chk-1",
        sessionId: "s-1",
        timestamp: new Date(),
        variables: {},
        progress: 150, // invalid
      });
      throw new Error("Should reject progress overflow");
    } catch (e: any) {
      assert(e instanceof SupervisorValidationException, "Throws SupervisorValidationException for progress range");
    }

    // Circular recovery check
    try {
      ExecutionValidator.validateCircularRecovery([
        {
          id: "r-1",
          sessionId: "s-1",
          strategy: "retry",
          error: "E",
          timestamp: new Date(),
          success: false,
          dependsOnRecoveryId: "r-2"
        },
        {
          id: "r-2",
          sessionId: "s-1",
          strategy: "retry",
          error: "E",
          timestamp: new Date(),
          success: false,
          dependsOnRecoveryId: "r-1"
        }
      ]);
      throw new Error("Should reject circular recoveries");
    } catch (e: any) {
      assert(e instanceof SupervisorValidationException, "Throws SupervisorValidationException for circular dependencies");
    }
    console.log("   ✓ Validator rules verified.");
  }

  // ==================================================
  // 14. Agent Integration Supervision
  // ==================================================
  console.log("\n14. Verifying Agent Integration Supervision...");
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
      .withId("agent-supervised-1")
      .withName("Supervised Agent")
      .withContext(agentContext)
      .withLifecycle(new DummyAgentLifecycle())
      .build();

    // Supervisor session should be registered automatically during execute
    await agent.initialize();
    await agent.execute("task input");

    const snap = supervisor.snapshot();
    assert(snap.some((s) => s.sessionId.includes("session-agent-supervised-1")), "Supervisor logs agent session on execution");
    console.log("   ✓ Agent integration supervision verified.");
  }

  // ==================================================
  // 15. Planning Integration Supervision
  // ==================================================
  console.log("\n15. Verifying Planning Integration Supervision...");
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

    await planEngine.createPlan({
      id: "plan-sup-1",
      goal: {
        id: "goal-sup-1",
        description: "Verify planning supervision step",
        priority: "NORMAL" as any,
        type: "SIMPLE" as any,
        status: "PENDING" as any,
      },
      strategy: "SEQUENTIAL" as any,
    });

    const snap = supervisor.snapshot();
    assert(snap.some((s) => s.sessionId.includes("plan-sup-1")), "Supervisor logs planning session on plan creation");
    console.log("   ✓ Planning integration supervision verified.");
  }

  // ==================================================
  // 16. Workflow Integration Supervision
  // ==================================================
  console.log("\n16. Verifying Workflow Integration Supervision...");
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
      "wf-sup-1",
      "Supervised Workflow",
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

    const snap = supervisor.snapshot();
    assert(snap.some((s) => s.sessionId.includes("session-wf-wf-sup-1")), "Supervisor logs workflow session on execution");
    console.log("   ✓ Workflow integration supervision verified.");
  }

  console.log("\n=== ALL 16/16 EXECUTION SUPERVISOR TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err: any) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
