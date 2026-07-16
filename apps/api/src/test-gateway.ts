import {
  GatewayBuilder,
  GatewayContext,
  GatewayState,
  GatewayRequest,
  GatewayResponse,
  GatewayMiddleware,
  GatewayValidationException,
  InvalidGatewayStateException,
  RouteDefinition,
} from "./gateway/index";

import {
  LoggerBuilder,
  ConsoleTransport,
  JsonFormatter,
  ILogger,
  IOrchestrator,
  ILLMRouter,
  IProviderRegistry,
  IAgentRegistry,
  IWorkflowEngine,
  IToolRegistry,
  IPromptRegistry,
  IKnowledgeBase,
  IRAGEngine,
  IPluginRegistry,
  IMCPServer,
  IAgent,
} from "@shaily/core";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class TestMiddleware implements GatewayMiddleware {
  constructor(
    public readonly name: string,
    private readonly _trace: string[],
    private readonly _shortCircuit = false
  ) {}

  public async execute(
    request: GatewayRequest,
    next: (req: GatewayRequest) => Promise<GatewayResponse>
  ): Promise<GatewayResponse> {
    this._trace.push(`start-${this.name}`);
    if (this._shortCircuit) {
      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: { shortCircuitedBy: this.name },
      };
    }
    const response = await next(request);
    this._trace.push(`end-${this.name}`);
    return response;
  }
}

async function runTests() {
  console.log("=== START GATEWAY TESTS ===");

  // 1. Setup Mock Core Services
  const formatter = new JsonFormatter();
  const logger = new LoggerBuilder()
    .addTransport(new ConsoleTransport(formatter))
    .withFormatter(formatter)
    .build();

  const mockOrchestrator: IOrchestrator = {
    initialize: async () => {},
    start: async () => {},
    stop: async () => {},
    execute: async (req) => ({ planId: "plan-1", steps: [], state: "COMPLETED" } as any),
    snapshot: () => ({} as any),
  };

  const mockRouter: ILLMRouter = {
    registerModel: () => {},
    unregisterModel: () => true,
    route: async () => ({ modelId: "test-model", latency: 10 } as any),
    routeStream: async function* () {},
    snapshot: () => ({} as any),
  };

  const mockProviders: IProviderRegistry = {
    register: () => {},
    unregister: () => true,
    get: () => ({} as any),
    has: () => false,
    list: () => [],
    execute: async (id, req) => ({ success: true, providerId: id }),
    snapshot: () => ({} as any),
    modelLookup: () => undefined,
    capabilityLookup: () => [],
    providerLookup: () => undefined,
  };

  const mockAgent: IAgent = {
    id: "agent-1",
    name: "Mock Agent",
    version: "1.0.0",
    description: "Mock Agent",
    state: "READY" as any,
    capabilities: [],
    metadata: {},
    context: {} as any,
    initialize: async () => {},
    execute: async (input) => ({ out: "Agent execution successful", input }),
    shutdown: async () => {},
    snapshot: () => ({} as any),
  };

  const mockAgents: IAgentRegistry = {
    register: () => {},
    unregister: () => true,
    get: (id) => (id === "agent-1" ? mockAgent : undefined),
    has: (id) => id === "agent-1",
    snapshot: () => ({} as any),
  };

  const mockWorkflow: IWorkflowEngine = {
    register: () => {},
    unregister: () => true,
    execute: async (id) => ({ workflowId: id, state: "FINISHED" }),
    cancel: async () => true,
    get: () => undefined,
    has: () => false,
    snapshot: () => ({} as any),
  };

  const mockTools: IToolRegistry = {
    register: () => {},
    unregister: () => true,
    get: () => undefined,
    has: () => false,
    execute: async (id, req) => ({ success: true, output: `Executed tool ${id}` } as any),
    snapshot: () => ({} as any),
  };

  const mockPrompts: IPromptRegistry = {
    initialize: async () => {},
    start: async () => {},
    stop: async () => {},
    register: async () => {},
    unregister: async () => {},
    get: () => undefined,
    has: () => false,
    list: () => [],
    render: async (id, vars) => ({
      promptId: id,
      version: "1.0.0",
      renderedAt: new Date(),
      variables: vars || {},
      userPrompt: `Rendered prompt ${id} with: ${JSON.stringify(vars)}`,
    }),
    snapshot: () => ({} as any),
  };

  const mockKB: IKnowledgeBase = {
    id: "kb-1",
    name: "Mock KB",
    metadata: {},
    addDocument: () => {},
    removeDocument: () => true,
    getDocument: () => undefined,
    hasDocument: () => false,
    search: (q) => [{ documentId: "d-1", chunkId: "c-1", text: "Match", score: 1.0, metadata: {} }],
    snapshot: () => ({} as any),
  };

  const mockRAG: IRAGEngine = {
    context: {} as any,
    retrieve: async (req) => ({ context: "Retrieved context string", documents: [], strategyUsed: "KEYWORD", executionTime: 5 }),
    snapshot: () => ({} as any),
  };

  const mockPlugins: IPluginRegistry = {
    register: () => {},
    unregister: () => true,
    get: () => undefined,
    has: () => false,
    snapshot: () => ({} as any),
  };

  const mockMCP: IMCPServer = {
    state: "RUNNING" as any,
    context: {} as any,
    initialize: async () => {},
    start: async () => {},
    stop: async () => {},
    registerTool: () => {},
    registerPrompt: () => {},
    registerResource: () => {},
    handle: async (req) => ({ result: { ok: true }, id: req.id }),
    snapshot: () => ({} as any),
  };

  const context: GatewayContext = {
    logger,
    orchestrator: mockOrchestrator,
    router: mockRouter,
    providers: mockProviders,
    agents: mockAgents,
    workflow: mockWorkflow,
    tools: mockTools,
    prompts: mockPrompts,
    knowledge: mockKB,
    rag: mockRAG,
    plugins: mockPlugins,
    mcp: mockMCP,
    metadata: { app: "GatewayTest" },
  };

  // 2. Gateway Builder & Validations
  console.log("\n1. Verifying Gateway Builder & Validations...");
  const gateway = new GatewayBuilder()
    .withContext(context)
    .withHost("127.0.0.1")
    .withPort(8080)
    .withMetadata({ env: "test" })
    .build();

  assert(gateway.state === GatewayState.CREATED, "Gateway state is CREATED");
  assert(gateway.context.metadata.env === "test", "Merged metadata contains env");

  // Invalid port -> throws
  try {
    new GatewayBuilder().withContext(context).withPort(-10).build();
    assert(false, "Should reject negative port");
  } catch (err) {
    assert(err instanceof GatewayValidationException, "Expected GatewayValidationException");
  }

  // Missing context -> throws
  try {
    new GatewayBuilder().withPort(8080).build();
    assert(false, "Should reject build without context");
  } catch (err) {
    assert(err instanceof GatewayValidationException, "Expected GatewayValidationException");
  }
  console.log("   ✓ Builder and builder validation rules verified.");

  // 3. Route Registration & Lookups
  console.log("\n2. Verifying Route Registration, Lookup & Duplicates...");
  const sampleRoute: RouteDefinition = {
    method: "POST",
    path: "/custom/endpoint",
    metadata: { rateLimit: 60 },
    handler: async (req: any) => ({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { echo: req.body.val },
    }),
  };

  gateway.registerRoute(sampleRoute);

  // Duplicate registration -> throws
  try {
    gateway.registerRoute(sampleRoute);
    assert(false, "Should reject duplicate route path and method");
  } catch (err) {
    assert(err instanceof GatewayValidationException, "Expected GatewayValidationException on duplicate");
  }

  // Unregister route
  const unregResult = gateway.unregisterRoute("/custom/endpoint");
  assert(unregResult === true, "Unregister route returns true");
  assert(
    gateway.snapshot().routes.find((r: any) => r.path === "/custom/endpoint") === undefined,
    "Route is no longer registered"
  );


  const unregNonExist = gateway.unregisterRoute("/not-existing");
  assert(unregNonExist === false, "Unregistering non-existent route returns false");
  console.log("   ✓ Route registration, lookup, duplicate checks, and unregister verified.");

  // Re-register custom endpoint for subsequent request tests
  gateway.registerRoute(sampleRoute);

  // 4. Middleware Pipeline
  console.log("\n3. Verifying Middleware Pipeline Onion Model & Short-Circuit...");
  const trace: string[] = [];
  const mw1 = new TestMiddleware("logger", trace);
  const mw2 = new TestMiddleware("auth", trace);
  const mwShort = new TestMiddleware("ratelimit", trace, true); // short-circuits!

  const testGateway = new GatewayBuilder().withContext(context).build();
  testGateway.registerMiddleware(mw1);
  testGateway.registerMiddleware(mw2);

  // Initialize and start to handle
  await testGateway.initialize();
  await testGateway.start();

  // Test full middleware chain execution order
  await testGateway.handle({
    method: "GET",
    path: "/health",
    headers: {},
    query: {},
    params: {},
    body: null,
    correlationId: "c-trace-1",
  });

  // Onion model trace should be: start-logger -> start-auth -> route execution -> end-auth -> end-logger
  assert(trace[0] === "start-logger", "mw1 starts first");
  assert(trace[1] === "start-auth", "mw2 starts second");
  assert(trace[2] === "end-auth", "mw2 ends third");
  assert(trace[3] === "end-logger", "mw1 ends last");

  // Test short-circuiting middleware
  const shortGateway = new GatewayBuilder().withContext(context).build();
  shortGateway.registerMiddleware(mw1);
  shortGateway.registerMiddleware(mwShort); // short circuits here, mw2 and route won't execute!
  shortGateway.registerMiddleware(mw2);

  await shortGateway.initialize();
  await shortGateway.start();

  const shortTrace: string[] = [];
  const shortRes = await shortGateway.handle({
    method: "GET",
    path: "/health",
    headers: {},
    query: {},
    params: {},
    body: null,
    correlationId: "c-trace-2",
  });

  assert(shortRes.body.shortCircuitedBy === "ratelimit", "Response was returned from short-circuiting middleware");
  console.log("   ✓ Middleware onion order execution and short-circuit capability verified.");

  // 5. Request Handling & Dynamic Param Binding
  console.log("\n4. Verifying Route Request Handling...");
  // Test health check
  const healthRes = await testGateway.handle({
    method: "GET",
    path: "/health",
    headers: {},
    query: {},
    params: {},
    body: null,
    correlationId: "cor-health",
  });
  assert(healthRes.status === 200, "Health status is 200");
  assert(healthRes.body.status === "ok", "Health body is ok");

  // Test dynamic parameter parsing POST /agents/:id
  const agentRes = await testGateway.handle({
    method: "POST",
    path: "/agents/agent-1",
    headers: {},
    query: {},
    params: {},
    body: { task: "ideation" },
    correlationId: "cor-agent",
  });
  assert(agentRes.status === 200, "Agent route executes successfully");
  assert(agentRes.body.out === "Agent execution successful", "Agent handler returned correct mock output");
  assert(agentRes.body.input.task === "ideation", "Parameters passed correctly");

  // Test dynamic parameter parsing non-existent
  const agentNonExist = await testGateway.handle({
    method: "POST",
    path: "/agents/agent-missing",
    headers: {},
    query: {},
    params: {},
    body: {},
    correlationId: "cor-agent-missing",
  });
  assert(agentNonExist.status === 404, "Returns 404 on missing agent ID lookup");
  console.log("   ✓ Endpoints routing, parameter passing, and structured output verified.");

  // 6. Error Handling
  console.log("\n5. Verifying Error Handling & Exception Isolation...");
  // Handle request for non-existent route
  const error404Res = await testGateway.handle({
    method: "GET",
    path: "/custom/non-existent-route",
    headers: {},
    query: {},
    params: {},
    body: null,
    correlationId: "cor-404",
  });

  assert(error404Res.status === 404, "Returns status 404");
  assert(error404Res.body.success === false, "Body reports success false");
  assert(error404Res.body.code === "ROUTE_NOT_FOUND", "Error code matches");
  assert(error404Res.body.correlationId === "cor-404", "Correlation ID matches");
  console.log("   ✓ Route exceptions isolated and formatted as structured payloads.");

  // 7. Lifecycle States
  console.log("\n6. Verifying Lifecycle State Transitions...");
  const lcGateway = new GatewayBuilder().withContext(context).build();
  assert(lcGateway.state === GatewayState.CREATED, "Initial state CREATED");

  // handle before ready -> throws structured error response instead of escaping exception
  const preInitRes = await lcGateway.handle({
    method: "GET",
    path: "/health",
    headers: {},
    query: {},
    params: {},
    body: null,
    correlationId: "c-pre",
  });
  assert(preInitRes.status === 409, "Returns status 409 Conflict");
  assert(preInitRes.body.code === "INVALID_STATE", "Reports INVALID_STATE code");

  await lcGateway.initialize();
  assert(lcGateway.state === GatewayState.READY, "State READY");

  await lcGateway.start();
  assert(lcGateway.state === GatewayState.RUNNING, "State RUNNING");

  // double start -> throws InvalidGatewayStateException
  try {
    await lcGateway.start();
    assert(false, "Should reject double start");
  } catch (err) {
    assert(err instanceof InvalidGatewayStateException, "Expected InvalidGatewayStateException");
  }

  await lcGateway.stop();
  assert(lcGateway.state === GatewayState.STOPPED, "State STOPPED");
  console.log("   ✓ State machine transitions CREATED -> READY -> RUNNING -> STOPPED validated.");

  // 8. Snapshot Immutability
  console.log("\n7. Verifying Snapshot Immutability...");
  const snap = testGateway.snapshot();
  assert(Object.isFrozen(snap), "Snapshot object is frozen");
  assert(Object.isFrozen(snap.routes), "Routes list is frozen");
  assert(Object.isFrozen(snap.metadata), "Metadata is frozen");
  console.log("   ✓ Snapshots are recursively deep-frozen.");

  // 9. Request / Response Immutability
  console.log("\n8. Verifying Request / Response Immutability...");
  const reqObj: GatewayRequest = {
    method: "GET",
    path: "/health",
    headers: { "x-cor": "1" },
    query: { debug: "true" },
    params: {},
    body: { item: [1, 2] },
    correlationId: "cor-1",
  };
  const { deepFreeze: freezeHelper } = require("./gateway/types");
  freezeHelper(reqObj);

  assert(Object.isFrozen(reqObj), "Request is frozen");
  assert(Object.isFrozen(reqObj.headers), "Request headers is frozen");
  assert(Object.isFrozen(reqObj.query), "Request query is frozen");
  assert(Object.isFrozen(reqObj.body), "Request body is frozen");

  const responseObj = await testGateway.handle(reqObj);
  assert(Object.isFrozen(responseObj), "Response is frozen");
  assert(Object.isFrozen(responseObj.headers), "Response headers is frozen");
  assert(Object.isFrozen(responseObj.body), "Response body is frozen");
  console.log("   ✓ Request and response payloads are deep-frozen.");

  console.log("\n=== ALL GATEWAY TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
