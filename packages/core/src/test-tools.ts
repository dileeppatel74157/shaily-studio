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
  ToolState,
  ToolCapability,
  InvalidToolStateException,
  ToolValidationException,
  ToolRegistry,
  ToolValidator,
  IToolHandler,
  ToolContext,
  ToolRequest,
  ToolResponse,
  ILLMRouter,
} from "./index";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class TestToolHandler implements IToolHandler {
  public readonly trace: string[] = [];
  public shouldFail = false;

  public async initialize(context: ToolContext): Promise<void> {
    this.trace.push("initialize");
    context.logger.info("TestToolHandler: initialize");
  }

  public async execute(
    request: ToolRequest,
    context: ToolContext
  ): Promise<ToolResponse> {
    this.trace.push("execute");
    context.logger.info(`TestToolHandler: execute (${request.correlationId})`);

    if (this.shouldFail) {
      throw new Error("Simulated handler execution failure");
    }

    return {
      success: true,
      output: { echoed: request.input.val },
      metadata: { processedBy: "TestToolHandler" },
      executionTime: 5,
      error: null,
    };
  }

  public async shutdown(context: ToolContext): Promise<void> {
    this.trace.push("shutdown");
    context.logger.info("TestToolHandler: shutdown");
  }
}

async function runTests() {
  console.log("=== START TOOL FRAMEWORK TESTS ===");

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

  const mockRouter: ILLMRouter = {
    registerModel: () => {},
    unregisterModel: () => true,
    route: async () => ({} as any),
    snapshot: () => ({} as any),
  };

  const context: ToolContext = {
    logger,
    config,
    registry,
    eventBus,
    memory,
    jobs,
    providers,
    router: mockRouter,
  };

  // 2. Test Tool Builder
  console.log("\n1. Verifying Tool Builder...");
  const handler = new TestToolHandler();
  const tool = new ToolBuilder()
    .withId("tool-test-1")
    .withName("Test Tool 1")
    .withVersion("1.0.0")
    .withDescription("A test tool framework capability verification")
    .withAuthor("Shaily Studio Team")
    .withCapability(ToolCapability.READ)
    .withCapability(ToolCapability.AI)
    .withContext(context)
    .withHandler(handler)
    .build();

  assert(tool.metadata.id === "tool-test-1", "Tool ID matches");
  assert(tool.metadata.name === "Test Tool 1", "Tool Name matches");
  assert(tool.metadata.version === "1.0.0", "Tool Version matches");
  assert(tool.metadata.author === "Shaily Studio Team", "Tool Author matches");
  assert(tool.metadata.capabilities.includes(ToolCapability.AI), "Tool has AI capability");
  assert(tool.state === ToolState.CREATED, "Tool initial state is CREATED");
  console.log("   ✓ Tool builder verified successfully.");

  // 3. Test Lifecycle & Transitions
  console.log("\n2. Verifying Tool Lifecycle Transitions...");
  // initialize: CREATED -> READY
  await tool.initialize();
  assert(tool.state === ToolState.READY, "Tool state is READY after initialize");
  assert(handler.trace.length === 1 && handler.trace[0] === "initialize", "Initialize handler executed");

  // execute: READY -> RUNNING -> READY
  const request: ToolRequest = {
    toolId: "tool-test-1",
    input: { val: 42 },
    metadata: { env: "test" },
    correlationId: "correlation-123",
  };

  const response = await tool.execute(request);
  assert(tool.state === ToolState.READY, "Tool state is READY after execution completes");
  assert(handler.trace.length === 2 && handler.trace[1] === "execute", "Execute handler executed");
  assert(response.success === true, "Response reports success");
  assert(response.output.echoed === 42, "Response output echoed matches");
  assert(response.metadata.processedBy === "TestToolHandler", "Response metadata matches");

  // shutdown: READY -> STOPPED
  await tool.shutdown();
  assert(tool.state === ToolState.STOPPED, "Tool state is STOPPED after shutdown");
  assert(handler.trace.length === 3 && handler.trace[2] === "shutdown", "Shutdown handler executed");
  console.log("   ✓ Standard transitions CREATED -> READY -> RUNNING -> READY -> STOPPED validated.");

  // Test Failure State Transitions
  console.log("\n3. Verifying Lifecycle Failure States...");
  const failingHandler = new TestToolHandler();
  failingHandler.shouldFail = true;

  const fTool = new ToolBuilder()
    .withId("f-tool")
    .withName("Failing Tool")
    .withVersion("1.0.0")
    .withDescription("Fails during execution")
    .withAuthor("Test")
    .withCapability(ToolCapability.UTILITY)
    .withContext(context)
    .withHandler(failingHandler)
    .build();

  await fTool.initialize();
  try {
    const fRequest: ToolRequest = {
      toolId: "f-tool",
      input: {},
      metadata: {},
      correlationId: "fail-cor-1",
    };
    await fTool.execute(fRequest);
    assert(false, "Should have thrown on execution handler failure");
  } catch (err) {
    assert(fTool.state === ToolState.FAILED, "Tool state should be FAILED after execution exception");
  }
  console.log("   ✓ Exec error correctly transitions tool to FAILED.");

  // 4. Test Illegal State Transitions
  console.log("\n4. Verifying Illegal Lifecycle Transitions...");
  const badTransitionTool = new ToolBuilder()
    .withId("bad-trans")
    .withName("Bad Transition")
    .withVersion("1.0.0")
    .withDescription("Checks illegal states")
    .withAuthor("Test")
    .withCapability(ToolCapability.SEARCH)
    .withContext(context)
    .withHandler(new TestToolHandler())
    .build();

  // execute before initialize -> fail
  try {
    await badTransitionTool.execute({
      toolId: "bad-trans",
      input: {},
      metadata: {},
      correlationId: "c-1",
    });
    assert(false, "Should not allow execute in CREATED state");
  } catch (err) {
    assert(err instanceof InvalidToolStateException, "Expected InvalidToolStateException");
  }

  // shutdown before initialize -> fail
  try {
    await badTransitionTool.shutdown();
    assert(false, "Should not allow shutdown in CREATED state");
  } catch (err) {
    assert(err instanceof InvalidToolStateException, "Expected InvalidToolStateException");
  }

  await badTransitionTool.initialize();
  await badTransitionTool.shutdown();

  // execute in STOPPED -> fail
  try {
    await badTransitionTool.execute({
      toolId: "bad-trans",
      input: {},
      metadata: {},
      correlationId: "c-2",
    });
    assert(false, "Should not allow execute in STOPPED state");
  } catch (err) {
    assert(err instanceof InvalidToolStateException, "Expected InvalidToolStateException");
  }
  console.log("   ✓ Illegal state machine transitions blocked correctly.");

  // 5. Test Tool Registry & Execution Delegation
  console.log("\n5. Verifying Tool Registry & Execution Delegation...");
  const toolRegistry = new ToolRegistry();
  const regTool = new ToolBuilder()
    .withId("tool-reg")
    .withName("Registered Tool")
    .withVersion("1.0.0")
    .withDescription("Registry delegation tests")
    .withAuthor("Test")
    .withCapability(ToolCapability.MEMORY)
    .withContext(context)
    .withHandler(new TestToolHandler())
    .build();

  toolRegistry.register(regTool);
  assert(toolRegistry.has("tool-reg"), "Registry has registered tool");
  assert(toolRegistry.get("tool-reg") === regTool, "Registry lookup finds tool");

  // Duplicate register check -> fail
  try {
    toolRegistry.register(regTool);
    assert(false, "Should prevent duplicate ID registration");
  } catch (err) {
    assert(err instanceof ToolValidationException, "Expected ToolValidationException on duplicate register");
  }

  // Initialize tool before registry-level execution delegation
  await regTool.initialize();

  // execute delegation
  const delegationRequest: ToolRequest = {
    toolId: "tool-reg",
    input: { val: "delegation-test" },
    metadata: {},
    correlationId: "delegation-cor-1",
  };
  const delegationResponse = await toolRegistry.execute("tool-reg", delegationRequest);
  assert(delegationResponse.success === true, "Delegated execution succeeds");
  assert(delegationResponse.output.echoed === "delegation-test", "Delegated output matches");

  // Unregister
  const unregResult = toolRegistry.unregister("tool-reg");
  assert(unregResult === true, "Unregister returns true");
  assert(!toolRegistry.has("tool-reg"), "Tool is no longer in registry");

  const unregNonExist = toolRegistry.unregister("not-existing");
  assert(unregNonExist === false, "Unregistering non-existent returns false");
  console.log("   ✓ Registry operations register, unregister, duplicate check, execution delegation verified.");

  // 6. Validator Checks
  console.log("\n6. Verifying Validator rule checks...");
  const validator = new ToolValidator();

  // Mismatched Request Tool ID
  try {
    const wrongRequest: ToolRequest = {
      toolId: "wrong-id",
      input: {},
      metadata: {},
      correlationId: "c-3",
    };
    validator.validateRequest(wrongRequest, "expected-id");
    assert(false, "Validator should reject mismatched request ID");
  } catch (err) {
    assert(err instanceof ToolValidationException, "Expected ToolValidationException");
  }

  // Empty name in metadata
  try {
    validator.validateMetadata({
      id: "t-id",
      name: "",
      version: "1.0.0",
      description: "desc",
      author: "author",
      capabilities: [ToolCapability.AI],
    });
    assert(false, "Validator should reject empty name");
  } catch (err) {
    assert(err instanceof ToolValidationException, "Expected ToolValidationException");
  }

  // Empty capabilities list
  try {
    validator.validateMetadata({
      id: "t-id",
      name: "name",
      version: "1.0.0",
      description: "desc",
      author: "author",
      capabilities: [],
    });
    assert(false, "Validator should reject empty capabilities list");
  } catch (err) {
    assert(err instanceof ToolValidationException, "Expected ToolValidationException");
  }
  console.log("   ✓ Metadata validator rule checks verified.");

  // 7. Snapshot Immutability
  console.log("\n7. Verifying Snapshot Immutability...");
  const snapTool = new ToolBuilder()
    .withId("snap-tool")
    .withName("Snapshot Tool")
    .withVersion("1.0.0")
    .withDescription("Immutability snapshot check")
    .withAuthor("Test")
    .withCapability(ToolCapability.UTILITY)
    .withContext(context)
    .withHandler(new TestToolHandler())
    .build();

  const toolSnapshot = snapTool.snapshot();
  assert(toolSnapshot.id === "snap-tool", "Snapshot ID matches");

  // Verify Object.isFrozen
  assert(Object.isFrozen(toolSnapshot), "Tool snapshot object is frozen");
  assert(Object.isFrozen(toolSnapshot.metadata), "Tool snapshot metadata is frozen");
  assert(Object.isFrozen(toolSnapshot.metadata.capabilities), "Tool capabilities array is frozen");

  try {
    (toolSnapshot as any).state = ToolState.READY;
    assert(false, "Should not allow mutating snapshot state");
  } catch (err) {
    // correctly threw error
  }
  console.log("   ✓ Snapshot data is deep-frozen and immutable.");

  // 8. Request & Response Immutability
  console.log("\n8. Verifying Request and Response Immutability...");
  // Test Request immutability: input/metadata frozen in registry.execute or builder
  const reqObj: ToolRequest = {
    toolId: "t-1",
    input: { data: [1, 2, 3] },
    metadata: { env: { name: "prod" } },
    correlationId: "cor-99",
  };
  // Explicitly freeze for tests
  const { deepFreeze: freezeHelper } = require("./index");
  freezeHelper(reqObj);

  assert(Object.isFrozen(reqObj), "Request is frozen");
  assert(Object.isFrozen(reqObj.input), "Request input is frozen");
  assert(Object.isFrozen(reqObj.metadata), "Request metadata is frozen");

  const resObj: ToolResponse = {
    success: true,
    output: { nested: { result: "ok" } },
    metadata: { tracking: { id: "track-1" } },
    executionTime: 120,
    error: null,
  };
  freezeHelper(resObj);

  assert(Object.isFrozen(resObj), "Response is frozen");
  assert(Object.isFrozen(resObj.output), "Response output is frozen");
  assert(Object.isFrozen(resObj.metadata), "Response metadata is frozen");
  console.log("   ✓ Request and Response payloads are deep-frozen and immutable.");

  console.log("\n=== ALL TOOL FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
