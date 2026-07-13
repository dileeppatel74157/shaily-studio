import { LoggerBuilder } from "./logger/LoggerBuilder";
import { ConfigBuilder } from "./config/ConfigBuilder";
import { EventBus } from "./events/EventBus";
import { MemoryStore } from "./memory/MemoryStore";
import { RegistryBuilder } from "./registry/RegistryBuilder";
import { JobEngine } from "./jobs/JobEngine";
import { AgentBuilder } from "./agents/AgentBuilder";
import { AgentRegistry } from "./agents/AgentRegistry";
import { AgentLifecycle } from "./agents/AgentLifecycle";
import { AgentContext } from "./agents/AgentContext";
import { WorkflowBuilder } from "./workflow/WorkflowBuilder";
import { WorkflowEngine } from "./workflow/WorkflowEngine";
import { JobPriority } from "./jobs/JobPriority";
import { ProviderBuilder } from "./providers/ProviderBuilder";
import { ProviderRegistry } from "./providers/ProviderRegistry";
import { ProviderHandler } from "./providers/Provider";
import { ProviderContext } from "./providers/ProviderContext";
import { ProviderResponse } from "./providers/ProviderResponse";
import { LLMRouter } from "./router/LLMRouter";
import { RouterContext } from "./router/RouterContext";
import { ModelDescriptor } from "./router/ModelDescriptor";
import { OrchestratorBuilder } from "./orchestrator/OrchestratorBuilder";
import { OrchestratorContext } from "./orchestrator/OrchestratorContext";
import { OrchestratorState } from "./orchestrator/OrchestratorState";
import {
  InvalidOrchestratorStateException,
  OrchestratorValidationException,
} from "./orchestrator/types";
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

// Simple test agent lifecycle
class SimpleAgentLifecycle implements AgentLifecycle {
  public async initialize(): Promise<void> {}
  public async execute(context: AgentContext, input?: unknown): Promise<unknown> {
    return `AgentProcessed: ${String(input)}`;
  }
  public async shutdown(): Promise<void> {}
}

// Dummy provider handler for LLM routing
class DummyLLMHandler implements ProviderHandler {
  public async execute(context: ProviderContext, request: any): Promise<ProviderResponse> {
    return {
      text: `RouterProcessed: ${request.prompt}`,
      finishReason: "stop",
      latency: 50,
      model: "test-model",
      provider: "test-provider",
    };
  }
}

async function runTests() {
  console.log("=== START AI ORCHESTRATOR VERIFICATION TESTS ===");

  // 1. Build and configure all required platform modules
  const config = await new ConfigBuilder({}).build();
  const eventBus = new EventBus(logger);
  const registry = new RegistryBuilder().build();
  const jobEngine = new JobEngine(logger, eventBus);
  const memoryStore = new MemoryStore();
  const agentRegistry = new AgentRegistry();
  const workflowEngine = new WorkflowEngine();
  const providerRegistry = new ProviderRegistry();

  const routerContext: RouterContext = {
    logger,
    providerRegistry,
    config,
  };
  const llmRouter = new LLMRouter(routerContext);

  const providerContext: ProviderContext = {
    logger,
    config,
    memoryStore,
    eventBus,
  };

  const agentContext: AgentContext = {
    logger,
    config,
    registry,
    eventBus,
    jobEngine,
    memoryStore,
  };

  // Start job engine (required for long-running workflows/jobs)
  await jobEngine.start();

  // Register a mock provider and model
  const provider = new ProviderBuilder()
    .withId("test-prov")
    .withName("Test Provider")
    .withContext(providerContext)
    .withHandler(new DummyLLMHandler())
    .withCapabilities({ chat: true })
    .build();
  providerRegistry.register(provider);

  const model: ModelDescriptor = {
    id: "test-model",
    providerId: "test-prov",
    capabilities: {
      chat: true,
      vision: false,
      imageGeneration: false,
      audioInput: false,
      audioOutput: false,
      toolCalling: false,
      jsonMode: false,
      streaming: false,
    },
    contextWindow: 1000,
    maxOutput: 500,
    costMetadata: { inputCostPer1K: 0.01, outputCostPer1K: 0.02 },
    latencyMetadata: { averageLatencyMs: 100 },
    enabled: true,
  };
  llmRouter.registerModel(model);

  // Register Agent for Direct execution test
  const directAgent = new AgentBuilder()
    .withId("agent-direct")
    .withName("Test Agent Direct")
    .withContext(agentContext)
    .withLifecycle(new SimpleAgentLifecycle())
    .build();
  agentRegistry.register(directAgent);

  // Register Agent for Job execution test
  const jobAgent = new AgentBuilder()
    .withId("agent-job")
    .withName("Test Agent Job")
    .withContext(agentContext)
    .withLifecycle(new SimpleAgentLifecycle())
    .build();
  agentRegistry.register(jobAgent);

  // Register Agent for Workflow Direct test
  const wfAgentDirect = new AgentBuilder()
    .withId("agent-wf-direct")
    .withName("Workflow Agent Direct")
    .withContext(agentContext)
    .withLifecycle(new SimpleAgentLifecycle())
    .build();
  agentRegistry.register(wfAgentDirect);

  // Register Agent for Workflow Job test
  const wfAgentJob = new AgentBuilder()
    .withId("agent-wf-job")
    .withName("Workflow Agent Job")
    .withContext(agentContext)
    .withLifecycle(new SimpleAgentLifecycle())
    .build();
  agentRegistry.register(wfAgentJob);

  // Register test workflows
  const workflowContext = {
    logger,
    config,
    registry,
    eventBus,
    jobEngine,
    memoryStore,
    agentRegistry,
  };

  const directWorkflow = new WorkflowBuilder()
    .withId("wf-direct")
    .withName("Test Workflow Direct")
    .withContext(workflowContext)
    .addStep({
      id: "step-1",
      name: "Run agent direct in workflow",
      agentId: "agent-wf-direct",
      priority: JobPriority.NORMAL,
      input: "WorkflowDirectInput",
    })
    .build();
  workflowEngine.register(directWorkflow);

  const jobWorkflow = new WorkflowBuilder()
    .withId("wf-job")
    .withName("Test Workflow Job")
    .withContext(workflowContext)
    .addStep({
      id: "step-1",
      name: "Run agent job in workflow",
      agentId: "agent-wf-job",
      priority: JobPriority.NORMAL,
      input: "WorkflowJobInput",
    })
    .build();
  workflowEngine.register(jobWorkflow);

  // 2. Build the Orchestrator
  const orchestratorContext: OrchestratorContext = {
    logger,
    config,
    registry,
    eventBus,
    jobEngine,
    memoryStore,
    agentRegistry,
    workflowEngine,
    llmRouter,
  };

  const orchestrator = new OrchestratorBuilder().withContext(orchestratorContext).build();

  assert(orchestrator.state === OrchestratorState.CREATED, "Orchestrator starts in CREATED state");

  // ==================================================
  // Test 1: Lifecycle transitions and Duplicate blocks
  // ==================================================
  console.log("\n1. Running Lifecycle State Tests...");
  try {
    await orchestrator.execute({ requestId: "req-1", taskName: "task", input: "inp" });
    throw new Error("Should not allow execution in CREATED state");
  } catch (err) {
    assert(err instanceof InvalidOrchestratorStateException, "Prevents execution before start");
  }

  await orchestrator.initialize();
  assert(orchestrator.state === OrchestratorState.READY, "Initializes successfully");

  try {
    await orchestrator.initialize();
    throw new Error("Should prevent double initialization");
  } catch (err) {
    assert(err instanceof InvalidOrchestratorStateException, "Duplicate initialization blocked");
  }

  await orchestrator.start();
  assert(orchestrator.state === OrchestratorState.RUNNING, "Starts successfully");

  try {
    await orchestrator.start();
    throw new Error("Should prevent duplicate start");
  } catch (err) {
    assert(err instanceof InvalidOrchestratorStateException, "Duplicate start blocked");
  }

  console.log("   ✓ Lifecycle states and duplicate prevention validated.");

  // ==================================================
  // Test 2: Validation constraints
  // ==================================================
  console.log("\n2. Running Request Validation Tests...");
  try {
    await orchestrator.execute({ requestId: "", taskName: "test", input: {} });
    throw new Error("Should reject empty request ID");
  } catch (err) {
    assert(
      err instanceof OrchestratorValidationException,
      "Throws validation error on empty request ID"
    );
  }
  console.log("   ✓ Request validation checks passed.");

  // Track event publications
  const publishedEvents: string[] = [];
  const handlerFn = async (event: any) => {
    publishedEvents.push(event.name);
  };
  eventBus.subscribe("orchestrator.execution.started", handlerFn);
  eventBus.subscribe("orchestrator.execution.completed", handlerFn);
  eventBus.subscribe("orchestrator.execution.failed", handlerFn);

  // ==================================================
  // Test 3: Agent Execution (Direct and Job wrapper)
  // ==================================================
  console.log("\n3. Running Agent Execution Tests...");
  const agentResponse = await orchestrator.execute({
    requestId: "req-agent-direct",
    taskName: "Agent Direct Task",
    agentId: "agent-direct",
    input: "Hello Agent Direct",
  });

  assert(agentResponse.success === true, "Agent execution direct succeeded");
  assert(agentResponse.output === "AgentProcessed: Hello Agent Direct", "Agent output matches");

  // Job Mode Execution
  const agentJobResponse = await orchestrator.execute({
    requestId: "req-agent-job",
    taskName: "Agent Job Task",
    agentId: "agent-job",
    input: "Hello Agent Job",
    metadata: { longRunning: true },
  });

  assert(agentJobResponse.success === true, "Agent execution as job succeeded");
  assert(agentJobResponse.output === "AgentProcessed: Hello Agent Job", "Agent job output matches");
  console.log("   ✓ Direct and Job-wrapped agent execution completed successfully.");

  // ==================================================
  // Test 4: Workflow Execution (Direct and Job wrapper)
  // ==================================================
  console.log("\n4. Running Workflow Execution Tests...");
  const workflowResponse = await orchestrator.execute({
    requestId: "req-wf-direct",
    taskName: "Workflow Direct Task",
    workflowId: "wf-direct",
    input: {},
  });

  assert(workflowResponse.success === true, "Workflow execution direct succeeded");
  assert(
    workflowResponse.output === "AgentProcessed: WorkflowDirectInput",
    "Workflow output matches"
  );

  const workflowJobResponse = await orchestrator.execute({
    requestId: "req-wf-job",
    taskName: "Workflow Job Task",
    workflowId: "wf-job",
    input: {},
    metadata: { longRunning: true },
  });

  assert(workflowJobResponse.success === true, "Workflow execution as job succeeded");
  assert(
    workflowJobResponse.output === "AgentProcessed: WorkflowJobInput",
    "Workflow job output matches"
  );
  console.log("   ✓ Direct and Job-wrapped workflow execution completed successfully.");

  // ==================================================
  // Test 5: LLM Router Execution (Direct and Job wrapper)
  // ==================================================
  console.log("\n5. Running Router Routing Execution Tests...");
  const routerResponse = await orchestrator.execute({
    requestId: "req-router-direct",
    taskName: "Router Direct Task",
    input: "Query LLM",
  });

  assert(routerResponse.success === true, "Router prompt direct execution succeeded");
  assert(routerResponse.output === "RouterProcessed: Query LLM", "Router output matches");

  const routerJobResponse = await orchestrator.execute({
    requestId: "req-router-job",
    taskName: "Router Job Task",
    input: "Query LLM Job",
    metadata: { longRunning: true },
  });

  assert(routerJobResponse.success === true, "Router prompt job execution succeeded");
  assert(
    routerJobResponse.output === "RouterProcessed: Query LLM Job",
    "Router job output matches"
  );
  console.log("   ✓ Direct and Job-wrapped router routing completed successfully.");

  // ==================================================
  // Test 6: Event emission verification
  // ==================================================
  console.log("\n6. Running Event Emission Tests...");
  // Allow brief tick for subscriptions
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert(
    publishedEvents.includes("orchestrator.execution.started"),
    "ExecutionStarted event published"
  );
  assert(
    publishedEvents.includes("orchestrator.execution.completed"),
    "ExecutionCompleted event published"
  );
  console.log("   ✓ Event publications verified.");

  // ==================================================
  // Test 7: Memory recording verification
  // ==================================================
  console.log("\n7. Running Memory Metadata Storage Tests...");
  // We executed multiple requests. Let's retrieve metadata of one of them.
  const storedEntry = await memoryStore.get<any>(
    "orchestrator",
    `execution:${agentResponse.executionId}`
  );
  assert(storedEntry !== undefined, "Metadata registered in memory store");

  const metadata = storedEntry!.value;
  assert(metadata.requestId === "req-agent-direct", "Request ID in metadata matches");
  assert(metadata.success === true, "Success flag matches");
  assert(metadata.duration >= 0, "Execution duration is recorded");
  assert(metadata.input === undefined, "Request input is NOT stored (no prompts)");
  assert(metadata.output === undefined, "Execution output is NOT stored (no outputs)");
  console.log("   ✓ Orchestrator memory records only execution metadata safely.");

  // ==================================================
  // Test 8: Snapshot immutability
  // ==================================================
  console.log("\n8. Running Snapshot Tests...");
  const snap = orchestrator.snapshot();
  assert(snap.state === OrchestratorState.RUNNING, "Snapshot state matches");
  assert(snap.totalExecutionsProcessed === 6, "Total executions processed count matches");

  assert(Object.isFrozen(snap), "Snapshot is frozen");
  try {
    (snap as any).state = OrchestratorState.FAILED;
    throw new Error("Should prevent snapshot mutation");
  } catch (err) {
    // correctly threw mutation error
  }
  console.log("   ✓ Snapshot data matches and is fully frozen.");

  // ==================================================
  // Test 9: Shutdown duplicate prevention
  // ==================================================
  console.log("\n9. Running Shutdown Lifecycle Tests...");
  await orchestrator.stop();
  assert(orchestrator.state === OrchestratorState.STOPPED, "Stopped successfully");

  try {
    await orchestrator.stop();
    throw new Error("Should prevent duplicate stops");
  } catch (err) {
    assert(err instanceof InvalidOrchestratorStateException, "Duplicate stop blocked");
  }

  // Gracefully stop job engine
  await jobEngine.stop();

  console.log("\n=== ALL AI ORCHESTRATOR TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
