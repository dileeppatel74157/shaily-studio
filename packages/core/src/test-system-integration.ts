import { SystemIntegrationBuilder } from "./system-integration/SystemIntegrationBuilder";
import { IntegrationState } from "./system-integration/IntegrationState";
import { EngineRegistrationState } from "./system-integration/EngineRegistrationState";
import { SynchronizationState } from "./system-integration/SynchronizationState";
import { HealthLevel } from "./system-integration/HealthLevel";
import { RecoveryStrategy } from "./system-integration/RecoveryStrategy";
import { IntegrationValidationException, InvalidIntegrationStateException } from "./system-integration/types";
import { SystemSnapshot } from "./system-integration/models";
import { IntegrationValidator } from "./system-integration/IntegrationValidator";
import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { SettingsBuilder } from "./settings/SettingsBuilder";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock context
const mockEvents: any[] = [];
const mockContext = {
  logger: {
    info: (msg: string) => {},
    warn: (msg: string) => {},
    error: (msg: string) => {}
  },
  eventBus: {
    publish: async (event: any) => {
      mockEvents.push(event);
    }
  }
};

async function runTests() {
  console.log("=== START SPRINT 22.1 SYSTEM INTEGRATION TESTS ===\n");

  // 1. Builder Validation
  try {
    new SystemIntegrationBuilder().build();
    assert(false, "Builder should throw if context is missing.");
  } catch (err: any) {
    assert(err instanceof IntegrationValidationException, "Expected IntegrationValidationException.");
  }
  console.log("1. Builder Validation... ✓");

  // 2. Engine Discovery
  const engine = new SystemIntegrationBuilder().withContext(mockContext).build();
  const discovered = await engine.getRegistry().discoverEngines();
  assert(discovered.length === 22, `Should discover 22 engines, got ${discovered.length}`);
  console.log("2. Engine Discovery... ✓");

  // 3. Engine Registration
  assert(engine.getState() === IntegrationState.CREATED, "State should be CREATED.");
  await engine.initialize();
  assert(engine.getState() === IntegrationState.READY, "State should be READY after initialize.");
  const regs = engine.getRegistry().getRegistrations();
  assert(regs.length === 22, `Expected 22 registered engines, got ${regs.length}`);
  console.log("3. Engine Registration... ✓");

  // 4. Dependency Resolution
  const resolver = engine.getResolver();
  const graph = await resolver.resolveDependencies(regs);
  assert(graph.nodes.length === 22, "Dependency nodes mismatch.");
  assert(!graph.hasCircularDependency, "Should not detect circular dependencies.");
  resolver.verifyIntegrity(graph);
  console.log("4. Dependency Resolution... ✓");

  // 5. Shared Context Integration
  const sync = engine.getContextSynchronizer();
  const initialCtx = sync.getContextState();
  assert(initialCtx !== null, "Shared context should be initialized.");
  
  await sync.synchronizeContexts({
    agentContext: { test: "agent" },
    planningContext: { test: "plan", eventBus: engine.getEventBus() },
    memoryContext: { test: "mem" },
    decisionContext: { test: "dec" }
  });
  const updatedCtx = sync.getContextState();
  assert(updatedCtx.agentContext.test === "agent", "Agent context sync failed.");
  console.log("5. Shared Context Integration... ✓");

  // 6. Event Bus Connection
  const bus = engine.getEventBus();
  let receivedPayload = null;
  const sub = bus.subscribe("PIPELINE_STARTED", "test-sub", (payload) => {
    receivedPayload = payload;
  });
  
  await bus.publish({
    id: "pub-01",
    eventName: "PIPELINE_STARTED",
    publisherId: "test-pub",
    timestamp: new Date(),
    payload: { pipelineId: "pip-100" }
  });
  assert(receivedPayload !== null && (receivedPayload as any).pipelineId === "pip-100", "Event transmission failed.");
  bus.unsubscribe(sub.id);
  console.log("6. Event Bus Connection... ✓");

  // 7. Runtime Synchronization
  const runSync = engine.getRuntimeSynchronizer();
  const ref = runSync.getRuntimeState();
  assert(ref.currentProject === "Default Project", "Expected Default Project.");
  
  const report = await runSync.syncRuntimeState({
    state: "RUNNING",
    currentProject: "Project Alpha",
    activeWorkspace: "/workspace/alpha",
    cacheStats: { knowledgeItemsCount: 30, memoryItemsCount: 150 }
  });
  assert(report.status === SynchronizationState.COMPLETED, "Sync status should be COMPLETED.");
  assert(runSync.getRuntimeState().currentProject === "Project Alpha", "Project name sync failed.");
  console.log("7. Runtime Synchronization... ✓");

  // 8. Workspace Integration
  const workspaceReg = engine.getRegistry().getRegistrations().find(r => r.id === "WorkspaceEngine");
  assert(workspaceReg !== undefined && workspaceReg.engineInstance !== null, "Workspace engine registration missing.");
  console.log("8. Workspace Integration... ✓");

  // 9. Assistant Integration
  const assistantReg = engine.getRegistry().getRegistrations().find(r => r.id === "AssistantEngine");
  assert(assistantReg !== undefined && assistantReg.engineInstance !== null, "Assistant engine registration missing.");
  console.log("9. Assistant Integration... ✓");

  // 10. Pipeline Integration
  const pipelineReg = engine.getRegistry().getRegistrations().find(r => r.id === "PipelineEngine");
  assert(pipelineReg !== undefined, "Pipeline engine registration missing.");
  assert(pipelineReg!.state === EngineRegistrationState.READY, "Pipeline engine registration state not READY.");
  console.log("10. Pipeline Integration... ✓");

  // 11. Knowledge Base Integration
  const kbReg = engine.getRegistry().getRegistrations().find(r => r.id === "KnowledgeBaseEngine");
  assert(kbReg !== undefined && kbReg.engineInstance !== null, "KnowledgeBase engine registration missing.");
  console.log("11. Knowledge Base Integration... ✓");

  // 12. Memory Optimization Integration
  const memReg = engine.getRegistry().getRegistrations().find(r => r.id === "MemoryOptimizationEngine");
  assert(memReg !== undefined && memReg.engineInstance !== null, "MemoryOptimization engine registration missing.");
  console.log("12. Memory Optimization Integration... ✓");

  // 13. Settings Integration
  const settingsReg = engine.getRegistry().getRegistrations().find(r => r.id === "SettingsEngine");
  assert(settingsReg !== undefined && settingsReg.engineInstance !== null, "Settings engine registration missing.");
  console.log("13. Settings Integration... ✓");

  // 14. Health Monitoring
  const healthMonitor = engine.getHealthMonitor();
  const health = await healthMonitor.verifyHealth();
  assert(health.level === HealthLevel.EXCELLENT, "Expected EXCELLENT health level.");
  console.log("14. Health Monitoring... ✓");

  // 15. Recovery Manager
  const recovery = engine.getRecoveryManager();
  const recoveryTask = {
    id: "rec-01",
    targetEngineId: "WorkspaceEngine",
    strategy: RecoveryStrategy.RETRY,
    attempts: 1,
    startedAt: new Date()
  };
  const recReport = await recovery.executeRecovery(recoveryTask);
  assert(recReport.success && recReport.strategyExecuted === RecoveryStrategy.RETRY, "Recovery test failed.");
  assert(recovery.getRecoveryHistory().length === 1, "Recovery history mismatch.");
  console.log("15. Recovery Manager... ✓");

  // 16. Full Pipeline Execution
  const rep = await engine.getReporter().generateReport();
  assert(rep.manifest.engines.length === 22, "Report manifest mismatch.");
  console.log("16. Full Pipeline Execution... ✓");

  // 17. Snapshot Immutability
  const snap = engine.getSnapshot();
  assert(Object.isFrozen(snap), "Snapshot should be frozen.");
  assert(Object.isFrozen(snap.configuration), "Snapshot configuration should be frozen.");
  console.log("17. Snapshot Immutability... ✓");

  // 18. Validator Rules
  const snapshotObj: SystemSnapshot = {
    integrationState: IntegrationState.READY,
    healthLevel: HealthLevel.EXCELLENT,
    activeConfiguration: engine.getSnapshot().configuration,
    registrations: engine.getRegistry().getRegistrations().map(r => ({ id: r.id, state: r.state }))
  };
  const valResult = await engine.getValidator().validate(snapshotObj);
  assert(valResult.isValid, "Standard snapshot validation should pass.");

  const invalidSnapshot: SystemSnapshot = {
    integrationState: IntegrationState.READY,
    healthLevel: HealthLevel.EXCELLENT,
    activeConfiguration: engine.getSnapshot().configuration,
    registrations: [] // missing critical engines
  };
  const invalidResult = await engine.getValidator().validate(invalidSnapshot);
  assert(!invalidResult.isValid, "Validator should fail when critical engines are missing.");
  console.log("18. Validator Rules... ✓");

  // 19. System Ready Event
  const readyEvt = bus.getHistory().find(e => e.eventName === "SYSTEM_READY");
  assert(readyEvt !== undefined, "SYSTEM_READY event not found in history.");
  console.log("19. System Ready Event... ✓");

  // 20. Complete End-to-End AI OS Integration
  // Setup runtime builder and check systemIntegrationEngine registration
  const runtimeContext = {
    env: "test",
    namespace: "e2e-integration-test",
    startTime: Date.now()
  };
  const runtimeConfig = {
    env: "test",
    heartbeatIntervalMs: 500,
    healthCheckIntervalMs: 1000,
    startupTimeoutMs: 500,
    shutdownTimeoutMs: 500
  };
  const runtime = new RuntimeBuilder()
    .withContext(runtimeContext)
    .withConfig(runtimeConfig)
    .build();

  assert(runtime !== null, "Runtime builder failed.");
  const integrationSvc = runtime.getEngine("SystemIntegrationEngine");
  assert(integrationSvc !== undefined, "SystemIntegrationEngine must register in RuntimeEngine.");
  console.log("20. Complete End-to-End AI OS Integration... ✓\n");

  console.log("=== ALL 20/20 SYSTEM INTEGRATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test suite threw an exception:", err);
  process.exit(1);
});
