import {
  ConversationBuilder,
  ConversationRole,
  ConversationState,
  ConversationCapability,
  IConversationManager,
  ConversationMessage,
  ConversationSearch,
  ConversationSummary,
  AIEngineBuilder,
  AITaskType,
  ConversationValidationException,
  InvalidConversationStateException,
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
        content: "Mock reply",
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
  console.log("=== START CONVERSATION TESTS ===");

  const context = {
    env: "test",
    namespace: "shaily.conversation",
  };

  // ==========================================
  // 1. Builder Validation
  // ==========================================
  console.log("1. Running Builder Validation...");
  try {
    new ConversationBuilder().build();
    throw new Error("Should have thrown for missing context");
  } catch (err: unknown) {
    assert(
      err instanceof ConversationValidationException,
      "Expected ConversationValidationException for missing context"
    );
  }
  console.log("✓ Verified Builder Validation.");

  // ==========================================
  // 2. Lifecycle Validation
  // ==========================================
  console.log("\n2. Running Lifecycle Validation...");
  const manager = new ConversationBuilder()
    .withContext(context)
    .withMetadata({ author: "tester" })
    .build();

  assert(
    (manager as any).state === ConversationState.CREATED,
    "Should start in CREATED state"
  );

  try {
    await manager.createConversation();
    throw new Error("Should block operations before start");
  } catch (err: unknown) {
    assert(
      err instanceof InvalidConversationStateException,
      "Expected InvalidConversationStateException on early createConversation"
    );
  }

  await manager.initialize();
  assert((manager as any).state === ConversationState.READY, "READY state after initialize");

  await manager.start();
  assert((manager as any).state === ConversationState.RUNNING, "RUNNING state after start");
  console.log("✓ Verified Lifecycle Validation.");

  // ==========================================
  // 3. Conversation Creation & Session Grouping
  // ==========================================
  console.log("\n3. Testing Conversation & Session creation...");
  const session = await manager.createSession("session-1");
  assert(session.id === "session-1", "Created session matches ID");

  const conv = await manager.createConversation({
    name: "General Talk",
    tags: ["general", "support"],
    sessionReference: "session-1",
    custom: { id: "conv-1" },
  });

  assert(conv.id === "conv-1", "Created conversation matches custom ID");
  assert(conv.sessionId === "session-1", "Linked session match");

  const updatedSession = manager.getSession("session-1");
  assert(
    updatedSession !== undefined && updatedSession.conversationIds.includes("conv-1"),
    "Session tracks linked conversation"
  );

  // Verify duplicates error
  try {
    await manager.createConversation({ custom: { id: "conv-1" } });
    throw new Error("Duplicate ID check failed");
  } catch (err: unknown) {
    assert(
      err instanceof ConversationValidationException,
      "Expected ConversationValidationException for duplicate ID"
    );
  }

  // Verify invalid session error
  try {
    await manager.createConversation({ sessionReference: "invalid-session" });
    throw new Error("Invalid session reference validation failed");
  } catch (err: unknown) {
    assert(
      err instanceof ConversationValidationException,
      "Expected ConversationValidationException for invalid session reference"
    );
  }
  console.log("✓ Conversation & Session creation verified.");

  // ==========================================
  // 4. Message Appending
  // ==========================================
  console.log("\n4. Testing Message Appending...");
  const msg1: ConversationMessage = {
    id: "msg-1",
    role: ConversationRole.USER,
    content: "Hello AI World!",
    timestamp: new Date(),
  };

  await manager.appendMessage("conv-1", msg1);
  const activeConv = manager.getConversation("conv-1");
  assert(activeConv !== undefined && activeConv!.messages.length === 1, "Appended message logged");
  assert(activeConv!.messages[0].id === "msg-1", "Message content match");

  // Validate message content rules
  try {
    await manager.appendMessage("conv-1", {
      id: "msg-empty",
      role: ConversationRole.SYSTEM,
      content: "   ",
      timestamp: new Date(),
    });
    throw new Error("Should block empty message content");
  } catch (err: unknown) {
    assert(
      err instanceof ConversationValidationException,
      "Expected ConversationValidationException for empty content"
    );
  }

  // Validate duplicate message IDs
  try {
    await manager.appendMessage("conv-1", {
      id: "msg-1",
      role: ConversationRole.USER,
      content: "Hello again!",
      timestamp: new Date(),
    });
    throw new Error("Should block duplicate message IDs");
  } catch (err: unknown) {
    assert(
      err instanceof ConversationValidationException,
      "Expected ConversationValidationException for duplicate message ID"
    );
  }
  console.log("✓ Message Appending verified.");

  // ==========================================
  // 5. Message Editing
  // ==========================================
  console.log("\n5. Testing Message Editing...");
  await manager.editMessage("conv-1", "msg-1", "Hello AI World, Edited!");
  const editedConv = manager.getConversation("conv-1");
  assert(
    editedConv !== undefined && editedConv!.messages[0].content === "Hello AI World, Edited!",
    "Content updated"
  );
  assert(editedConv!.messages[0].edited === true, "Edited flag set to true");

  try {
    await manager.editMessage("conv-1", "msg-1", "  ");
    throw new Error("Should block empty edit content");
  } catch (err: unknown) {
    assert(
      err instanceof ConversationValidationException,
      "Expected ConversationValidationException on empty edit"
    );
  }
  console.log("✓ Message Editing verified.");

  // ==========================================
  // 6. Soft Delete Message & History Retrieval
  // ==========================================
  console.log("\n6. Testing Soft Delete & History Retrieval...");
  const msg2: ConversationMessage = {
    id: "msg-2",
    role: ConversationRole.ASSISTANT,
    content: "Hi! How can I assist you?",
    timestamp: new Date(),
  };
  await manager.appendMessage("conv-1", msg2);

  // Soft delete msg-1
  await manager.softDeleteMessage("conv-1", "msg-1");

  const hist = manager.history("conv-1");
  assert(hist.messages.length === 1, "History excludes soft-deleted messages");
  assert(hist.messages[0].id === "msg-2", "History contains active messages");
  assert(hist.version === 2, "History tracks operation count");
  console.log("✓ Soft Delete & History verified.");

  // ==========================================
  // 7. Conversation Deletion (Soft Delete)
  // ==========================================
  console.log("\n7. Testing Conversation Deletion...");
  await manager.deleteConversation("conv-1");
  assert(manager.getConversation("conv-1") === undefined, "Deleted conversation is hidden");
  assert(manager.listConversations().length === 0, "List excludes deleted conversation");
  console.log("✓ Conversation Deletion verified.");

  // Restore/Re-create for search/summary tests
  const conv2 = await manager.createConversation({
    name: "Search Conv",
    tags: ["search", "support"],
    custom: { id: "conv-2" },
  });
  await manager.appendMessage("conv-2", {
    id: "msg-s1",
    role: ConversationRole.USER,
    content: "Looking for code help.",
    timestamp: new Date(Date.now() - 10000),
  });
  await manager.appendMessage("conv-2", {
    id: "msg-s2",
    role: ConversationRole.DEVELOPER,
    content: "Debugging compiler configuration files.",
    timestamp: new Date(),
  });

  // ==========================================
  // 8. Summary Generation
  // ==========================================
  console.log("\n8. Testing Summary Generation...");
  const summary = await manager.summarize("conv-2");
  assert(summary.messageCount === 2, "Summary reports message count");
  assert(summary.firstMessageSnippet === "Looking for code help.", "First message snippet matches");
  assert(summary.roles.includes("USER") && summary.roles.includes("DEVELOPER"), "Roles listed");
  assert(summary.estimatedTokenCount > 0, "Token estimation exists");
  assert(summary.tags.includes("search"), "Tags included");
  console.log("✓ Summary Generation verified.");

  // ==========================================
  // 9. Deterministic Search
  // ==========================================
  console.log("\n9. Testing Search Query Filters...");
  const search1 = manager.search({ query: "compiler" });
  assert(search1.length === 1, "Matches text search");
  assert(search1[0].message.id === "msg-s2", "Matches exact message");

  const search2 = manager.search({ roles: [ConversationRole.USER] });
  assert(search2.length === 1 && search2[0].message.id === "msg-s1", "Matches role filter");

  const search3 = manager.search({ tags: ["support"] });
  assert(search3.length === 2, "Matches tags filter");

  try {
    manager.search({});
    throw new Error("Should block empty search filters");
  } catch (err: unknown) {
    assert(
      err instanceof ConversationValidationException,
      "Expected ConversationValidationException on empty search filters"
    );
  }
  console.log("✓ Deterministic Search verified.");

  // ==========================================
  // 10. AI Engine Integration
  // ==========================================
  console.log("\n10. Testing AI Engine history pre-loading...");
  const mockRouter = new MockLLMRouter();
  const aiEngine = new AIEngineBuilder()
    .withRouter(mockRouter)
    .withConversationManager(manager)
    .build();

  await aiEngine.initialize();
  await aiEngine.start();

  await aiEngine.execute({
    taskType: AITaskType.CHAT,
    conversationId: "conv-2",
  });

  const routedRequest = mockRouter.routeCalls[0];
  assert(routedRequest.messages !== undefined, "Pre-loaded history populated");
  assert(routedRequest.messages.length === 2, "All history messages loaded");
  assert(routedRequest.messages[0].role === "user", "Role USER mapped to user");
  assert(routedRequest.messages[1].role === "system", "Role DEVELOPER mapped to system");

  console.log("✓ AI Engine pre-loading verified.");

  // ==========================================
  // 11. Snapshot Immutability
  // ==========================================
  console.log("\n11. Testing Snapshot Immutability...");
  const snap = manager.snapshot();
  assert(snap.conversationCount === 1, "Snapshot tracks active conversations count");
  assert(Object.isFrozen(snap), "Snapshot object frozen");

  try {
    (snap as any).conversationCount = 999;
    throw new Error("Blocked snapshot mutation");
  } catch (err: unknown) {
    assert(err instanceof TypeError, "Snapshot mutation throws TypeError");
  }

  // Clean up stop
  await manager.stop();
  assert((manager as any).state === ConversationState.STOPPED, "STOPPED state after stop");

  console.log("\n=== ALL CONVERSATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test suite aborted:", err);
  process.exit(1);
});
