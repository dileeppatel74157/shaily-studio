import {
  PromptBuilder,
  PromptCategory,
  PromptState,
  PromptTemplate,
  PromptVariable,
  IPromptRegistry,
  AIEngineBuilder,
  AITaskType,
  PromptValidationException,
  InvalidPromptStateException,
} from "./index";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock LLMRouter for AIEngine
class MockLLMRouter {
  public routeCalls: any[] = [];
  public context: any = {
    providerRegistry: {
      list: () => []
    }
  };
  public registerModel() {}
  public unregisterModel() { return true; }
  public async route(request: any): Promise<any> {
    this.routeCalls.push(request);
    return {
      providerId: "mock-provider",
      modelId: "mock-model",
      providerResponse: {
        responseId: "resp-1",
        content: "Mock template response",
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
        latency: 10,
        finishReason: "stop",
      },
      latency: 12,
    };
  }
  public async *routeStream() {}
  public snapshot() { return {} as any; }
}

async function runTests() {
  console.log("=== START PROMPT REGISTRY TESTS ===");

  const context = {
    env: "test",
    namespace: "shaily.prompts",
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  console.log("1. Running Builder Validation...");
  try {
    new PromptBuilder().build();
    throw new Error("Should have thrown for missing context");
  } catch (err: unknown) {
    assert(
      err instanceof PromptValidationException,
      "Expected PromptValidationException for missing context"
    );
  }
  console.log("✓ Verified Builder Validation.");

  // ==========================================
  // 2. Lifecycle Validation
  // ==========================================
  console.log("\n2. Running Lifecycle Validation...");
  const registry = new PromptBuilder()
    .withContext(context)
    .withMetadata({ module: "prompts" })
    .build();

  assert(
    (registry as any).state === PromptState.CREATED,
    "Should start in CREATED state"
  );

  const testTemplate: PromptTemplate = {
    id: "greet",
    name: "Greetings",
    description: "Welcome prompt template",
    category: PromptCategory.SYSTEM,
    version: "1.0.0",
    systemPrompt: "You are {{assistant_name}}",
    variables: [
      { name: "assistant_name", type: "string", required: true }
    ],
    metadata: { author: "tester" },
    tags: ["test"],
    createdAt: new Date(),
    updatedAt: new Date(),
    enabled: true,
  };

  try {
    await registry.register(testTemplate);
    throw new Error("Should block operations before start");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidPromptStateException,
      "Expected InvalidPromptStateException on early register"
    );
  }

  await registry.initialize();
  assert((registry as any).state === PromptState.READY, "READY state after initialize");

  await registry.start();
  assert((registry as any).state === PromptState.RUNNING, "RUNNING state after start");
  console.log("✓ Verified Lifecycle Validation.");

  // ==========================================
  // 3. Registration & Duplicate Detection
  // ==========================================
  console.log("\n3. Testing Template Registration...");
  await registry.register(testTemplate);
  assert(registry.has("greet") === true, "Greet template registered");

  // Verify duplicates error
  try {
    await registry.register(testTemplate);
    throw new Error("Duplicate template registration check failed");
  } catch (err: unknown) {
    assert(
      err instanceof PromptValidationException,
      "Expected PromptValidationException for duplicate ID + version"
    );
  }
  console.log("✓ Template Registration verified.");

  // ==========================================
  // 4. Versioning & Latest Version Lookup
  // ==========================================
  console.log("\n4. Testing Template Versioning...");
  const greetV2: PromptTemplate = {
    ...testTemplate,
    version: "1.1.0",
    systemPrompt: "You are {{assistant_name}}, version 1.1.0",
  };
  const greetV3: PromptTemplate = {
    ...testTemplate,
    version: "2.0.0",
    systemPrompt: "You are {{assistant_name}}, version 2.0.0",
  };

  await registry.register(greetV2);
  await registry.register(greetV3);

  const latest = registry.get("greet");
  assert(latest !== undefined && latest.version === "2.0.0", "Resolves latest semver version");
  console.log("✓ Template Versioning verified.");

  // ==========================================
  // 5. Rendering & Variable Substitution
  // ==========================================
  console.log("\n5. Testing Variable Substitutions & Types...");
  const renderRes = await registry.render("greet", { assistant_name: "Shaily" });
  assert(
    renderRes.systemPrompt === "You are Shaily, version 2.0.0",
    "Substitutes variable placeholders correctly"
  );
  assert(renderRes.variables.assistant_name === "Shaily", "Variables stored in execution result");

  // Check missing required variables throws
  try {
    await registry.render("greet", {});
    throw new Error("Should block rendering on missing required variable");
  } catch (err: unknown) {
    assert(
      err instanceof PromptValidationException,
      "Expected PromptValidationException for missing variable"
    );
  }
  console.log("✓ Variable Substitutions verified.");

  // ==========================================
  // 6. Validator Rule Checks
  // ==========================================
  console.log("\n6. Testing Validator Rule Checks...");
  // Version regex mismatch
  try {
    await registry.register({
      ...testTemplate,
      id: "ver-fail",
      version: "1.0", // Invalid semver
    });
    throw new Error("Should block invalid version formats");
  } catch (err: unknown) {
    assert(
      err instanceof PromptValidationException,
      "Expected PromptValidationException for invalid semver format"
    );
  }

  // Undeclared placeholders
  try {
    await registry.register({
      ...testTemplate,
      id: "place-fail",
      systemPrompt: "Hello {{username}}", // username not declared in variables
      variables: [],
    });
    throw new Error("Should block undeclared placeholders");
  } catch (err: unknown) {
    assert(
      err instanceof PromptValidationException,
      "Expected PromptValidationException for undeclared placeholders"
    );
  }

  // Duplicate variables
  try {
    await registry.register({
      ...testTemplate,
      id: "dup-var-fail",
      variables: [
        { name: "var1", type: "string", required: true },
        { name: "var1", type: "number", required: true },
      ],
    });
    throw new Error("Should block duplicate variables declaration");
  } catch (err: unknown) {
    assert(
      err instanceof PromptValidationException,
      "Expected PromptValidationException for duplicate variables"
    );
  }
  console.log("✓ Validator Rule Checks verified.");

  // ==========================================
  // 7. AI Engine Integration
  // ==========================================
  console.log("\n7. Testing AI Engine prompt pre-rendering...");
  const mockRouter = new MockLLMRouter();
  const aiEngine = new AIEngineBuilder()
    .withRouter(mockRouter)
    .withPromptRegistry(registry)
    .build();

  await aiEngine.initialize();
  await aiEngine.start();

  await aiEngine.execute({
    taskType: AITaskType.CHAT,
    promptId: "greet",
    promptVariables: { assistant_name: "AssistantAI" },
  });

  const routedRequest = mockRouter.routeCalls[0];
  assert(routedRequest.messages !== undefined, "Pre-loaded history populated");
  assert(
    routedRequest.messages[0].content === "You are AssistantAI, version 2.0.0",
    "Renders prompt template into request message"
  );
  console.log("✓ AI Engine pre-rendering verified.");

  // ==========================================
  // 8. Snapshot Immutability
  // ==========================================
  console.log("\n8. Testing Snapshot Immutability...");
  const snap = registry.snapshot();
  assert(snap.templateCount === 3, "Snapshot tracks templates count");
  assert(Object.isFrozen(snap), "Snapshot object frozen");

  try {
    (snap as any).templateCount = 999;
    throw new Error("Blocked snapshot mutation");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Snapshot mutation throws TypeError");
  }
  console.log("✓ Snapshot Immutability verified.");

  // Clean up stop
  await registry.stop();
  assert((registry as any).state === PromptState.STOPPED, "STOPPED state after stop");

  console.log("\n=== ALL PROMPT REGISTRY TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite aborted:", err);
  process.exit(1);
});
