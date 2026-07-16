import {
  MCPBuilder,
  MCPContext,
  MCPTransport,
  MCPTransportType,
  MCPTool,
  MCPPrompt,
  MCPResource,
  MCPRequest,
  MCPResponse,
  MCPServerState,
  MCPValidationException,
  InvalidMCPStateException,
  IToolRegistry,
  IPromptRegistry,
  IKnowledgeBase,
  IPluginRegistry,
  PromptState,
} from "./index";
import { deepFreeze as freezeHelper } from "./mcp/types";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class MockTransport implements MCPTransport {
  public readonly type = MCPTransportType.IN_MEMORY;
  public closeCalled = false;

  public async send(response: MCPResponse): Promise<void> {}
  public async receive(): Promise<MCPRequest> {
    return { method: "tools/list", id: 1 };
  }
  public async close(): Promise<void> {
    this.closeCalled = true;
  }
}

async function runTests() {
  console.log("=== START MCP FRAMEWORK TESTS ===");

  // 1. Setup Mock Registries Context
  const mockTools: IToolRegistry = {
    register: () => {},
    unregister: () => true,
    get: () => undefined,
    has: () => false,
    execute: async () => ({} as any),
    snapshot: () => ({ toolsCount: 0, tools: [] }),
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
    render: async () => ({
      promptId: "mock",
      version: "1.0.0",
      renderedAt: new Date(),
      variables: {},
    }),
    snapshot: () => ({
      id: "mock",
      state: PromptState.RUNNING,
      templateCount: 0,
      renderedCount: 0,
      metadata: {},
      timestamp: new Date(),
      promptsCount: 0,
    }),
  };

  const mockKB: IKnowledgeBase = {
    id: "kb-1",
    name: "Mock KB",
    metadata: {},
    addDocument: () => {},
    removeDocument: () => true,
    getDocument: () => undefined,
    hasDocument: () => false,
    search: () => [],
    snapshot: () => ({} as any),
  };

  const mockPlugins: IPluginRegistry = {
    register: () => {},
    unregister: () => true,
    get: () => undefined,
    has: () => false,
    snapshot: () => ({ pluginsCount: 0, plugins: [] }),
  };

  const context: MCPContext = {
    tools: mockTools,
    prompts: mockPrompts,
    knowledge: mockKB,
    plugins: mockPlugins,
    metadata: { app: "Shaily" },
  };

  const transport = new MockTransport();

  // 2. Builder
  console.log("\n1. Verifying MCP Builder...");
  const server = new MCPBuilder()
    .withContext(context)
    .withTransport(transport)
    .withMetadata({ tier: "core" })
    .build();

  assert(server.state === MCPServerState.CREATED, "Server initial state is CREATED");
  assert(server.context.metadata.app === "Shaily", "Initial context metadata is preserved");
  assert(server.context.metadata.tier === "core", "Builder metadata was merged successfully");
  console.log("   ✓ MCP Builder verified successfully.");

  // 3. Registry & Duplicate Prevention
  console.log("\n2. Verifying Registry Operations & Duplicates...");
  const sampleTool: MCPTool = {
    name: "search_docs",
    description: "Search local documentation",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
  };

  const samplePrompt: MCPPrompt = {
    name: "code_review",
    description: "Review typescript code",
    arguments: [{ name: "code", description: "The typescript code", required: true }],
  };

  const sampleResource: MCPResource = {
    uri: "file:///workspace/schema.json",
    name: "schema",
    description: "Core project JSON schema",
    mimeType: "application/json",
  };

  server.registerTool(sampleTool);
  server.registerPrompt(samplePrompt);
  server.registerResource(sampleResource);

  // Duplicate Tool registration -> throws
  try {
    server.registerTool(sampleTool);
    assert(false, "Should have thrown on duplicate tool registration");
  } catch (err) {
    assert(err instanceof MCPValidationException, "Expected MCPValidationException on duplicate tool name");
  }

  // Duplicate Prompt registration -> throws
  try {
    server.registerPrompt(samplePrompt);
    assert(false, "Should have thrown on duplicate prompt registration");
  } catch (err) {
    assert(err instanceof MCPValidationException, "Expected MCPValidationException on duplicate prompt name");
  }

  // Duplicate Resource registration -> throws
  try {
    server.registerResource(sampleResource);
    assert(false, "Should have thrown on duplicate resource registration");
  } catch (err) {
    assert(err instanceof MCPValidationException, "Expected MCPValidationException on duplicate resource URI");
  }
  console.log("   ✓ Registries prevent duplicate tool/prompt/resource registrations.");

  // 4. Lifecycle Transitions
  console.log("\n3. Verifying Lifecycle Transitions...");
  // Handle before running -> throws
  try {
    await server.handle({ method: "tools/list", id: 101 });
    assert(false, "Should not handle request when state is CREATED");
  } catch (err) {
    assert(err instanceof InvalidMCPStateException, "Expected InvalidMCPStateException");
  }

  // CREATED -> READY
  await server.initialize();
  assert(server.state === MCPServerState.READY, "Server state is READY after initialize");

  // READY -> RUNNING
  await server.start();
  assert(server.state === MCPServerState.RUNNING, "Server state is RUNNING after start");

  // RUNNING -> STOPPED
  await server.stop();
  assert(server.state === MCPServerState.STOPPED, "Server state is STOPPED after stop");
  assert(transport.closeCalled === true, "Transport close method was invoked on stop");
  console.log("   ✓ Lifecycle transitions CREATED -> READY -> RUNNING -> STOPPED validated.");

  // 5. Tool / Prompt / Resource Registration Verification
  console.log("\n4. Verifying Handle Requests...");
  // Re-builder server for handling requests
  const runningServer = new MCPBuilder()
    .withContext(context)
    .withTransport(new MockTransport())
    .build();

  await runningServer.initialize();
  await runningServer.start();

  runningServer.registerTool(sampleTool);
  runningServer.registerPrompt(samplePrompt);
  runningServer.registerResource(sampleResource);

  // List tools
  const toolsRes = await runningServer.handle({ method: "tools/list", id: 1 });
  assert(toolsRes.result.tools.length === 1, "Exposes 1 tool");
  assert(toolsRes.result.tools[0].name === "search_docs", "Correct tool name listed");

  // Call tool
  const callRes = await runningServer.handle({
    method: "tools/call",
    params: { name: "search_docs", arguments: { query: "typescript" } },
    id: 2,
  });
  assert(callRes.result !== undefined, "Call returns a result");
  assert(callRes.result.content[0].text.indexOf("search_docs") !== -1, "Response content references tool execution");

  // List prompts
  const promptsRes = await runningServer.handle({ method: "prompts/list", id: 3 });
  assert(promptsRes.result.prompts.length === 1, "Exposes 1 prompt");

  // Get prompt
  const getPromptRes = await runningServer.handle({
    method: "prompts/get",
    params: { name: "code_review" },
    id: 4,
  });
  assert(getPromptRes.result.prompt.name === "code_review", "Returns prompt content");

  // List resources
  const resourcesRes = await runningServer.handle({ method: "resources/list", id: 5 });
  assert(resourcesRes.result.resources.length === 1, "Exposes 1 resource");

  // Read resource
  const readRes = await runningServer.handle({
    method: "resources/read",
    params: { uri: "file:///workspace/schema.json" },
    id: 6,
  });
  assert(readRes.result.contents[0].uri === "file:///workspace/schema.json", "Exposes resource content");
  console.log("   ✓ Tool, Prompt, Resource request handlers completed successfully.");

  // 6. Validation Checks
  console.log("\n5. Verifying Validator Enforcements...");
  // Empty request method -> throws
  try {
    await runningServer.handle({ method: "", id: 99 });
    assert(false, "Should reject empty request method");
  } catch (err) {
    assert(err instanceof MCPValidationException, "Expected MCPValidationException on empty method");
  }

  // Missing request ID -> throws
  try {
    await runningServer.handle({ method: "tools/list", id: undefined as any });
    assert(false, "Should reject missing request ID");
  } catch (err) {
    assert(err instanceof MCPValidationException, "Expected MCPValidationException on missing request ID");
  }
  console.log("   ✓ Validator rule checks on request structures completed.");

  // 7. Snapshot Immutability
  console.log("\n6. Verifying Snapshot Immutability...");
  const snap = runningServer.snapshot();
  assert(snap.state === MCPServerState.RUNNING, "Snapshot state matches");
  assert(snap.toolsCount === 1, "Snapshot toolsCount matches");
  assert(snap.promptsCount === 1, "Snapshot promptsCount matches");
  assert(snap.resourcesCount === 1, "Snapshot resourcesCount matches");

  assert(Object.isFrozen(snap), "Snapshot object is frozen");
  assert(Object.isFrozen(snap.metadata), "Snapshot metadata is frozen");

  try {
    (snap as any).toolsCount = 99;
    assert(false, "Should not allow mutating snapshot properties");
  } catch (err) {
    // correctly threw error
  }
  console.log("   ✓ Server snapshots are deep-frozen.");

  // 8. Request & Response Immutability
  console.log("\n7. Verifying Request / Response Immutability...");
  const reqObj: MCPRequest = {
    method: "tools/list",
    params: { page: 1 },
    id: 12,
  };
  // Explicitly freeze for tests using types.ts deepFreeze
  freezeHelper(reqObj);

  assert(Object.isFrozen(reqObj), "Request is frozen");
  assert(Object.isFrozen(reqObj.params), "Request parameters are frozen");

  const responseObj = await runningServer.handle({ method: "tools/list", id: 13 });
  assert(Object.isFrozen(responseObj), "Returned handle response is frozen");
  assert(Object.isFrozen(responseObj.result), "Response result is frozen");
  console.log("   ✓ Protocol requests and responses are strictly immutable.");

  console.log("\n=== ALL MCP FRAMEWORK TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
