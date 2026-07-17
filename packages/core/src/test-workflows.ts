import {
  LoggerBuilder,
  ConsoleTransport,
  JsonFormatter,
  ConfigBuilder,
  RegistryBuilder,
  EventBus,
  JobEngine,
  MemoryStore,
  ProviderRegistry,
  ToolBuilder,
  ToolRegistry,
  AgentRegistry,
  AIEngineBuilder,
  AITaskType,
  ProviderState,
  IProviderTransport,
  ProviderContext,
  TransportBuilder,
  IAgent,
  AgentState,
  AgentContext,
  AgentSnapshot,
  IToolHandler,
  ToolContext,
  ToolRequest,
  ToolResponse,
  ToolCapability,
} from "./index";

import {
  WorkflowEngine,
  WorkflowBuilder,
  WorkflowStepBuilder,
  WorkflowState,
  WorkflowStepType,
  WorkflowConditionOperator,
  WorkflowTriggerType,
  WorkflowValidationException,
  InvalidWorkflowStateException,
  deepFreeze,
  WorkflowContext as EngineContext,
} from "./workflows/index";

import { IRAGEngine } from "./rag/IRAGEngine";
import { RAGContext } from "./rag/RAGContext";
import { RAGRequest } from "./rag/RAGRequest";
import { RAGResponse } from "./rag/RAGResponse";
import { RAGSnapshot } from "./rag/RAGSnapshot";
import { RetrievalStrategy } from "./rag/RetrievalStrategy";

import { ILLMRouter } from "./router/ILLMRouter";
import { RouterRequest } from "./router/RouterRequest";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// MOCK CLASSES
// -------------------------------------------------------------

class MockRAGEngine implements IRAGEngine {
  public readonly context: RAGContext = {} as any;

  public async retrieve(request: RAGRequest): Promise<RAGResponse> {
    return {
      context: "Retrieved context for " + request.query,
      documents: [
        {
          documentId: "doc1",
          chunkId: "chunk1",
          text: "Retrieved context for " + request.query,
          score: 0.95,
          metadata: {} as any,
        },
      ],
      strategyUsed: request.strategy,
      executionTime: 5,
    };
  }

  public snapshot(): RAGSnapshot {
    return {
      knowledgeBaseId: "mock-kb",
      promptsCount: 0,
      contextWindow: {} as any,
      timestamp: new Date(),
      metadata: {},
    };
  }
}

class MockAgent implements IAgent {
  public readonly id = "mock-agent";
  public readonly name = "Mock Agent";
  public readonly version = "1.0.0";
  public readonly description = "Mock Agent for testing";
  public readonly role = "Tester";
  public readonly capabilities = ["test"];
  public readonly goals = [];
  public readonly metadata = {};
  public state = AgentState.CREATED;

  constructor(public readonly context: AgentContext) {}

  public async initialize(): Promise<void> {
    this.state = AgentState.READY;
  }

  public async start(): Promise<void> {
    this.state = AgentState.RUNNING;
  }

  public async pause(): Promise<void> {
    this.state = AgentState.PAUSED;
  }

  public async resume(): Promise<void> {
    this.state = AgentState.RUNNING;
  }

  public async stop(): Promise<void> {
    this.state = AgentState.STOPPED;
  }

  public async execute(input?: any): Promise<any> {
    this.state = AgentState.RUNNING;
    const result = { echoAgent: input?.val };
    this.state = AgentState.COMPLETED;
    return result;
  }

  public async shutdown(): Promise<void> {
    this.state = AgentState.STOPPED;
  }

  public async installSkill(skill: any): Promise<void> {}
  public async removeSkill(skillId: string): Promise<void> {}
  public async enableSkill(skillId: string): Promise<void> {}
  public async disableSkill(skillId: string): Promise<void> {}
  public async executeSkill(skillId: string, input?: unknown): Promise<unknown> { return {}; }
  public listSkills(): ReadonlyArray<any> { return []; }
  public async selectExecutionOption<T extends { id: string; name: string }>(
    type: any,
    options: T[],
    criteria?: any[]
  ): Promise<T> {
    return options[0];
  }

  public snapshot(): AgentSnapshot {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      version: this.version,
      description: this.description,
      state: this.state,
      capabilities: this.capabilities,
      goals: this.goals,
      metadata: this.metadata,
      timestamp: new Date(),
    };
  }
}

class MockToolHandler implements IToolHandler {
  public execute(request: ToolRequest, context: ToolContext): ToolResponse {
    return {
      success: true,
      output: { echoed: request.input.val },
      executionTime: 5,
      error: null,
      metadata: {},
    };
  }
}

class MockLLMRouter implements ILLMRouter {
  public routeCalls: any[] = [];
  public registerModel(): void {}
  public unregisterModel(): boolean {
    return true;
  }
  public async route(request: RouterRequest): Promise<any> {
    this.routeCalls.push(request);
    return {
      providerId: "mock-provider",
      modelId: "mock-model",
      providerResponse: {
        responseId: "mock-llm-resp",
        content: "AI response for: " + request.prompt,
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        latency: 100,
      },
      routingReason: "test",
      latency: 100,
    };
  }
  public async *routeStream(request: RouterRequest): AsyncGenerator<any> {}
  public snapshot(): any {
    return {};
  }
}

// -------------------------------------------------------------
// TEST SUITE
// -------------------------------------------------------------

async function runTests() {
  console.log("=== START WORKFLOW FRAMEWORK TESTS ===");

  // 1. Setup DI Context
  const formatter = new JsonFormatter();
  const logger = new LoggerBuilder()
    .addTransport(new ConsoleTransport(formatter))
    .withFormatter(formatter)
    .build();

  const config = await new ConfigBuilder({}).build();
  const registry = new RegistryBuilder().build();
  const eventBus = new EventBus(logger);
  const jobs = new JobEngine(logger, eventBus);
  const memory = new MemoryStore();
  const providers = new ProviderRegistry();

  const mockRouter = new MockLLMRouter();
  const aiEngine = new AIEngineBuilder()
    .withRouter(mockRouter)
    .build();

  await aiEngine.initialize();
  await aiEngine.start();

  const toolRegistry = new ToolRegistry();
  const agentRegistry = new AgentRegistry();
  const ragEngine = new MockRAGEngine();

  const toolCtx: ToolContext = {
    logger,
    config,
    registry,
    eventBus,
    memory,
    jobs,
    providers,
    router: mockRouter,
  };

  // Register a mock tool
  const mockTool = new ToolBuilder()
    .withId("mock-tool")
    .withName("Mock Tool")
    .withDescription("Mock tool for testing")
    .withVersion("1.0.0")
    .withAuthor("Test Author")
    .withCapability(ToolCapability.UTILITY)
    .withContext(toolCtx)
    .withHandler(new MockToolHandler())
    .build();
  await toolRegistry.register(mockTool);
  await mockTool.initialize();

  // Register a mock agent
  const agentCtx: AgentContext = { logger, config, registry, eventBus, memoryStore: memory, jobEngine: jobs };
  const mockAgent = new MockAgent(agentCtx);
  await agentRegistry.register(mockAgent);

  const engineContext: EngineContext = {
    logger,
    config,
    eventBus,
    memory,
    registry,
    aiEngine,
    toolRegistry,
    agentRegistry,
    ragEngine,
  };

  const workflowEngine = new WorkflowEngine(engineContext);

  // ==========================================
  // 1. Verifying Workflow Builder
  // ==========================================
  console.log("\n1. Verifying Workflow Builder...");
  const sampleWorkflow = new WorkflowBuilder()
    .withId("wf-test-1")
    .withName("Test Workflow 1")
    .withDescription("A workflow for verification")
    .withVersion("1.1.0")
    .withManualTrigger()
    .withVariable("inputVal", "string", "hello")
    .withVariable("counter", "number", 0)
    .withVariable("outputVal", "string")
    .addStep(
      WorkflowStepBuilder.prompt("step1", "Generate prompt text")
        .withConfig("templateText", "Greet: {{inputVal}}")
        .build()
    )
    .addStep(
      WorkflowStepBuilder.variableAssignment("step2", "Assign output")
        .withConfig("assignments", [
          { variableName: "outputVal", valueExpression: "$.steps.step1.output.text" },
        ])
        .build()
    )
    .build();

  assert(sampleWorkflow.id === "wf-test-1", "Workflow ID mismatch");
  assert(sampleWorkflow.name === "Test Workflow 1", "Workflow Name mismatch");
  assert(sampleWorkflow.version === "1.1.0", "Workflow Version mismatch");
  assert(sampleWorkflow.trigger?.type === WorkflowTriggerType.MANUAL, "Trigger type mismatch");
  assert(sampleWorkflow.variables?.length === 3, "Variables count mismatch");
  assert(sampleWorkflow.steps.length === 2, "Steps count mismatch");
  console.log("   ✓ Workflow builder verified.");

  // ==========================================
  // 2. Verifying Registration
  // ==========================================
  console.log("\n2. Verifying Workflow Registration...");
  assert(workflowEngine.state === WorkflowState.CREATED, "Should be in CREATED state initially");

  await workflowEngine.initialize();
  assert(workflowEngine.state === WorkflowState.READY, "Should be in READY state after initialize");

  await workflowEngine.register(sampleWorkflow);
  assert(workflowEngine.has("wf-test-1") === true, "Workflow should be registered");
  assert(workflowEngine.get("wf-test-1")?.name === "Test Workflow 1", "Retrieve workflow definition mismatch");

  // Duplicate registration check
  try {
    await workflowEngine.register(sampleWorkflow);
    assert(false, "Duplicate registration should fail");
  } catch (err: any) {
    assert(
      err instanceof WorkflowValidationException,
      "Expected WorkflowValidationException for duplicate ID"
    );
  }

  await workflowEngine.unregister("wf-test-1");
  assert(workflowEngine.has("wf-test-1") === false, "Workflow should be unregistered");
  console.log("   ✓ Registration checks passed.");

  // Re-register for execution tests
  await workflowEngine.register(sampleWorkflow);

  // ==========================================
  // 3. Verifying Lifecycle & Illegal State Transitions
  // ==========================================
  console.log("\n3. Verifying Lifecycle state machine...");
  // Attempt execute in READY state (should fail)
  try {
    await workflowEngine.execute("wf-test-1");
    assert(false, "Should not execute in READY state");
  } catch (err: any) {
    assert(
      err instanceof InvalidWorkflowStateException,
      "Expected InvalidWorkflowStateException when executing in READY state"
    );
  }

  // Start engine
  await workflowEngine.start();
  assert(workflowEngine.state === WorkflowState.RUNNING, "Engine should transition to RUNNING state");

  // Attempt initialize/start in RUNNING state (should fail)
  try {
    await workflowEngine.initialize();
    assert(false, "Should not initialize twice");
  } catch (err: any) {
    assert(err instanceof InvalidWorkflowStateException, "Expected exception initializing twice");
  }

  try {
    await workflowEngine.start();
    assert(false, "Should not start twice");
  } catch (err: any) {
    assert(err instanceof InvalidWorkflowStateException, "Expected exception starting twice");
  }
  console.log("   ✓ Lifecycle transitions verified.");

  // ==========================================
  // 4. Verifying Sequential execution and Variable propagation
  // ==========================================
  console.log("\n4. Verifying Sequential execution and Variable propagation...");
  const execResult = await workflowEngine.execute("wf-test-1", { inputVal: "Gemini AI" });
  assert(execResult.status === "COMPLETED", "Execution status should be COMPLETED");
  assert(execResult.variables.outputVal === "Greet: Gemini AI", "Variable propagation failed");
  assert(execResult.history.length === 2, "History count mismatch");
  assert(execResult.statistics.stepCount === 2, "Step count mismatch");
  assert(execResult.statistics.durationMs >= 0, "Duration should be non-negative");
  console.log("   ✓ Sequential run and variables propagation verified.");

  // ==========================================
  // 5. Verifying Parallel execution
  // ==========================================
  console.log("\n5. Verifying Parallel execution...");
  const parallelWorkflow = new WorkflowBuilder()
    .withId("wf-parallel")
    .withName("Parallel Test")
    .withDescription("")
    .withManualTrigger()
    .withVariable("var1", "string", "")
    .withVariable("var2", "string", "")
    .addStep(
      WorkflowStepBuilder.parallelBranch("p1", "Parallel Steps")
        .withConfig("parallelBranches", [
          [
            WorkflowStepBuilder.variableAssignment("branch1_assign", "Assign var1")
              .withConfig("assignments", [{ variableName: "var1", valueExpression: "done1" }])
              .build(),
          ],
          [
            WorkflowStepBuilder.variableAssignment("branch2_assign", "Assign var2")
              .withConfig("assignments", [{ variableName: "var2", valueExpression: "done2" }])
              .build(),
          ],
        ])
        .build()
    )
    .build();

  await workflowEngine.register(parallelWorkflow);
  const parallelRes = await workflowEngine.execute("wf-parallel");
  assert(parallelRes.status === "COMPLETED", "Parallel run should complete");
  assert(parallelRes.variables.var1 === "done1", "var1 was not updated");
  assert(parallelRes.variables.var2 === "done2", "var2 was not updated");
  console.log("   ✓ Parallel execution verified.");

  // ==========================================
  // 6. Verifying Conditions and Branches
  // ==========================================
  console.log("\n6. Verifying Conditions and Branches...");
  const conditionalWf = new WorkflowBuilder()
    .withId("wf-cond")
    .withName("Conditional Workflow")
    .withDescription("")
    .withManualTrigger()
    .withVariable("flag", "boolean", true)
    .withVariable("branchTaken", "string", "")
    .addStep(
      WorkflowStepBuilder.conditionalBranch("condStep", "Branch Check")
        .withConfig("conditions", [
          { variableName: "flag", operator: WorkflowConditionOperator.EQUALS, value: true },
        ])
        .withConfig("thenSteps", [
          WorkflowStepBuilder.variableAssignment("tassign", "assign true")
            .withConfig("assignments", [{ variableName: "branchTaken", valueExpression: "thenBranch" }])
            .build(),
        ])
        .withConfig("elseSteps", [
          WorkflowStepBuilder.variableAssignment("eassign", "assign false")
            .withConfig("assignments", [{ variableName: "branchTaken", valueExpression: "elseBranch" }])
            .build(),
        ])
        .build()
    )
    .build();

  await workflowEngine.register(conditionalWf);

  // Then branch test
  const condResThen = await workflowEngine.execute("wf-cond", { flag: true });
  assert(condResThen.variables.branchTaken === "thenBranch", "Should execute THEN steps");

  // Else branch test
  const condResElse = await workflowEngine.execute("wf-cond", { flag: false });
  assert(condResElse.variables.branchTaken === "elseBranch", "Should execute ELSE steps");
  console.log("   ✓ Conditions and branching verified.");

  // ==========================================
  // 7. Verifying Loops
  // ==========================================
  console.log("\n7. Verifying Loops...");
  const loopWf = new WorkflowBuilder()
    .withId("wf-loop")
    .withName("Loop Test")
    .withDescription("")
    .withManualTrigger()
    .withVariable("counter", "number", 0)
    .addStep(
      WorkflowStepBuilder.loop("loopStep", "Loop until 3")
        .withConfig("loopCondition", {
          variableName: "counter",
          operator: WorkflowConditionOperator.LESS_THAN,
          value: 3,
        })
        .withConfig("loopSteps", [
          WorkflowStepBuilder.variableAssignment("incCounter", "Increment counter")
            .withConfig("assignments", [
              { variableName: "counter", valueExpression: "$.variables.counter" },
            ])
            .build(),
        ])
        .build()
    )
    .build();

  await workflowEngine.register(loopWf);
  const loopRes = await workflowEngine.execute("wf-loop", { counter: 0 });
  assert(loopRes.status === "COMPLETED", "Loop run should complete");
  assert(loopRes.variables.counter === 3, "Counter should loop until 3");
  console.log("   ✓ Loop execution verified.");

  // ==========================================
  // 8. Verifying Tool Execution
  // ==========================================
  console.log("\n8. Verifying Tool Execution...");
  const toolWf = new WorkflowBuilder()
    .withId("wf-tool")
    .withName("Tool Test")
    .withDescription("")
    .withManualTrigger()
    .withVariable("toolInput", "string", "hello-tool")
    .withVariable("toolOutput", "string", "")
    .addStep(
      WorkflowStepBuilder.toolCall("toolStep", "Call mock-tool")
        .withConfig("toolId", "mock-tool")
        .withConfig("parameterMapping", { val: "$.variables.toolInput" })
        .withConfig("resultMapping", { toolOutput: "$.output.echoed" })
        .build()
    )
    .build();

  await workflowEngine.register(toolWf);
  const toolRes = await workflowEngine.execute("wf-tool");
  assert(toolRes.status === "COMPLETED", "Tool run should complete");
  assert(toolRes.variables.toolOutput === "hello-tool", "Tool output mapping failed");
  console.log("   ✓ Tool execution verified.");

  // ==========================================
  // 9. Verifying Agent Execution
  // ==========================================
  console.log("\n9. Verifying Agent Execution...");
  const agentWf = new WorkflowBuilder()
    .withId("wf-agent")
    .withName("Agent Test")
    .withDescription("")
    .withManualTrigger()
    .withVariable("agentInput", "string", "hello-agent")
    .withVariable("agentOutput", "string", "")
    .addStep(
      WorkflowStepBuilder.agentExecution("agentStep", "Call mock-agent")
        .withConfig("agentId", "mock-agent")
        .withConfig("agentInputMapping", { val: "$.variables.agentInput" })
        .withConfig("agentOutputMapping", { agentOutput: "$.echoAgent" })
        .build()
    )
    .build();

  await workflowEngine.register(agentWf);
  const agentRes = await workflowEngine.execute("wf-agent");
  assert(agentRes.status === "COMPLETED", "Agent run should complete");
  assert(agentRes.variables.agentOutput === "hello-agent", "Agent output mapping failed");
  console.log("   ✓ Agent execution verified.");

  // ==========================================
  // 10. Verifying AI Execution
  // ==========================================
  console.log("\n10. Verifying AI Execution...");
  const aiWf = new WorkflowBuilder()
    .withId("wf-ai")
    .withName("AI Completion Test")
    .withDescription("")
    .withManualTrigger()
    .withVariable("prompt", "string", "What is the capital of France?")
    .addStep(
      WorkflowStepBuilder.aiCompletion("aiStep", "Call AI Engine")
        .withConfig("modelId", "test-model")
        .withConfig("temperature", 0.7)
        .build()
    )
    .build();

  await workflowEngine.register(aiWf);
  const aiRes = await workflowEngine.execute("wf-ai");
  assert(aiRes.status === "COMPLETED", "AI run should complete");
  assert(aiRes.output.includes("AI response for:"), "AI output mismatch");
  assert(aiRes.statistics.aiCallsCount === 1, "AI calls statistics count mismatch");
  assert(aiRes.statistics.tokensUsed === 25, "AI token usage statistics mismatch");
  console.log("   ✓ AI execution verified.");

  // ==========================================
  // 11. Verifying RAG Execution
  // ==========================================
  console.log("\n11. Verifying RAG Execution...");
  const ragWf = new WorkflowBuilder()
    .withId("wf-rag")
    .withName("RAG Retrieval Test")
    .withDescription("")
    .withManualTrigger()
    .withVariable("query", "string", "TypeScript Workflows")
    .addStep(
      WorkflowStepBuilder.ragRetrieval("ragStep", "Call RAG Engine")
        .withConfig("query", "$.variables.query")
        .withConfig("strategy", RetrievalStrategy.HYBRID)
        .build()
    )
    .build();

  await workflowEngine.register(ragWf);
  const ragRes = await workflowEngine.execute("wf-rag");
  assert(ragRes.status === "COMPLETED", "RAG run should complete");
  assert(ragRes.output === "Retrieved context for TypeScript Workflows", "RAG output context mismatch");
  console.log("   ✓ RAG execution verified.");

  // ==========================================
  // 12. Verifying Variable Propagation
  // ==========================================
  console.log("\n12. Verifying Variable Propagation...");
  const propWf = new WorkflowBuilder()
    .withId("wf-prop")
    .withName("Propagation Test")
    .withDescription("")
    .withManualTrigger()
    .withVariable("varA", "string", "valueA")
    .withVariable("varB", "string", "")
    .addStep(
      WorkflowStepBuilder.prompt("stepA", "Step A")
        .withConfig("templateText", "Source: {{varA}}")
        .build()
    )
    .addStep(
      WorkflowStepBuilder.variableAssignment("stepB", "Step B")
        .withConfig("assignments", [
          { variableName: "varB", valueExpression: "$.steps.stepA.output.text" }
        ])
        .build()
    )
    .build();

  await workflowEngine.register(propWf);
  const propRes = await workflowEngine.execute("wf-prop");
  assert(propRes.status === "COMPLETED", "Propagation run should complete");
  assert(propRes.variables.varB === "Source: valueA", "varB should receive value from stepA output");
  console.log("   ✓ Variable propagation verified.");

  // ==========================================
  // 13. Verifying Failure Handling & Rollback
  // ==========================================
  console.log("\n13. Verifying Failure Handling and Rollback...");
  const testState = { rollbackExecuted: false };

  const failingTool1 = new ToolBuilder()
    .withId("failing-tool-1")
    .withName("Failing Tool 1")
    .withDescription("Failing tool for testing")
    .withVersion("1.0.0")
    .withAuthor("Test Author")
    .withCapability(ToolCapability.UTILITY)
    .withContext(toolCtx)
    .withHandler({
      execute: (): ToolResponse => {
        return {
          success: false,
          output: null,
          executionTime: 0,
          error: new Error("Tool execution failed simulated"),
          metadata: {},
        };
      }
    })
    .build();
  await toolRegistry.register(failingTool1);
  await failingTool1.initialize();

  const failingTool2 = new ToolBuilder()
    .withId("failing-tool-2")
    .withName("Failing Tool 2")
    .withDescription("Failing tool for testing")
    .withVersion("1.0.0")
    .withAuthor("Test Author")
    .withCapability(ToolCapability.UTILITY)
    .withContext(toolCtx)
    .withHandler({
      execute: (): ToolResponse => {
        return {
          success: false,
          output: null,
          executionTime: 0,
          error: new Error("Tool execution failed simulated"),
          metadata: {},
        };
      }
    })
    .build();
  await toolRegistry.register(failingTool2);
  await failingTool2.initialize();

  const rollbackTool = new ToolBuilder()
    .withId("rollback-tool")
    .withName("Rollback Tool")
    .withDescription("Rollback tool for testing")
    .withVersion("1.0.0")
    .withAuthor("Test Author")
    .withCapability(ToolCapability.UTILITY)
    .withContext(toolCtx)
    .withHandler({
      execute: (): ToolResponse => {
        testState.rollbackExecuted = true;
        return {
          success: true,
          output: {},
          executionTime: 0,
          error: null,
          metadata: {},
        };
      }
    })
    .build();
  await toolRegistry.register(rollbackTool);
  await rollbackTool.initialize();

  const failContinueWf = new WorkflowBuilder()
    .withId("wf-fail-continue")
    .withName("Failure Continue Test")
    .withManualTrigger()
    .addStep(
      WorkflowStepBuilder.toolCall("failStep", "Failing Step")
        .withConfig("toolId", "failing-tool-1")
        .onFailure("continue")
        .build()
    )
    .build();

  await workflowEngine.register(failContinueWf);
  const continueRes = await workflowEngine.execute("wf-fail-continue");
  assert(continueRes.status === "COMPLETED", "Should complete with COMPLETED status under continue handler");
  assert(continueRes.history[0].status === "COMPLETED", "Step status should be marked COMPLETED");

  const rollbackWf = new WorkflowBuilder()
    .withId("wf-rollback")
    .withName("Failure Rollback Test")
    .withManualTrigger()
    .addStep(
      WorkflowStepBuilder.toolCall("rollbackActionStep", "Rollback Trigger action")
        .withConfig("toolId", "rollback-tool")
        .build()
    )
    .addStep(
      WorkflowStepBuilder.toolCall("failActionStep", "Failing action")
        .withConfig("toolId", "failing-tool-2")
        .onFailure("rollback", "rollbackActionStep")
        .build()
    )
    .build();

  await workflowEngine.register(rollbackWf);
  const rollbackRes = await workflowEngine.execute("wf-rollback");
  assert(rollbackRes.status === "FAILED", "Rollback workflow execution should have FAILED status");
  assert(testState.rollbackExecuted === true, "Rollback step should have executed");
  console.log("   ✓ Failure handling and rollback verified.");

  // ==========================================
  // 14. Verifying Retry Policy
  // ==========================================
  console.log("\n14. Verifying Retry Policy...");
  let callCount = 0;
  const flakeyTool = new ToolBuilder()
    .withId("flakey-tool")
    .withName("Flakey Tool")
    .withDescription("Flakey tool for testing")
    .withVersion("1.0.0")
    .withAuthor("Test Author")
    .withCapability(ToolCapability.UTILITY)
    .withContext(toolCtx)
    .withHandler({
      execute: (): ToolResponse => {
        callCount++;
        if (callCount < 3) {
          return {
            success: false,
            output: null,
            executionTime: 0,
            error: new Error("Flakey failure"),
            metadata: {},
          };
        }
        return {
          success: true,
          output: { echoed: "flakey-success" },
          executionTime: 0,
          error: null,
          metadata: {},
        };
      }
    })
    .build();
  await toolRegistry.register(flakeyTool);
  await flakeyTool.initialize();

  const retryWf = new WorkflowBuilder()
    .withId("wf-retry")
    .withName("Retry Test")
    .withManualTrigger()
    .withVariable("retryOutput", "string", "")
    .addStep(
      WorkflowStepBuilder.toolCall("flakeyStep", "Flakey tool execution")
        .withConfig("toolId", "flakey-tool")
        .withConfig("parameterMapping", { val: "test" })
        .withConfig("resultMapping", { retryOutput: "$.output.echoed" })
        .withRetryPolicy(3, 5)
        .build()
    )
    .build();

  await workflowEngine.register(retryWf);
  const retryRes = await workflowEngine.execute("wf-retry");
  assert(retryRes.status === "COMPLETED", "Retry run should succeed");
  assert(retryRes.variables.retryOutput === "flakey-success", "Retry output mismatch");
  assert(retryRes.history[0].retriesUsed === 2, "Retries count mismatch");
  console.log("   ✓ Retry policy verified.");

  // ==========================================
  // 15. Verifying Cancellation
  // ==========================================
  console.log("\n15. Verifying Cancellation...");
  const delayWf = new WorkflowBuilder()
    .withId("wf-delay")
    .withName("Delay Cancellation Test")
    .withManualTrigger()
    .addStep(
      WorkflowStepBuilder.delay("delayStep", "Delay step")
        .withConfig("durationMs", 500)
        .build()
    )
    .build();

  await workflowEngine.register(delayWf);
  const cancelPromise = workflowEngine.execute("wf-delay");
  
  await new Promise((resolve) => setTimeout(resolve, 50));
  const activeSnaps = workflowEngine.snapshot();
  assert(activeSnaps.activeExecutions === 1, "Should have 1 active execution");
  const execKey = (workflowEngine as any)._activeExecutionsMap.keys().next().value;
  assert(execKey !== undefined, "Should find execution key");
  workflowEngine.cancelExecution(execKey);

  const cancelRes = await cancelPromise;
  assert(cancelRes.status === "CANCELLED", "Cancelled execution should have CANCELLED status");
  console.log("   ✓ Cancellation verified.");

  // ==========================================
  // 16. Verifying Timeouts
  // ==========================================
  console.log("\n16. Verifying Timeouts...");
  const timeoutWf = new WorkflowBuilder()
    .withId("wf-timeout")
    .withName("Timeout Test")
    .withManualTrigger()
    .addStep(
      WorkflowStepBuilder.delay("timeoutStep", "Timeout delay step")
        .withConfig("durationMs", 1000)
        .withTimeout(20)
        .build()
    )
    .build();

  await workflowEngine.register(timeoutWf);
  const timeoutRes = await workflowEngine.execute("wf-timeout");
  assert(timeoutRes.status === "FAILED", "Timeout execution should have FAILED status");
  assert(!!(timeoutRes.error?.includes("exceeded") || timeoutRes.error?.includes("Timeout")), "Expected timeout error message");
  console.log("   ✓ Timeouts verified.");

  // ==========================================
  // 17. Verifying Snapshot Immutability
  // ==========================================
  console.log("\n17. Verifying Snapshot Immutability...");
  const snap = workflowEngine.snapshot();
  assert(snap.state === WorkflowState.RUNNING, "Engine state mismatch in snapshot");
  assert(Object.isFrozen(snap), "Snapshot should be frozen");
  try {
    (snap as any).state = WorkflowState.STOPPED;
    assert(false, "Snapshot mutation should throw TypeError");
  } catch (err: any) {
    assert(err instanceof TypeError, "Expected TypeError on snapshot mutation");
  }
  console.log("   ✓ Snapshot immutability verified.");

  // ==========================================
  // 18. Verifying Validator Rules
  // ==========================================
  console.log("\n18. Verifying Validator rules...");
  // Empty ID
  try {
    const invalidWf = new WorkflowBuilder().withId("").withName("No ID").build();
    await workflowEngine.register(invalidWf);
    assert(false, "Empty ID should fail validation");
  } catch (err: any) {
    assert(err instanceof WorkflowValidationException, "Expected WorkflowValidationException");
  }

  // Duplicate Step IDs
  try {
    const invalidWf = new WorkflowBuilder()
      .withId("wf-dup-steps")
      .withName("Dup Steps")
      .addStep(WorkflowStepBuilder.prompt("stepA", "A").build())
      .addStep(WorkflowStepBuilder.prompt("stepA", "Duplicate A").build())
      .build();
    await workflowEngine.register(invalidWf);
    assert(false, "Duplicate step IDs should fail validation");
  } catch (err: any) {
    assert(err instanceof WorkflowValidationException, "Expected WorkflowValidationException");
  }

  // Circular Step references
  try {
    const step: any = { id: "stepA", name: "A", type: WorkflowStepType.SEQUENTIAL_BRANCH };
    step.sequentialSteps = [step];
    const invalidWf = new WorkflowBuilder()
      .withId("wf-circular")
      .withName("Circular Steps")
      .addStep(step)
      .build();
    await workflowEngine.register(invalidWf);
    assert(false, "Circular steps should fail validation");
  } catch (err: any) {
    assert(err instanceof WorkflowValidationException, "Expected WorkflowValidationException");
  }
  console.log("   ✓ Validator rules verified.");

  // Stop Engine
  await workflowEngine.stop();
  assert(workflowEngine.state === WorkflowState.STOPPED, "Engine should transition to STOPPED state");

  console.log("\n=== ALL WORKFLOW FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution aborted:", err);
  process.exit(1);
});
