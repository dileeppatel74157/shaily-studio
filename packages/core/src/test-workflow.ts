import { LoggerBuilder } from "./logger/LoggerBuilder";
import { EventBus } from "./events/EventBus";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { RegistryBuilder } from "./registry/RegistryBuilder";
import { JobEngine } from "./jobs/JobEngine";
import { MemoryStore } from "./memory/MemoryStore";
import { AgentBuilder } from "./agents/AgentBuilder";
import { AgentRegistry } from "./agents/AgentRegistry";
import { AgentLifecycle } from "./agents/AgentLifecycle";
import { AgentContext } from "./agents/AgentContext";
import { WorkflowBuilder } from "./workflow/WorkflowBuilder";
import { WorkflowEngine } from "./workflow/WorkflowEngine";
import { WorkflowState } from "./workflow/WorkflowState";
import { WorkflowStepStatus } from "./workflow/WorkflowStep";
import { JobPriority } from "./jobs/JobPriority";
import { WorkflowScheduler } from "./workflow/WorkflowScheduler";
import { InvalidWorkflowStateException, InvalidWorkflowException } from "./workflow/types";
import { JsonFormatter } from "./logger/LogFormatter";

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
    process.exit(1);
  }
}

// Simple agent behaviors for testing flow
class AppendLifecycle implements AgentLifecycle {
  constructor(private readonly _suffix: string) {}

  public async initialize(): Promise<void> {}
  public async execute(context: AgentContext, input?: unknown): Promise<unknown> {
    return `${String(input)} -> ${this._suffix}`;
  }
  public async shutdown(): Promise<void> {}
}

class FailLifecycle implements AgentLifecycle {
  public async initialize(): Promise<void> {}
  public async execute(): Promise<unknown> {
    throw new Error("Simulation failure in agent execution");
  }
  public async shutdown(): Promise<void> {}
}

class BlockerLifecycle implements AgentLifecycle {
  private readonly _resolvePromise: () => void;
  constructor(resolve: () => void) {
    this._resolvePromise = resolve;
  }
  public async initialize(): Promise<void> {}
  public async execute(): Promise<unknown> {
    this._resolvePromise();
    // Block indefinitely
    await new Promise<void>(() => {});
    return "blocked-result";
  }
  public async shutdown(): Promise<void> {}
}

async function runTests() {
  console.log("=== START WORKFLOW ENGINE VERIFICATION TESTS ===");

  // Platform context Setup
  const eventBus = new EventBus(logger);
  const config = await new ConfigBuilder({}).build();
  const serviceRegistry = new RegistryBuilder().build();
  const jobEngine = new JobEngine(logger, eventBus);
  const memoryStore = new MemoryStore();
  const agentRegistry = new AgentRegistry();

  const agentContext: AgentContext = {
    logger,
    config,
    registry: serviceRegistry,
    eventBus,
    jobEngine,
    memoryStore,
  };

  const workflowContext = {
    logger,
    config,
    registry: serviceRegistry,
    eventBus,
    jobEngine,
    memoryStore,
    agentRegistry,
  };

  function resetRegistry() {
    agentRegistry.unregister("agent-a");
    agentRegistry.unregister("agent-b");
    agentRegistry.unregister("agent-fail");
    agentRegistry.unregister("agent-block");

    const a = new AgentBuilder()
      .withId("agent-a")
      .withName("Agent A")
      .withContext(agentContext)
      .withLifecycle(new AppendLifecycle("A"))
      .build();

    const b = new AgentBuilder()
      .withId("agent-b")
      .withName("Agent B")
      .withContext(agentContext)
      .withLifecycle(new AppendLifecycle("B"))
      .build();

    const f = new AgentBuilder()
      .withId("agent-fail")
      .withName("Failing Agent")
      .withContext(agentContext)
      .withLifecycle(new FailLifecycle())
      .build();

    agentRegistry.register(a);
    agentRegistry.register(b);
    agentRegistry.register(f);
  }

  resetRegistry();
  const engine = new WorkflowEngine();

  // ==================================================
  // Test 1: Registration and Lookup works
  // ==================================================
  console.log("\n1. Running Registration & Lookup Tests...");
  {
    const workflow = new WorkflowBuilder()
      .withName("TestWorkflow")
      .withDescription("Simple content flow")
      .withContext(workflowContext)
      .addStep({
        id: "step-1",
        name: "Ideate Outline",
        agentId: "agent-a",
        priority: JobPriority.NORMAL,
        input: "start-data",
      })
      .build();

    assert(engine.has(workflow.id) === false, "Not registered initially");
    engine.register(workflow);
    assert(engine.has(workflow.id) === true, "Registered successfully");
    assert(engine.get(workflow.id) === workflow, "Lookup resolves correct instance");

    // Re-registering duplicate should fail
    try {
      engine.register(workflow);
      throw new Error("Should not allow duplicate register");
    } catch (err: any) {
      assert(err.message.includes("already registered"), "Duplicate register rejected");
    }

    // Unregistering
    const unregisterResult = engine.unregister(workflow.id);
    assert(unregisterResult === true, "Unregister returns true");
    assert(engine.has(workflow.id) === false, "Workflow removed from engine");
    console.log("   ✓ Registration and lookup verified.");
  }

  // ==================================================
  // Test 2: Validation constraints work
  // ==================================================
  console.log("\n2. Running Validation Tests...");
  {
    try {
      // Empty steps list should fail on build
      new WorkflowBuilder().withName("BadWorkflow").withContext(workflowContext).build();
      throw new Error("Should not allow empty steps");
    } catch (err: any) {
      assert(err.message.includes("at least one step"), "Rejects empty steps list on build");
    }

    try {
      // Missing key properties
      const badWorkflow = new WorkflowBuilder()
        .withName(" ") // Empty name
        .withContext(workflowContext)
        .addStep({
          id: "step-1",
          name: "s1",
          agentId: "agent-a",
          priority: JobPriority.NORMAL,
          input: "data",
        })
        .build();
      engine.register(badWorkflow);
      throw new Error("Should not allow registering empty name");
    } catch (err) {
      assert(
        err instanceof InvalidWorkflowException,
        "Throws InvalidWorkflowException on invalid name"
      );
    }
    console.log("   ✓ Validator constraints verified.");
  }

  // ==================================================
  // Test 3: Sequential step execution works
  // ==================================================
  console.log("\n3. Running Sequential Execution Tests...");
  {
    resetRegistry();
    const workflow = new WorkflowBuilder()
      .withName("SeqWorkflow")
      .withContext(workflowContext)
      .addStep({
        id: "s-1",
        name: "Step A",
        agentId: "agent-a",
        priority: JobPriority.NORMAL,
        input: "input-value",
      })
      .addStep({
        id: "s-2",
        name: "Step B",
        agentId: "agent-b",
        priority: JobPriority.HIGH,
        input: "another-value",
      })
      .build();

    engine.register(workflow);
    assert(workflow.state === WorkflowState.CREATED, "Starts as CREATED");

    const finalOutput = await engine.execute(workflow.id);

    // Expected final output: B's output ("another-value -> B")
    assert(finalOutput === "another-value -> B", "Final step output matches");
    assert(workflow.state === WorkflowState.COMPLETED, "Workflow is COMPLETED");

    // Inspect individual step statuses
    assert(workflow.steps[0].status === WorkflowStepStatus.COMPLETED, "Step 1 completed");
    assert(workflow.steps[0].output === "input-value -> A", "Step 1 output matches");
    assert(workflow.steps[1].status === WorkflowStepStatus.COMPLETED, "Step 2 completed");
    assert(workflow.steps[1].output === "another-value -> B", "Step 2 output matches");
    console.log("   ✓ Sequential execution and output propagation verified.");
  }

  // ==================================================
  // Test 4: Failure propagation works
  // ==================================================
  console.log("\n4. Running Failure Propagation Tests...");
  {
    resetRegistry();
    const workflow = new WorkflowBuilder()
      .withName("FailingWorkflow")
      .withContext(workflowContext)
      .addStep({
        id: "s-1",
        name: "Good Step",
        agentId: "agent-a",
        priority: JobPriority.NORMAL,
        input: "good-data",
      })
      .addStep({
        id: "s-2",
        name: "Failing Step",
        agentId: "agent-fail",
        priority: JobPriority.NORMAL,
        input: "bad-data",
      })
      .addStep({
        id: "s-3",
        name: "Unreached Step",
        agentId: "agent-b",
        priority: JobPriority.NORMAL,
        input: "unreached-data",
      })
      .build();

    engine.register(workflow);

    try {
      await engine.execute(workflow.id);
      throw new Error("Should propagate execution failure");
    } catch (err: any) {
      assert(err.message.includes("Simulation failure"), "Propagates agent error");
    }

    assert(workflow.state === WorkflowState.FAILED, "Workflow state transitions to FAILED");
    assert(workflow.steps[0].status === WorkflowStepStatus.COMPLETED, "Step 1 is completed");
    assert(workflow.steps[1].status === WorkflowStepStatus.FAILED, "Step 2 is failed");
    assert(
      workflow.steps[1].error === "Simulation failure in agent execution",
      "Step error captured"
    );
    assert(
      workflow.steps[2].status === WorkflowStepStatus.PENDING,
      "Step 3 remains pending/unreached"
    );
    console.log("   ✓ Failure propagation halts execution and flags workflow state.");
  }

  // ==================================================
  // Test 5: Cancellation works
  // ==================================================
  console.log("\n5. Running Cancellation Tests...");
  {
    resetRegistry();
    let blockerStarted = false;
    let resolveBlocker: () => void = () => {};
    const blockerPromise = new Promise<void>((resolve) => {
      resolveBlocker = resolve;
    });

    const blockAgent = new AgentBuilder()
      .withId("agent-block")
      .withName("Blocking Agent")
      .withContext(agentContext)
      .withLifecycle(
        new BlockerLifecycle(() => {
          blockerStarted = true;
          resolveBlocker();
        })
      )
      .build();

    agentRegistry.register(blockAgent);

    const workflow = new WorkflowBuilder()
      .withName("CancelWorkflow")
      .withContext(workflowContext)
      .addStep({
        id: "s-1",
        name: "Blocker Step",
        agentId: "agent-block",
        priority: JobPriority.NORMAL,
        input: "wait",
      })
      .addStep({
        id: "s-2",
        name: "Unreached Step",
        agentId: "agent-a",
        priority: JobPriority.NORMAL,
        input: "cancelled",
      })
      .build();

    engine.register(workflow);

    // Trigger execution
    let executePromiseFinished = false;
    let executeError: any = null;
    const executePromise = engine
      .execute(workflow.id)
      .then(() => {
        executePromiseFinished = true;
      })
      .catch((err) => {
        executeError = err;
      });

    // Wait until blocker agent execution begins
    await blockerPromise;
    assert(blockerStarted, "Blocking agent started running");

    // Cancel workflow while running
    const cancelResult = await engine.cancel(workflow.id);
    assert(cancelResult === true, "cancel() returns true for running workflow");

    // Await execution promise (it should resolve/complete with cancellation handling)
    await executePromise;

    assert(workflow.state === WorkflowState.CANCELLED, "Workflow state transitions to CANCELLED");
    assert(workflow.steps[0].status === WorkflowStepStatus.CANCELLED, "Step 1 is cancelled");
    assert(workflow.steps[1].status === WorkflowStepStatus.CANCELLED, "Step 2 is cancelled");
    console.log("   ✓ Mid-execution cancellation verified successfully.");
  }

  // ==================================================
  // Test 6: Snapshot immutability works
  // ==================================================
  console.log("\n6. Running Snapshot Immutability Tests...");
  {
    const workflow = new WorkflowBuilder()
      .withName("SnapWorkflow")
      .withContext(workflowContext)
      .addStep({
        id: "s-1",
        name: "Step A",
        agentId: "agent-a",
        priority: JobPriority.NORMAL,
        input: "input",
      })
      .build();

    engine.register(workflow);
    const snap = workflow.snapshot();

    assert(Object.isFrozen(snap), "Workflow snapshot is frozen");
    assert(Object.isFrozen(snap.steps), "Snapshot steps are frozen");
    assert(Object.isFrozen(snap.steps[0]), "Snapshot step 1 is frozen");

    try {
      (snap as any).name = "Hacked";
      throw new Error("Should not allow snapshot modifications");
    } catch (err) {
      // correctly caught mutation error
    }

    const engineSnap = engine.snapshot();
    assert(Object.isFrozen(engineSnap), "Engine snapshot is frozen");
    assert(Object.isFrozen(engineSnap.workflows), "Engine snapshot workflows list is frozen");
    console.log("   ✓ Immutability of individual and engine snapshots verified.");
  }

  // ==================================================
  // Test 7: WorkflowScheduler integration works
  // ==================================================
  console.log("\n7. Running Scheduler Tests...");
  {
    resetRegistry();
    const workflow = new WorkflowBuilder()
      .withName("SchedWorkflow")
      .withContext(workflowContext)
      .addStep({
        id: "s-1",
        name: "Step A",
        agentId: "agent-a",
        priority: JobPriority.NORMAL,
        input: "sched-input",
      })
      .build();

    engine.register(workflow);

    const scheduler = new WorkflowScheduler(engine);
    await scheduler.schedule(workflow);

    assert(workflow.state === WorkflowState.COMPLETED, "Scheduler immediately executes workflow");

    try {
      await scheduler.scheduleDelayed(workflow, 1000);
      throw new Error("Should throw on delayed schedule");
    } catch (err: any) {
      assert(
        err.message.includes("Delayed scheduling is not supported"),
        "Rejects delayed scheduling"
      );
    }
    console.log("   ✓ WorkflowScheduler integration verified successfully.");
  }

  console.log("\n=== ALL WORKFLOW ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
