import {
  LoggerBuilder,
  ConsoleTransport,
  JsonFormatter,
  ConfigBuilder,
  RegistryBuilder,
  EventBus,
  JobEngine,
  MemoryStore,
  PluginBuilder,
  PluginState,
  PluginCapability,
  InvalidPluginStateException,
  PluginValidationException,
  PluginRegistry,
  PluginValidator,
  IPluginLifecycle,
  PluginContext,
} from "./index";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("Assertion Failed:", message);
    process.exit(1);
  }
}

class TestPluginLifecycle implements IPluginLifecycle {
  public readonly trace: string[] = [];

  public async initialize(context: PluginContext): Promise<void> {
    this.trace.push("initialize");
    context.logger.info("TestPluginLifecycle: initialize");
  }

  public async start(context: PluginContext): Promise<void> {
    this.trace.push("start");
    context.logger.info("TestPluginLifecycle: start");
  }

  public async stop(context: PluginContext): Promise<void> {
    this.trace.push("stop");
    context.logger.info("TestPluginLifecycle: stop");
  }
}

class FailingPluginLifecycle implements IPluginLifecycle {
  public failStage: "init" | "start" | "stop" = "init";

  public async initialize(context: PluginContext): Promise<void> {
    if (this.failStage === "init") {
      throw new Error("Simulated initialization error");
    }
  }

  public async start(context: PluginContext): Promise<void> {
    if (this.failStage === "start") {
      throw new Error("Simulated startup error");
    }
  }

  public async stop(context: PluginContext): Promise<void> {
    if (this.failStage === "stop") {
      throw new Error("Simulated stop error");
    }
  }
}

async function runTests() {
  console.log("=== START PLUGIN SYSTEM TESTS ===");

  // 1. Setup DI context
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

  const context: PluginContext = {
    logger,
    config,
    registry,
    eventBus,
    jobs,
    memory,
  };

  // 2. Test Plugin Builder
  console.log("\n1. Verifying Plugin Builder...");
  const delegate = new TestPluginLifecycle();
  const plugin = new PluginBuilder()
    .withId("plugin-test-1")
    .withName("Test Plugin 1")
    .withVersion("1.0.0")
    .withAuthor("Shaily Studio")
    .withDescription("A test plugin for verification")
    .withCapability(PluginCapability.AI)
    .withCapability(PluginCapability.UTILITY)
    .withContext(context)
    .withDelegate(delegate)
    .build();

  assert(plugin.metadata.id === "plugin-test-1", "Plugin ID matches");
  assert(plugin.metadata.name === "Test Plugin 1", "Plugin Name matches");
  assert(plugin.metadata.version === "1.0.0", "Plugin version matches");
  assert(plugin.metadata.capabilities.includes(PluginCapability.AI), "Plugin has AI capability");
  assert(plugin.state === PluginState.CREATED, "Plugin initial state is CREATED");
  console.log("   ✓ Plugin builder verified successfully.");

  // 3. Test Lifecycle & Transitions
  console.log("\n2. Verifying Plugin Lifecycle Transitions...");
  // initialize
  await plugin.initialize();
  assert(plugin.state === PluginState.READY, "Plugin state is READY after initialize");
  assert(delegate.trace.length === 1 && delegate.trace[0] === "initialize", "Initialize delegate executed");

  // start
  await plugin.start();
  assert(plugin.state === PluginState.RUNNING, "Plugin state is RUNNING after start");
  assert(delegate.trace.length === 2 && delegate.trace[1] === "start", "Start delegate executed");

  // stop
  await plugin.stop();
  assert(plugin.state === PluginState.STOPPED, "Plugin state is STOPPED after stop");
  assert(delegate.trace.length === 3 && delegate.trace[2] === "stop", "Stop delegate executed");
  console.log("   ✓ Standard transitions CREATED -> READY -> RUNNING -> STOPPED validated.");

  // Test Failure lifecycle transitions
  console.log("\n3. Verifying Lifecycle Failure States...");
  const failingDelegate = new FailingPluginLifecycle();

  // Failed initialize
  failingDelegate.failStage = "init";
  const pFailInit = new PluginBuilder()
    .withId("p-fail-init")
    .withName("Failing Init")
    .withVersion("1.0.0")
    .withAuthor("Test")
    .withDescription("Fails at init")
    .withCapability(PluginCapability.UI)
    .withContext(context)
    .withDelegate(failingDelegate)
    .build();

  try {
    await pFailInit.initialize();
    assert(false, "Should have thrown on init failure");
  } catch (err) {
    assert(pFailInit.state === PluginState.FAILED, "State should be FAILED after initialization error");
  }

  // Failed start
  failingDelegate.failStage = "start";
  const pFailStart = new PluginBuilder()
    .withId("p-fail-start")
    .withName("Failing Start")
    .withVersion("1.0.0")
    .withAuthor("Test")
    .withDescription("Fails at start")
    .withCapability(PluginCapability.UI)
    .withContext(context)
    .withDelegate(failingDelegate)
    .build();

  await pFailStart.initialize();
  try {
    await pFailStart.start();
    assert(false, "Should have thrown on start failure");
  } catch (err) {
    assert(pFailStart.state === PluginState.FAILED, "State should be FAILED after startup error");
  }

  // Failed stop
  failingDelegate.failStage = "stop";
  const pFailStop = new PluginBuilder()
    .withId("p-fail-stop")
    .withName("Failing Stop")
    .withVersion("1.0.0")
    .withAuthor("Test")
    .withDescription("Fails at stop")
    .withCapability(PluginCapability.UI)
    .withContext(context)
    .withDelegate(failingDelegate)
    .build();

  await pFailStop.initialize();
  await pFailStop.start();
  try {
    await pFailStop.stop();
    assert(false, "Should have thrown on stop failure");
  } catch (err) {
    assert(pFailStop.state === PluginState.FAILED, "State should be FAILED after stop error");
  }
  console.log("   ✓ Failures correctly transition plugins to FAILED.");

  // 4. Test Illegal State Transitions
  console.log("\n4. Verifying Illegal Lifecycle Transitions...");
  const transitionPlugin = new PluginBuilder()
    .withId("p-transition")
    .withName("Transition Plugin")
    .withVersion("1.0.0")
    .withAuthor("Test")
    .withDescription("Tests transitions")
    .withCapability(PluginCapability.MEMORY)
    .withContext(context)
    .withDelegate(new TestPluginLifecycle())
    .build();

  // start before initialize -> fail
  try {
    await transitionPlugin.start();
    assert(false, "Should not allow start in CREATED state");
  } catch (err) {
    assert(err instanceof InvalidPluginStateException, "Expected InvalidPluginStateException");
  }

  // stop before start -> fail
  try {
    await transitionPlugin.stop();
    assert(false, "Should not allow stop in CREATED state");
  } catch (err) {
    assert(err instanceof InvalidPluginStateException, "Expected InvalidPluginStateException");
  }

  await transitionPlugin.initialize();

  // stop in READY -> fail
  try {
    await transitionPlugin.stop();
    assert(false, "Should not allow stop in READY state");
  } catch (err) {
    assert(err instanceof InvalidPluginStateException, "Expected InvalidPluginStateException");
  }

  await transitionPlugin.start();
  await transitionPlugin.stop();

  // initialize in STOPPED -> fail
  try {
    await transitionPlugin.initialize();
    assert(false, "Should not allow initialize in STOPPED state");
  } catch (err) {
    assert(err instanceof InvalidPluginStateException, "Expected InvalidPluginStateException");
  }
  console.log("   ✓ Illegal transitions correctly block execution.");

  // 5. Test Plugin Registry mechanics
  console.log("\n5. Verifying Plugin Registry mechanics...");
  const pluginRegistry = new PluginRegistry();
  const regPlugin = new PluginBuilder()
    .withId("plugin-reg")
    .withName("Registered Plugin")
    .withVersion("1.0.0")
    .withAuthor("Test")
    .withDescription("Registry test")
    .withCapability(PluginCapability.WORKFLOW)
    .withContext(context)
    .withDelegate(new TestPluginLifecycle())
    .build();

  // register
  pluginRegistry.register(regPlugin);
  assert(pluginRegistry.has("plugin-reg"), "Registry has the registered plugin");
  assert(pluginRegistry.get("plugin-reg") === regPlugin, "Lookup returns registered plugin");

  // duplicate registration -> fail
  try {
    pluginRegistry.register(regPlugin);
    assert(false, "Should prevent duplicate ID registration");
  } catch (err) {
    assert(err instanceof PluginValidationException, "Expected PluginValidationException on duplicate register");
  }

  // initialize through registry
  await pluginRegistry.initialize("plugin-reg");
  assert(regPlugin.state === PluginState.READY, "Registry delegated initialize");

  // start through registry
  await pluginRegistry.start("plugin-reg");
  assert(regPlugin.state === PluginState.RUNNING, "Registry delegated start");

  // stop through registry
  await pluginRegistry.stop("plugin-reg");
  assert(regPlugin.state === PluginState.STOPPED, "Registry delegated stop");

  // unregister
  const unregResult = pluginRegistry.unregister("plugin-reg");
  assert(unregResult === true, "Unregister returns true");
  assert(!pluginRegistry.has("plugin-reg"), "Plugin is no longer in registry");

  const unregNonExist = pluginRegistry.unregister("not-existing");
  assert(unregNonExist === false, "Unregistering non-existent returns false");
  console.log("   ✓ Registry operations register, unregister, duplicate check, lifecycle delegation verified.");

  // 6. Validator Checks
  console.log("\n6. Verifying Validator rule checks...");
  const validator = new PluginValidator();

  // Empty id
  try {
    validator.validateMetadata({
      id: "",
      name: "Name",
      version: "1.0.0",
      author: "Author",
      description: "Desc",
      capabilities: [PluginCapability.LOGGER],
    });
    assert(false, "Validator should reject empty ID");
  } catch (err) {
    assert(err instanceof PluginValidationException, "Expected PluginValidationException");
  }

  // Empty capabilities
  try {
    validator.validateMetadata({
      id: "id",
      name: "Name",
      version: "1.0.0",
      author: "Author",
      description: "Desc",
      capabilities: [],
    });
    assert(false, "Validator should reject empty capabilities list");
  } catch (err) {
    assert(err instanceof PluginValidationException, "Expected PluginValidationException");
  }

  // Invalid capability
  try {
    validator.validateMetadata({
      id: "id",
      name: "Name",
      version: "1.0.0",
      author: "Author",
      description: "Desc",
      capabilities: ["INVALID" as any],
    });
    assert(false, "Validator should reject invalid capability");
  } catch (err) {
    assert(err instanceof PluginValidationException, "Expected PluginValidationException");
  }
  console.log("   ✓ Metadata fields validated successfully.");

  // 7. Snapshot Immutability
  console.log("\n7. Verifying Snapshot Immutability...");
  const snapPlugin = new PluginBuilder()
    .withId("snap-p")
    .withName("Snapshot Plugin")
    .withVersion("1.0.0")
    .withAuthor("Test")
    .withDescription("Snapshot immutability checks")
    .withCapability(PluginCapability.PROVIDER)
    .withContext(context)
    .withDelegate(new TestPluginLifecycle())
    .build();

  pluginRegistry.register(snapPlugin);
  const registrySnapshot = pluginRegistry.snapshot();

  assert(registrySnapshot.pluginsCount === 1, "Snapshot count is 1");
  assert(registrySnapshot.plugins[0].id === "snap-p", "Snapshot ID matches");

  // Verify Object.isFrozen
  assert(Object.isFrozen(registrySnapshot), "Registry snapshot is frozen");
  assert(Object.isFrozen(registrySnapshot.plugins), "Registry snapshot plugins list is frozen");
  assert(Object.isFrozen(registrySnapshot.plugins[0]), "Plugin snapshot is frozen");

  try {
    (registrySnapshot as any).pluginsCount = 5;
    assert(false, "Should not allow mutating snapshot count");
  } catch (err) {
    // correctly threw error
  }
  console.log("   ✓ Registry and plugin snapshots are deep-frozen and immutable.");

  console.log("\n=== ALL PLUGIN SYSTEM TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
