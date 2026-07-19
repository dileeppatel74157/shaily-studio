import { AssistantBuilder } from "./assistant/AssistantBuilder";
import { AssistantEngine } from "./assistant/AssistantEngine";
import { AssistantState } from "./assistant/AssistantState";
import { IntentType } from "./assistant/IntentType";
import { CommandType } from "./assistant/CommandType";
import { EntityType } from "./assistant/EntityType";
import { ResponseType } from "./assistant/ResponseType";
import { PlannerState } from "./assistant/PlannerState";
import { ConversationState } from "./assistant/ConversationState";
import { ConfidenceLevel } from "./assistant/ConfidenceLevel";
import { AssistantValidator } from "./assistant/AssistantValidator";
import {
  AssistantValidationException,
  InvalidAssistantStateException
} from "./assistant/types";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { StartupPriority } from "./runtime/StartupPriority";
import { RuntimeState } from "./runtime/RuntimeState";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock Memory Store implementation
class MockMemoryStore {
  public store = new Map<string, Map<string, any>>();

  public async set(namespace: string, key: string, value: any): Promise<any> {
    if (!this.store.has(namespace)) {
      this.store.set(namespace, new Map());
    }
    this.store.get(namespace)!.set(key, value);
    return { namespace, key, value, timestamp: new Date() };
  }

  public async get(namespace: string, key: string): Promise<any> {
    return this.store.get(namespace)?.get(key);
  }

  public async has(namespace: string, key: string): Promise<boolean> {
    return this.store.get(namespace)?.has(key) ?? false;
  }
}

// Mock Decision Engine implementation
class MockDecisionEngine {
  public outcomes: any[] = [];
  public async recordOutcome(outcome: any): Promise<void> {
    this.outcomes.push(outcome);
  }
}

async function runTests() {
  // eslint-disable-next-line no-console
  console.log("=== START SPRINT 19.1 ASSISTANT ENGINE TESTS ===\n");

  const memoryStore = new MockMemoryStore();
  const decisionEngine = new MockDecisionEngine();

  const context = {
    env: "test",
    namespace: "assistant-test-namespace",
    memoryStore,
    decisionEngine,
    startTime: Date.now()
  };

  const preferences = {
    defaultOutputFormat: ResponseType.TEXT,
    autoExecute: true
  };

  // ==========================================
  // 1. Builder Validation...
  // ==========================================
  try {
    new AssistantBuilder().build();
    assert(false, "Should fail without context");
  } catch (err) {
    assert(err instanceof AssistantValidationException, "Expected AssistantValidationException");
  }

  const assistantEngine = new AssistantBuilder()
    .withContext(context)
    .withPreferences(preferences)
    .build() as AssistantEngine;

  assert(assistantEngine !== null, "Assistant builder should return an instance");
  assert(assistantEngine.getState() === AssistantState.CREATED, "Initial state must be CREATED");
  // eslint-disable-next-line no-console
  console.log("1. Builder Validation... ✓");

  // ==========================================
  // 2. Lifecycle Transitions...
  // ==========================================
  try {
    await assistantEngine.start();
    assert(false, "Should fail starting before initializing");
  } catch (err) {
    assert(err instanceof InvalidAssistantStateException, "Expected InvalidAssistantStateException");
  }

  await assistantEngine.initialize();
  assert(assistantEngine.getState() === AssistantState.LISTENING, "Should transition to LISTENING");
  
  await assistantEngine.start();
  assert(assistantEngine.getState() === AssistantState.LISTENING, "Should remain LISTENING on start");

  await assistantEngine.stop();
  assert(assistantEngine.getState() === AssistantState.FAILED, "Should transition to FAILED/STOPPED");
  // eslint-disable-next-line no-console
  console.log("2. Lifecycle Transitions... ✓");

  // ==========================================
  // 3. Conversation Management...
  // ==========================================
  const activeEngine = new AssistantBuilder()
    .withContext(context)
    .withPreferences(preferences)
    .build() as AssistantEngine;

  await activeEngine.initialize();
  await activeEngine.start();

  const session = (await activeEngine.getSessionManager().listSessions())[0];
  const cm = activeEngine.getConversationManager();
  
  await cm.appendMessage(session.id, {
    id: "msg-1",
    role: "user",
    content: "Hello AI",
    timestamp: new Date()
  });

  await cm.appendMessage(session.id, {
    id: "msg-2",
    role: "assistant",
    content: "Hello User!",
    timestamp: new Date()
  });

  const history = await cm.getHistory(session.id);
  assert(history.messages.length === 2, "Messages should be appended to session history");
  assert(history.messages[0].content === "Hello AI", "Content matched");
  // eslint-disable-next-line no-console
  console.log("3. Conversation Management... ✓");

  // ==========================================
  // 4. Intent Parsing...
  // ==========================================
  const parser = activeEngine.getIntentParser();
  const parsed = await parser.parseIntent("Create a new YouTube channel");
  
  assert(parsed.intent.type === IntentType.CHANNEL, "Intent resolved to CHANNEL");
  assert(parsed.intent.command === CommandType.CREATE, "Command resolved to CREATE");
  assert(parsed.confidence === ConfidenceLevel.VERY_HIGH, "Confidence rating very high");
  // eslint-disable-next-line no-console
  console.log("4. Intent Parsing... ✓");

  // ==========================================
  // 5. Entity Extraction...
  // ==========================================
  const extractor = activeEngine.getEntityExtractor();
  const entities = await extractor.extractEntities("Create project called AI Studio on YouTube");
  
  assert(entities.length === 2, "Should extract project and channel entities");
  assert(entities.some(e => e.type === EntityType.PROJECT && e.value === "AI Studio"), "Project name entity extracted");
  assert(entities.some(e => e.type === EntityType.CHANNEL && e.value === "YouTube"), "YouTube channel entity extracted");
  // eslint-disable-next-line no-console
  console.log("5. Entity Extraction... ✓");

  // ==========================================
  // 6. Slot Filling...
  // ==========================================
  const slotFiller = activeEngine.getSlotFiller();
  const slots = await slotFiller.fillSlots(parsed, "Create a new YouTube channel");
  
  assert(slots.length > 0, "Slots filled");
  assert(slots[0].name === "channelType" && slots[0].value === "youtube", "Channel slot filled");
  // eslint-disable-next-line no-console
  console.log("6. Slot Filling... ✓");

  // ==========================================
  // 7. Planner Creation...
  // ==========================================
  const planner = activeEngine.getPlanner();
  const researchIntent = await parser.parseIntent("Research AI startups");
  const plan = await planner.createPlan(researchIntent);
  
  assert(plan.steps.length === 1, "Should create 1 step for research");
  assert(plan.steps[0].targetEngine === "ResearchEngine", "Research target engine set");
  // eslint-disable-next-line no-console
  console.log("7. Planner Creation... ✓");

  // ==========================================
  // 8. Pipeline Execution...
  // ==========================================
  const execResult = await planner.executePlan(plan);
  assert(execResult.success, "Planner execution completes successfully");
  assert(execResult.executedStepsCount === 1, "1 step executed");
  // eslint-disable-next-line no-console
  console.log("8. Pipeline Execution... ✓");

  // ==========================================
  // 9. Workspace Commands...
  // ==========================================
  const wsIntent = await parser.parseIntent("Create project called AI Studio");
  wsIntent.entities = await extractor.extractEntities("Create project called AI Studio");
  wsIntent.slots = await slotFiller.fillSlots(wsIntent, "Create project called AI Studio");
  const wsPlan = await planner.createPlan(wsIntent);
  
  assert(wsPlan.intentType === IntentType.WORKSPACE, "Mapped to WORKSPACE intent");
  assert(wsPlan.steps[0].targetEngine === "WorkspaceEngine", "Target WorkspaceEngine set");
  // eslint-disable-next-line no-console
  console.log("9. Workspace Commands... ✓");

  // ==========================================
  // 10. Runtime Commands...
  // ==========================================
  const sysIntent = await parser.parseIntent("What is my GPU usage?");
  const sysPlan = await planner.createPlan(sysIntent);
  
  assert(sysPlan.intentType === IntentType.SYSTEM, "Mapped to SYSTEM intent");
  assert(sysPlan.steps[0].targetEngine === "RuntimeEngine", "Target RuntimeEngine set");
  // eslint-disable-next-line no-console
  console.log("10. Runtime Commands... ✓");

  // ==========================================
  // 11. Memory Integration...
  // ==========================================
  const response = await activeEngine.processCommand("Research AI startups", session.id);
  if (response.type !== ResponseType.TEXT) {
    // eslint-disable-next-line no-console
    console.error("DEBUG: response is", response);
  }
  assert(response.type === ResponseType.TEXT, "Returned correct format");
  const intentKeys = Array.from(memoryStore.store.get("intent")?.keys() || []);
  assert(intentKeys.some(k => k.startsWith("intent-")), "Intent parsed logs in memory store");
  // eslint-disable-next-line no-console
  console.log("11. Memory Integration... ✓");

  // ==========================================
  // 12. Learning Integration...
  // ==========================================
  assert(decisionEngine.outcomes.length > 0, "Learning metrics reported to outcomes");
  assert(decisionEngine.outcomes[0].decisionId === "assistant-commands", "Outcome decision matches");
  // eslint-disable-next-line no-console
  console.log("12. Learning Integration... ✓");

  // ==========================================
  // 13. Decision Integration...
  // ==========================================
  assert(decisionEngine.outcomes[0].score === 1.0, "Score reflects success state");
  // eslint-disable-next-line no-console
  console.log("13. Decision Integration... ✓");

  // ==========================================
  // 14. Context Resolution...
  // ==========================================
  const resolver = activeEngine.getContextResolver();
  const conversationCtx = await resolver.resolveContext("Research startups", session.id);
  assert(conversationCtx.activeSessionId === session.id, "Correct session ID set in context");
  // eslint-disable-next-line no-console
  console.log("14. Context Resolution... ✓");

  // ==========================================
  // 15. Event Publishing...
  // ==========================================
  let planEvFired = false;
  activeEngine.on("PlanCreated", () => { planEvFired = true; });
  await activeEngine.processCommand("Research AI startups", session.id);
  assert(planEvFired, "PlanCreated event published successfully");
  // eslint-disable-next-line no-console
  console.log("15. Event Publishing... ✓");

  // ==========================================
  // 16. Session Restore...
  // ==========================================
  const closedSession = await activeEngine.getSessionManager().createSession();
  await activeEngine.getSessionManager().closeSession(closedSession.id);
  
  const restored = await activeEngine.getSessionManager().restoreSession(closedSession.id);
  assert(restored.state === ConversationState.ACTIVE, "Session successfully restored to ACTIVE");
  // eslint-disable-next-line no-console
  console.log("16. Session Restore... ✓");

  // ==========================================
  // 17. Snapshot Immutability...
  // ==========================================
  const snap = activeEngine.getReporter().getAssistantSnapshot();
  try {
    (snap as any).state = AssistantState.FAILED;
    assert(false, "Should fail modifying frozen snapshot");
  } catch (err) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen snapshot");
  }
  // eslint-disable-next-line no-console
  console.log("17. Snapshot Immutability... ✓");

  // ==========================================
  // 18. Validator Rules...
  // ==========================================
  try {
    AssistantValidator.validateCommandSyntax("");
    assert(false, "Syntax validator should reject empty command");
  } catch (err) {
    assert(err instanceof AssistantValidationException, "Expected AssistantValidationException");
  }

  try {
    AssistantValidator.validateStepDependencies([
      { id: "step-1", name: "Step 1", targetEngine: "A", parameters: {}, dependsOnStepIds: ["step-2"], status: "PENDING" },
      { id: "step-2", name: "Step 2", targetEngine: "B", parameters: {}, dependsOnStepIds: ["step-1"], status: "PENDING" }
    ]);
    assert(false, "Cyclic dependency check should fail");
  } catch (err) {
    assert(err instanceof AssistantValidationException, "Expected AssistantValidationException");
  }
  // eslint-disable-next-line no-console
  console.log("18. Validator Rules... ✓");

  // ==========================================
  // 19. Multi-Step Command Execution...
  // ==========================================
  const multiPlan = await planner.createPlan(parsed);
  multiPlan.steps.push({
    id: "step-publish",
    name: "Upload video to channel",
    targetEngine: "PublishingEngine",
    parameters: { action: "upload" },
    dependsOnStepIds: ["step-generic"],
    status: "PENDING"
  });

  const multiResult = await planner.executePlan(multiPlan);
  assert(multiResult.success, "Multi-step plan executes successfully");
  assert(multiResult.executedStepsCount === 2, "2 steps executed");
  // eslint-disable-next-line no-console
  console.log("19. Multi-Step Command Execution... ✓");

  // ==========================================
  // 20. Full End-to-End Natural Language Pipeline...
  // ==========================================
  const runtime = new RuntimeBuilder()
    .withContext(context)
    .withConfig({
      env: "test",
      heartbeatIntervalMs: 500,
      healthCheckIntervalMs: 1000,
      startupTimeoutMs: 500,
      shutdownTimeoutMs: 500
    })
    .withHost({ id: "host-1" })
    .build();

  await runtime.initialize();
  await runtime.start();

  const loadedAssistantEngine = (runtime as any).getEngine("AssistantEngine") as AssistantEngine;
  assert(loadedAssistantEngine !== undefined, "Assistant is registered inside Runtime");

  const markdownPreferences = {
    defaultOutputFormat: ResponseType.MARKDOWN,
    autoExecute: true
  };
  
  const markdownEngine = new AssistantBuilder()
    .withContext(context)
    .withPreferences(markdownPreferences)
    .build() as AssistantEngine;
  await markdownEngine.initialize();
  await markdownEngine.start();

  const mdSession = (await markdownEngine.getSessionManager().listSessions())[0];
  const e2eResponse = await markdownEngine.processCommand("Research AI startups", mdSession.id);
  assert(e2eResponse.type === ResponseType.MARKDOWN, "Returns markdown format");
  assert(e2eResponse.text.includes("# Command Executed Successfully"), "Text matches markdown headers");

  await runtime.stop();
  await markdownEngine.stop();
  // eslint-disable-next-line no-console
  console.log("20. Full End-to-End Natural Language Pipeline... ✓");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL 20/20 WORKSPACE ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
