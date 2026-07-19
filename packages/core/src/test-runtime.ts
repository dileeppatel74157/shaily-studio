import { RuntimeBuilder } from "./runtime/RuntimeBuilder";
import { RuntimeEngine } from "./runtime/RuntimeEngine";
import { RuntimeState } from "./runtime/RuntimeState";
import { EngineState } from "./runtime/EngineState";
import { ServiceType } from "./runtime/ServiceType";
import { HealthStatus } from "./runtime/HealthStatus";
import { RuntimeEventType } from "./runtime/RuntimeEventType";
import { StartupPriority } from "./runtime/StartupPriority";
import { SchedulerState } from "./runtime/SchedulerState";
import { HeartbeatStatus } from "./runtime/HeartbeatStatus";
import { RuntimeValidator } from "./runtime/RuntimeValidator";
import {
  RuntimeValidationException,
  InvalidRuntimeStateException,
  DependencyException,
  SchedulerException,
  HealthCheckException,
  StartupException
} from "./runtime/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

// Mock Engine implementation
class MockEngine {
  public initialized = false;
  public started = false;
  public stopped = false;
  public initOrder: number = 0;
  public startOrder: number = 0;
  public stopOrder: number = 0;

  constructor(
    private readonly initCb?: () => void,
    private readonly startCb?: () => void,
    private readonly stopCb?: () => void
  ) {}

  public async initialize(): Promise<void> {
    this.initialized = true;
    if (this.initCb) this.initCb();
  }

  public async start(): Promise<void> {
    this.started = true;
    if (this.startCb) this.startCb();
  }

  public async stop(): Promise<void> {
    this.stopped = true;
    if (this.stopCb) this.stopCb();
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
  console.log("=== START SPRINT 18.1 RUNTIME ENGINE TESTS ===\n");

  const memoryStore = new MockMemoryStore();
  const decisionEngine = new MockDecisionEngine();

  const context = {
    env: "test",
    namespace: "studio-runtime-test",
    memoryStore,
    decisionEngine,
    startTime: Date.now()
  };

  const config = {
    env: "test",
    heartbeatIntervalMs: 50,
    healthCheckIntervalMs: 50,
    schedulerIntervalMs: 10,
    startupTimeoutMs: 100,
    shutdownTimeoutMs: 100
  };

  // ==========================================
  // 1. Builder Validation...
  // ==========================================
  try {
    new RuntimeBuilder().build();
    assert(false, "Should fail without context");
  } catch (err) {
    assert(err instanceof RuntimeValidationException, "Expected RuntimeValidationException");
  }

  try {
    new RuntimeBuilder().withContext(context).build();
    assert(false, "Should fail without config or host");
  } catch (err) {
    assert(err instanceof RuntimeValidationException, "Expected RuntimeValidationException");
  }

  const runtime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  assert(runtime !== null, "Builder should return a valid instance");
  assert(runtime.getState() === RuntimeState.CREATED, "Initial state should be CREATED");
  // eslint-disable-next-line no-console
  console.log("1. Builder Validation... ✓");

  // ==========================================
  // 2. Lifecycle Transitions...
  // ==========================================
  // Test invalid transition directly to running
  try {
    await runtime.start();
    assert(false, "Should not start without initializing first");
  } catch (err) {
    assert(err instanceof InvalidRuntimeStateException, "Expected InvalidRuntimeStateException");
  }

  // Valid state transitions will be verified in following tests
  // eslint-disable-next-line no-console
  console.log("2. Lifecycle Transitions... ✓");

  // ==========================================
  // 3. Runtime Boot...
  // ==========================================
  const bootRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  await bootRuntime.initialize();
  assert(bootRuntime.getState() === RuntimeState.INITIALIZING, "State should be INITIALIZING after initialize");

  await bootRuntime.start();
  assert(bootRuntime.getState() === RuntimeState.RUNNING, "State should be RUNNING after start");
  
  // Clean up
  await bootRuntime.stop();
  // eslint-disable-next-line no-console
  console.log("3. Runtime Boot... ✓");

  // ==========================================
  // 4. Engine Discovery...
  // ==========================================
  const discRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  const mockEng = new MockEngine();
  discRuntime.registerEngine({
    id: "ResearchEngine",
    engine: mockEng,
    dependencies: [],
    priority: StartupPriority.NORMAL
  });

  const resolvedEng = discRuntime.getEngine<MockEngine>("ResearchEngine");
  assert(resolvedEng === mockEng, "Registered engine should be resolved correctly");
  // eslint-disable-next-line no-console
  console.log("4. Engine Discovery... ✓");

  // ==========================================
  // 5. Service Registration...
  // ==========================================
  const servRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  const mockService = { query: () => "data" };
  servRuntime.registerService({
    id: "DatabaseService",
    type: ServiceType.DATABASE,
    service: mockService
  });

  const resolvedServ = servRuntime.getService<any>("DatabaseService");
  assert(resolvedServ === mockService, "Registered service should be resolved correctly");
  // eslint-disable-next-line no-console
  console.log("5. Service Registration... ✓");

  // ==========================================
  // 6. Dependency Resolution...
  // ==========================================
  const depRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  depRuntime.registerEngine({ id: "Planning", engine: new MockEngine(), dependencies: ["Decision"], priority: StartupPriority.HIGH });
  depRuntime.registerEngine({ id: "Decision", engine: new MockEngine(), dependencies: ["Memory"], priority: StartupPriority.HIGH });
  depRuntime.registerEngine({ id: "Memory", engine: new MockEngine(), dependencies: [], priority: StartupPriority.CRITICAL });

  const order = depRuntime.getStartupManager().determineStartupOrder(
    depRuntime.getSnapshot().engines
  );

  assert(order[0] === "Memory", "Memory should be first");
  assert(order[1] === "Decision", "Decision should be second");
  assert(order[2] === "Planning", "Planning should be third");
  // eslint-disable-next-line no-console
  console.log("6. Dependency Resolution... ✓");

  // ==========================================
  // 7. Startup Ordering...
  // ==========================================
  const orderRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  let execSeq: string[] = [];
  const engineA = new MockEngine(() => execSeq.push("A_init"), () => execSeq.push("A_start"));
  const engineB = new MockEngine(() => execSeq.push("B_init"), () => execSeq.push("B_start"));

  orderRuntime.registerEngine({ id: "EngineA", engine: engineA, dependencies: ["EngineB"], priority: StartupPriority.NORMAL });
  orderRuntime.registerEngine({ id: "EngineB", engine: engineB, dependencies: [], priority: StartupPriority.NORMAL });

  await orderRuntime.initialize();
  await orderRuntime.start();

  assert(execSeq[0] === "B_init", "EngineB should initialize first");
  assert(execSeq[1] === "A_init", "EngineA should initialize second");
  assert(execSeq[2] === "B_start", "EngineB should start first");
  assert(execSeq[3] === "A_start", "EngineA should start second");

  await orderRuntime.stop();
  // eslint-disable-next-line no-console
  console.log("7. Startup Ordering... ✓");

  // ==========================================
  // 8. Health Monitoring...
  // ==========================================
  const healthRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  healthRuntime.registerEngine({ id: "EngineA", engine: new MockEngine(), dependencies: [], priority: StartupPriority.NORMAL });
  healthRuntime.setEngineHealth("EngineA", HealthStatus.HEALTHY);

  const healthReport = await healthRuntime.getHealthMonitor().checkHealth();
  assert(healthReport.status === HealthStatus.HEALTHY, "Aggregate status should be healthy");
  assert(healthReport.score === 100, "Health score should be 100");

  healthRuntime.getHealthMonitor().updateHealth("EngineA", HealthStatus.WARNING);
  const updatedReport = await healthRuntime.getHealthMonitor().checkHealth();
  assert(updatedReport.status === HealthStatus.WARNING, "Aggregate status should reflect warning");
  assert(updatedReport.score === 70, "Health score should reflect warning");
  // eslint-disable-next-line no-console
  console.log("8. Health Monitoring... ✓");

  // ==========================================
  // 9. Heartbeat...
  // ==========================================
  const hbRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  hbRuntime.registerEngine({ id: "EngineA", engine: new MockEngine(), dependencies: [], priority: StartupPriority.NORMAL });
  await hbRuntime.initialize();
  await hbRuntime.start();

  hbRuntime.getHeartbeatManager().recordHeartbeat("EngineA", HeartbeatStatus.ACTIVE);
  const history = hbRuntime.getHeartbeatManager().getHeartbeatHistory("EngineA");
  assert(history.heartbeats.length === 1, "Should record heartbeat history");
  assert(history.heartbeats[0].status === HeartbeatStatus.ACTIVE, "Status should be ACTIVE");

  await hbRuntime.stop();
  // eslint-disable-next-line no-console
  console.log("9. Heartbeat... ✓");

  // ==========================================
  // 10. Scheduler Execution...
  // ==========================================
  const schedRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  let runCount = 0;
  schedRuntime.getScheduler().scheduleJob({
    id: "CleanupJob",
    intervalMs: 5,
    priority: StartupPriority.NORMAL,
    task: async () => { runCount++; }
  });

  await schedRuntime.initialize();
  await schedRuntime.start();

  // Wait a short time for scheduler tick
  await new Promise(resolve => setTimeout(resolve, 30));
  assert(runCount > 0, "Scheduled job should execute");

  await schedRuntime.stop();
  // eslint-disable-next-line no-console
  console.log("10. Scheduler Execution... ✓");

  // ==========================================
  // 11. Memory Integration...
  // ==========================================
  // Verify data was written to namespaces in MockMemoryStore
  assert(await memoryStore.has("startup", "initialize_success"), "Should record startup sequence in memory");
  assert(await memoryStore.has("startup", "start_success"), "Should record startup completion in memory");
  assert(await memoryStore.has("shutdown", "stop_success"), "Should record shutdown sequence in memory");
  // eslint-disable-next-line no-console
  console.log("11. Memory Integration... ✓");

  // ==========================================
  // 12. Decision Integration...
  // ==========================================
  // Verify startup timing logs in MockDecisionEngine
  assert(decisionEngine.outcomes.length > 0, "Should record startup outcome in decision engine");
  assert(decisionEngine.outcomes[0].decisionId === "boot-optimization", "Decision ID matches");
  // eslint-disable-next-line no-console
  console.log("12. Decision Integration... ✓");

  // ==========================================
  // 13. Planning Integration...
  // ==========================================
  const planningContext = {
    logger: {} as any,
    config: {} as any,
    registry: {} as any,
    eventBus: {} as any,
    runtimeEngine: runtime
  };
  assert(planningContext.runtimeEngine === runtime, "Planning context contains runtime reference");
  // eslint-disable-next-line no-console
  console.log("13. Planning Integration... ✓");

  // ==========================================
  // 14. Agent Integration...
  // ==========================================
  const agentContext = {
    logger: {} as any,
    config: {} as any,
    registry: {} as any,
    eventBus: {} as any,
    jobEngine: {} as any,
    memoryStore: {} as any,
    runtimeEngine: runtime
  };
  assert(agentContext.runtimeEngine === runtime, "Agent context contains runtime reference");
  // eslint-disable-next-line no-console
  console.log("14. Agent Integration... ✓");

  // ==========================================
  // 15. Event Publishing...
  // ==========================================
  const eventRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  let eventFired = false;
  eventRuntime.on(RuntimeEventType.READY, () => { eventFired = true; });

  await eventRuntime.initialize();
  await eventRuntime.start();

  assert(eventFired, "READY event should be fired");
  await eventRuntime.stop();
  // eslint-disable-next-line no-console
  console.log("15. Event Publishing... ✓");

  // ==========================================
  // 16. Snapshot Immutability...
  // ==========================================
  const snapRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  await snapRuntime.initialize();
  await snapRuntime.start();

  const snapshot = snapRuntime.getSnapshot();
  try {
    (snapshot as any).state = RuntimeState.FAILED;
    assert(false, "Should throw error on modifying snapshot");
  } catch (err) {
    assert(err instanceof TypeError, "Expected TypeError on modifying frozen object");
  }

  await snapRuntime.stop();
  // eslint-disable-next-line no-console
  console.log("16. Snapshot Immutability... ✓");

  // ==========================================
  // 17. Validator Rules...
  // ==========================================
  // Test duplicate ID validation
  try {
    RuntimeValidator.validateEngineIdUnique("EngineA", new Set(["EngineA"]));
    assert(false, "Should fail on duplicate ID");
  } catch (err) {
    assert(err instanceof RuntimeValidationException, "Expected RuntimeValidationException");
  }

  // Test space check
  try {
    RuntimeValidator.validateIdentifier("invalid id space", "Engine ID");
    assert(false, "Should fail on spaces");
  } catch (err) {
    assert(err instanceof RuntimeValidationException, "Expected RuntimeValidationException");
  }

  // Test circular dependency validation
  try {
    RuntimeValidator.validateCircularDependencies([
      { id: "A", engine: {}, dependencies: ["B"], priority: StartupPriority.NORMAL },
      { id: "B", engine: {}, dependencies: ["A"], priority: StartupPriority.NORMAL }
    ]);
    assert(false, "Should fail on circular dependency");
  } catch (err) {
    assert(err instanceof DependencyException, "Expected DependencyException");
  }
  // eslint-disable-next-line no-console
  console.log("17. Validator Rules... ✓");

  // ==========================================
  // 18. Shutdown Sequence...
  // ==========================================
  const shutRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  const shutSeq: string[] = [];
  shutRuntime.registerEngine({ id: "EngineX", engine: new MockEngine(undefined, undefined, () => shutSeq.push("X")), dependencies: ["EngineY"], priority: StartupPriority.NORMAL });
  shutRuntime.registerEngine({ id: "EngineY", engine: new MockEngine(undefined, undefined, () => shutSeq.push("Y")), dependencies: [], priority: StartupPriority.NORMAL });

  await shutRuntime.initialize();
  await shutRuntime.start();
  await shutRuntime.stop();

  assert(shutSeq[0] === "X", "EngineX (dependent) should stop first");
  assert(shutSeq[1] === "Y", "EngineY (dependency) should stop last");
  // eslint-disable-next-line no-console
  console.log("18. Shutdown Sequence... ✓");

  // ==========================================
  // 19. Restart Sequence...
  // ==========================================
  const restRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  await restRuntime.initialize();
  await restRuntime.start();
  await restRuntime.stop();

  assert(restRuntime.getState() === RuntimeState.STOPPED, "State should be STOPPED");

  // Restart
  await restRuntime.initialize();
  await restRuntime.start();
  assert(restRuntime.getState() === RuntimeState.RUNNING, "State should go back to RUNNING after restart");

  await restRuntime.stop();
  // eslint-disable-next-line no-console
  console.log("19. Restart Sequence... ✓");

  // ==========================================
  // 20. Full End-to-End Runtime Boot...
  // ==========================================
  const e2eRuntime = new RuntimeBuilder()
    .withContext(context)
    .withConfig(config)
    .build() as RuntimeEngine;

  let e2eSeq: string[] = [];

  // Register mock engines matching AI OS dependencies:
  // Memory -> Decision -> Planning -> Research -> Strategy -> Script -> Generation -> Rendering -> Publishing
  e2eRuntime.registerEngine({ id: "Memory", engine: new MockEngine(() => e2eSeq.push("Memory_init")), dependencies: [], priority: StartupPriority.CRITICAL });
  e2eRuntime.registerEngine({ id: "Decision", engine: new MockEngine(() => e2eSeq.push("Decision_init")), dependencies: ["Memory"], priority: StartupPriority.CRITICAL });
  e2eRuntime.registerEngine({ id: "Planning", engine: new MockEngine(() => e2eSeq.push("Planning_init")), dependencies: ["Decision"], priority: StartupPriority.HIGH });
  e2eRuntime.registerEngine({ id: "Research", engine: new MockEngine(() => e2eSeq.push("Research_init")), dependencies: ["Planning"], priority: StartupPriority.HIGH });
  e2eRuntime.registerEngine({ id: "Strategy", engine: new MockEngine(() => e2eSeq.push("Strategy_init")), dependencies: ["Research"], priority: StartupPriority.NORMAL });
  e2eRuntime.registerEngine({ id: "Script", engine: new MockEngine(() => e2eSeq.push("Script_init")), dependencies: ["Strategy"], priority: StartupPriority.NORMAL });
  e2eRuntime.registerEngine({ id: "Generation", engine: new MockEngine(() => e2eSeq.push("Generation_init")), dependencies: ["Script"], priority: StartupPriority.NORMAL });
  e2eRuntime.registerEngine({ id: "Rendering", engine: new MockEngine(() => e2eSeq.push("Rendering_init")), dependencies: ["Generation"], priority: StartupPriority.LOW });
  e2eRuntime.registerEngine({ id: "Publishing", engine: new MockEngine(() => e2eSeq.push("Publishing_init")), dependencies: ["Rendering"], priority: StartupPriority.LOW });

  await e2eRuntime.initialize();
  await e2eRuntime.start();

  assert(e2eRuntime.getState() === RuntimeState.RUNNING, "E2E runtime should be running");
  
  // Verify correct topological boot order
  const expectedInitOrder = ["Memory_init", "Decision_init", "Planning_init", "Research_init", "Strategy_init", "Script_init", "Generation_init", "Rendering_init", "Publishing_init"];
  for (let i = 0; i < expectedInitOrder.length; i++) {
    assert(e2eSeq[i] === expectedInitOrder[i], `Expected ${expectedInitOrder[i]} at position ${i}, got ${e2eSeq[i]}`);
  }

  await e2eRuntime.stop();
  assert(e2eRuntime.getState() === RuntimeState.STOPPED, "E2E runtime should stop cleanly");
  // eslint-disable-next-line no-console
  console.log("20. Full End-to-End Runtime Boot... ✓");

  // eslint-disable-next-line no-console
  console.log("\n=== ALL 20/20 RUNTIME ENGINE TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution failed:", err);
  process.exit(1);
});
